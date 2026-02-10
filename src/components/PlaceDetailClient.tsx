"use client";

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import UserReviewsGallery from './UserReviewsGallery';
import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';
import type { ARData } from '@/types/ar';

// Importar QR Scanner dinámicamente para evitar problemas de SSR
const QRScanner = dynamic(() => import('./QRScanner'), { ssr: false });

type PlaceSerializable = {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  category?: string;
  lat?: number;
  lng?: number;
  isBusiness?: boolean;
  contact_info?: string;
  website_url?: string;
  gallery_urls?: string[];
  video_urls?: string[];
  has_ar_content?: boolean;
  ar_model_url?: string;
  ar_hotspots?: ARData;
  qr_code?: string;
};

type Promotion = {
  id: string;
  title?: string;
  description?: string;
  image_url?: string;
  terms?: string;
};

export default function PlaceDetailClient({ place, promotions = [] }: { place: PlaceSerializable; promotions?: Promotion[] }) {
  const router = useRouter();
  const [galleryOpen, setGalleryOpen] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });
  const [videoOpen, setVideoOpen] = useState<{ open: boolean; src?: string }>({ open: false });
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  // Keep a very flexible reference to the map. We'll cast locally when needed.
  const mapRef = useRef<unknown>(null);
  
  // Rating promedio state
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [totalReviews, setTotalReviews] = useState(0);

  // Track if we've already narrated this place
  const hasNarratedRef = useRef(false);

  const openGallery = (index = 0) => setGalleryOpen({ open: true, index });
  const closeGallery = () => setGalleryOpen({ open: false, index: 0 });
  const openVideo = (src?: string) => setVideoOpen({ open: true, src });
  const closeVideo = () => setVideoOpen({ open: false, src: undefined });

  // Narrate place description on load
  useEffect(() => {
    if (place.name && !hasNarratedRef.current) {
      hasNarratedRef.current = true;
      
      const checkForPendingNarration = (retryCount = 0) => {
        console.log('PlaceDetailClient: Checking for pending narration, retry:', retryCount);
        
        // Check if there's a pending narration from ChatInterface navigation
        let narrationText = '';
        let hasPendingNarration = false;
        
        try {
          const narratingPlace = localStorage.getItem('santi:narratingPlace');
          const narratingTextStored = localStorage.getItem('santi:narratingText');
          
          console.log('PlaceDetailClient: Storage check:', {
            narratingPlace,
            currentPlaceId: place.id,
            hasStoredText: !!narratingTextStored
          });
          
          if (narratingPlace === place.id && narratingTextStored) {
            narrationText = narratingTextStored;
            hasPendingNarration = true;
            // Clear the stored narration so it doesn't repeat on refresh
            localStorage.removeItem('santi:narratingPlace');
            localStorage.removeItem('santi:narratingText');
            console.log('PlaceDetailClient: Using pending narration from ChatInterface');
          }
        } catch (e) {
          console.warn('PlaceDetailClient: Could not access localStorage for narration', e);
        }
        
        // If no pending narration found and we haven't retried yet, try again after a short delay
        if (!hasPendingNarration && retryCount < 2) {
          console.log('PlaceDetailClient: No pending narration found, retrying in 100ms');
          setTimeout(() => checkForPendingNarration(retryCount + 1), 100);
          return;
        }
        
        // If no pending narration after retries, create default one
        if (!hasPendingNarration && place.description) {
          narrationText = `Aquí tienes más detalles sobre ${place.name}. ${place.description.slice(0, 200)}${place.description.length > 200 ? '...' : ''}`;
          console.log('PlaceDetailClient: Using default narration text');
        }
        
        // Only narrate if we have text
        if (narrationText) {
          console.log('PlaceDetailClient: Starting narration:', {
            textPreview: narrationText.substring(0, 50),
            hasPendingNarration,
            force: hasPendingNarration
          });
          
          // Add a small delay to ensure ChatInterface is mounted and listening
          setTimeout(() => {
            console.log('PlaceDetailClient: Dispatching narration event after delay');
            const event = new CustomEvent('santi:narrate', {
              detail: { 
                text: narrationText, 
                source: 'place-detail',
                force: hasPendingNarration // Force if it's a pending narration from ChatInterface
              }
            });
            window.dispatchEvent(event);
            console.log('PlaceDetailClient: Narration event dispatched successfully');
          }, 100); // Small delay to ensure ChatInterface is ready
        } else {
          console.log('PlaceDetailClient: No narration text available');
        }
      };
      
      // Start the narration check process
      checkForPendingNarration();
    }
  }, [place.id, place.name, place.description]);
  
  // Calculate average rating
  useEffect(() => {
    const fetchAverageRating = async () => {
      try {
        let query = supabase.from('user_reviews').select('rating').eq('is_public', true);

        if (place.isBusiness) {
          query = query.eq('business_id', place.id);
        } else {
          query = query.eq('attraction_id', place.id);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching ratings:', error);
          return;
        }

        if (data && data.length > 0) {
          const ratings = data.map(r => r.rating);
          const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
          setAverageRating(Math.round(average * 10) / 10); // Round to 1 decimal
          setTotalReviews(ratings.length);
        } else {
          setAverageRating(null);
          setTotalReviews(0);
        }
      } catch (error) {
        console.error('Error calculating average rating:', error);
      }
    };

    if (place.id) {
      fetchAverageRating();
    }
  }, [place.id, place.isBusiness]);

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      try { await navigator.share({ title: place.name, text: place.description?.slice(0, 140), url }); }
      catch { /* ignore */ }
    } else {
      await navigator.clipboard.writeText(url);
      alert('Enlace copiado al portapapeles');
    }
  };

  useEffect(() => {
    // Initialize mini map (client only)
    (async () => {
      console.log('🗺️ Mini map init - place:', place.name, 'lat:', place.lat, 'lng:', place.lng);
      if (!mapContainerRef.current || !place.lat || !place.lng) {
        console.log('🗺️ Mini map skipped - missing container or coordinates');
        return;
      }
      try {
        const mapboxgl = (await import('mapbox-gl')).default;
        mapboxgl.accessToken = (process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '').trim();
        if (!mapboxgl.accessToken) {
          console.warn('🗺️ Mapbox token not found');
          return;
        }
        if (mapRef.current) {
          console.log('🗺️ Mini map already exists');
          return;
        }

        console.log('🗺️ Creating mini map...');

        // Crear mapa
        const m = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [place.lng, place.lat],
          zoom: 14
        });

        // Esperar a que el mapa se cargue antes de agregar el marcador
        m.on('load', () => {
          console.log('🗺️ Mini map loaded, adding marker...');
          // Crear marcador con color personalizado
          const markerElement = document.createElement('div');
          markerElement.style.width = '30px';
          markerElement.style.height = '30px';
          markerElement.style.borderRadius = '50%';
          markerElement.style.backgroundColor = '#1A3A6C';
          markerElement.style.border = '3px solid white';
          markerElement.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';

          new mapboxgl.Marker({ element: markerElement })
            .setLngLat([place.lng!, place.lat!])
            .addTo(m);

          console.log('🗺️ Mini map marker added successfully');
        });

        mapRef.current = m as unknown;
      } catch (err) {
        console.warn('🗺️ Mini map could not be initialized', err);
      }
    })();

    return () => {
      if (mapRef.current) {
        try { (mapRef.current as { remove?: () => void })?.remove?.(); } catch {};
        mapRef.current = null;
      }
    };
  }, [place.lat, place.lng, place.name]);

  // Detectar parámetro openAR en la URL y navegar a página AR automáticamente
  useEffect(() => {
    if (typeof window !== 'undefined' && place.has_ar_content) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('openAR') === 'true') {
        router.push(`/ar/${place.id}`);
      }
    }
  }, [place.has_ar_content, place.id, router]);

  // Handlers para AR y QR
  const handleOpenAR = () => {
    if (place.has_ar_content) {
      router.push(`/ar/${place.id}`);
    }
  };

  const handleOpenQRScanner = () => {
    setQrScannerOpen(true);
  };

  const handleQRScanSuccess = async (qrCode: string) => {
    setQrScannerOpen(false);
    
    // Buscar atractivo por código QR
    try {
      const { data, error } = await supabase
        .from('attractions')
        .select('*')
        .eq('qr_code', qrCode)
        .single();

      if (error) throw error;

      if (data) {
        // Redirigir directamente a la página AR
        router.push(`/ar/${data.id}`);
      } else {
        alert('No se encontró un lugar con este código QR.');
      }
    } catch (error) {
      console.error('Error buscando atractivo por QR:', error);
      alert('Error al buscar el lugar. Intenta de nuevo.');
    }
  };


  return (
    <div style={{ padding: 6, maxWidth: 1000, margin: '0 auto' }}>
      
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes scaleIn {
            from {
              opacity: 0;
              transform: scale(0.9);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
          @keyframes slideInLeft {
            from {
              transform: translateX(-100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes pulse-ar-button {
            0%, 100% {
              box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }
            50% {
              box-shadow: 0 4px 20px rgba(102, 126, 234, 0.7);
            }
          }
          .hero-section {
            animation: fadeIn 0.6s ease-out;
          }
          .back-button {
            animation: slideDown 0.5s ease-out 0.1s both;
          }
          .description-section {
            animation: fadeInUp 0.6s ease-out 0.2s both;
          }
          .sidebar {
            animation: fadeInUp 0.6s ease-out 0.3s both;
          }
          .gallery-item {
            animation: scaleIn 0.4s ease-out both;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
          }
          .gallery-item:hover {
            transform: scale(1.05);
            box-shadow: 0 8px 20px rgba(0,0,0,0.15);
          }
          .card-section {
            transition: transform 0.3s ease, box-shadow 0.3s ease;
          }
          .card-section:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 35px rgba(0,0,0,0.12);
          }
          .btn-hover {
            transition: all 0.3s ease;
          }
          .btn-hover:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.15);
          }
          @media (max-width: 768px) {
            .place-detail-container {
              padding: 8px !important;
            }
            .hero-section {
              height: 220px !important;
              border-radius: 12px !important;
            }
            .hero-title {
              font-size: 1.5rem !important;
            }
            .hero-content {
              left: 16px !important;
              bottom: 16px !important;
            }
            .main-grid {
              grid-template-columns: 1fr !important;
              gap: 10px !important;
            }
            .description-section {
              padding: 12px !important;
              font-size: 1rem !important;
              line-height: 1.7 !important;
            }
            .description-title {
              font-size: 1.3rem !important;
              margin-bottom: 10px !important;
            }
            .sidebar {
              display: flex !important;
              flex-direction: column !important;
              gap: 8px !important;
              margin-top: 0 !important;
              width: 100% !important;
            }
            .sidebar-card {
              padding: 10px !important;
            }
            .gallery-grid {
              grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)) !important;
              gap: 6px !important;
            }
            .video-container {
              min-width: 160px !important;
              height: 90px !important;
            }
            .promotion-item {
              flex-direction: column !important;
              text-align: center;
              padding: 10px !important;
            }
            .promotion-image {
              width: 100% !important;
              height: 100px !important;
            }
            .modal-content {
              width: 95% !important;
              height: 85% !important;
            }
            .back-button {
              padding: 8px 12px !important;
              font-size: 0.9rem !important;
            }
          }
          @media (min-width: 769px) {
            .sidebar {
              max-width: 300px;
            }
          }
        `
      }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 18 }} className="place-detail-container">
        {/* Hero */}
        <div style={{ position: 'relative', height: 380, borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.15)' }} className="hero-section">
          <Image src={place.image_url || 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1768455560/istockphoto-1063378272-612x612_vby7gq.jpg'} alt={place.name} fill style={{ objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)' }} />
          
          {/* Botón Volver en el Hero */}
          <button
            onClick={() => window.history.back()}
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: 20,
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
              zIndex: 2,
            }}
            className="btn-hover"
          >
            <span style={{ fontSize: '1.1rem' }}>←</span>
            <span>Volver</span>
          </button>
          
          {/* Botones de AR y QR Scanner en la esquina superior derecha */}
          <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8, zIndex: 2 }}>
            {/* Botón Escanear QR */}
            <button
              onClick={handleOpenQRScanner}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 14px',
                background: 'rgba(255, 193, 7, 0.25)',
                backdropFilter: 'blur(10px)',
                color: 'white',
                border: '1px solid rgba(255, 193, 7, 0.5)',
                borderRadius: 20,
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(255, 193, 7, 0.3)',
                gap: 6,
              }}
              className="btn-hover"
              title="Escanear código QR"
            >
              <span style={{ fontSize: '1.2rem' }}>📷</span>
              <span>QR</span>
            </button>

            {/* Botón Ver en AR - solo si tiene contenido AR */}
            {place.has_ar_content && (
              <button
                onClick={handleOpenAR}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 14px',
                  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%)',
                  backdropFilter: 'blur(10px)',
                  color: 'white',
                  border: '1px solid rgba(102, 126, 234, 0.6)',
                  borderRadius: 20,
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                  gap: 6,
                  animation: 'pulse-ar-button 2s infinite',
                }}
                className="btn-hover"
                title="Ver en Realidad Aumentada"
              >
                <span style={{ fontSize: '1.2rem' }}>🥽</span>
                <span>Ver en AR</span>
              </button>
            )}
          </div>
          
          <div style={{ position: 'absolute', left: 24, bottom: 20, color: 'white', textShadow: '0 4px 20px rgba(0,0,0,0.8)', zIndex: 1 }} className="hero-content">
            <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.5px' }} className="hero-title">{place.name}</h1>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {place.category && <span style={{ background: 'rgba(255,255,255,0.95)', color: '#1A3A6C', padding: '6px 12px', borderRadius: 20, fontWeight: 700, fontSize: '0.85rem', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>{place.category}</span>}
              <button onClick={handleShare} className="btn-hover" style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(10px)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>Compartir</button>
              {place.lat && place.lng && (
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`} target="_blank" rel="noreferrer">
                  <button className="btn-hover" style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(10px)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
                    <span>🗺️</span>
                    <span>Google Maps</span>
                  </button>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Main Info / Side panel */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }} className="main-grid">
          <div style={{ background: 'white', padding: 20, borderRadius: 14, boxShadow: '0 8px 25px rgba(0,0,0,0.08)' }} className="description-section card-section">
            <h2 style={{ marginTop: 0, color: '#1A3A6C' }} className="description-title">Descripción</h2>
            <p style={{ color: '#333', lineHeight: 1.7 }}>{place.description || 'No hay descripción disponible.'}</p>

            {/* Gallery Thumbnails */}
            {place.gallery_urls && place.gallery_urls.length > 0 && (
              <section style={{ marginTop: 18 }}>
                <h3 style={{ margin: 0, marginBottom: 10, color: '#1A3A6C', fontSize: '1.1rem' }}>Galería</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }} className="gallery-grid">
                  {place.gallery_urls.map((u, i) => (
                    <div key={i} onClick={() => openGallery(i)} style={{ cursor: 'pointer', borderRadius: 10, overflow: 'hidden', height: 100, position: 'relative', animationDelay: `${i * 0.05}s` }} className="gallery-item">
                      <Image src={u} alt={`${place.name} foto ${i + 1}`} fill style={{ objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Videos */}
            {place.video_urls && place.video_urls.length > 0 && (
              <section style={{ marginTop: 20 }}>
                <h3 style={{ margin: 0, marginBottom: 10, color: '#1A3A6C', fontSize: '1.1rem' }}>Videos</h3>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
                  {place.video_urls.map((v, i) => (
                    <div key={i} style={{ minWidth: 220, height: 130, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', position: 'relative' }} className="video-container" onClick={() => openVideo(v)}>
                      <video src={v} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ background: 'rgba(0,0,0,0.4)', padding: 10, borderRadius: 999 }}>&#9658;</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Promotions */}
            {promotions && promotions.length > 0 && (
              <section style={{ marginTop: 18 }}>
                <h3 style={{ margin: 0, marginBottom: 8 }}>Promociones</h3>
                <div style={{ display: 'grid', gap: 12 }}>
                  {promotions.map(p => (
                    <div key={p.id} style={{ display: 'flex', gap: 12, background: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', boxShadow: '0 6px 20px rgba(0,0,0,0.06)' }} className="promotion-item">
                      {p.image_url && <div style={{ width: 120, height: 80, position: 'relative', borderRadius: 8, overflow: 'hidden' }} className="promotion-image"><Image src={p.image_url} alt={p.title || 'Promo'} fill style={{ objectFit: 'cover' }} /></div>}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800 }}>{p.title}</div>
                        <div style={{ color: '#666' }}>{p.description}</div>
                        {p.terms && <div style={{ marginTop: 8, fontSize: '0.85rem', color: '#999' }}>Términos: {p.terms}</div>}
                      </div>
                      <div>
                        <button style={{ background: '#F1C40F', border: 'none', padding: '8px 12px', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}>Ver Promo</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Reviews for this place */}
            <section style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>Experiencias de visitantes</h3>
                {averageRating !== null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#F1C40F', color: '#1A3A6C', padding: '4px 8px', borderRadius: 8, fontSize: '0.9rem', fontWeight: 700 }}>
                    ⭐ {averageRating} ({totalReviews} reseñas)
                  </div>
                )}
              </div>
              <UserReviewsGallery placeId={place.id} isBusiness={!!place.isBusiness} />
            </section>

          </div>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }} className="sidebar">
            <div style={{ background: 'white', padding: 16, borderRadius: 14, boxShadow: '0 6px 20px rgba(0,0,0,0.06)' }} className="sidebar-card card-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: '#666' }}>{place.isBusiness ? 'Negocio' : 'Atractivo'}</div>
                <div style={{ fontSize: 12, color: '#666' }}>{place.category}</div>
              </div>
              {place.contact_info && <div style={{ marginTop: 12 }}><strong>Contacto:</strong><br /> <a href={`tel:${place.contact_info}`} style={{ color: '#1A3A6C', fontWeight: 700 }}>{place.contact_info}</a></div>}
              {place.website_url && <div style={{ marginTop: 8 }}><a href={place.website_url} target="_blank" rel="noreferrer" style={{ color: '#1A3A6C', fontWeight: 700 }}>Visitar sitio web</a></div>}

              {place.isBusiness && (
                <div style={{ marginTop: 12 }}>
                  <button className="btn-hover" style={{ width: '100%', padding: '12px 14px', background: 'linear-gradient(135deg, #1A3A6C 0%, #2C5AA0 100%)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(26, 58, 108, 0.25)' }}>Contactar/Reservar</button>
                </div>
              )}

              {/* Mini map */}
              {place.lat && place.lng && (
                <div style={{ marginTop: 12 }}>
                  <div ref={mapContainerRef} id={`place-mini-map-${place.id}`} style={{ width: '100%', height: 160, borderRadius: 10, overflow: 'hidden' }} className="mini-map" />
                </div>
              )}
            </div>

            {/* Quick Highlights */}
            <div style={{ background: 'white', padding: 16, borderRadius: 14, boxShadow: '0 6px 20px rgba(0,0,0,0.06)' }} className="sidebar-card card-section">
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Aspectos Destacados</div>
              <ul style={{ paddingLeft: 18, color: '#444' }}>
                <li>Recomendado para turistas</li>
                <li>Acceso y estacionamiento</li>
                <li>Opciones gastronómicas cercanas</li>
              </ul>
            </div>

          </aside>
        </div>
      </div>

      {/* Gallery Modal */}
      {galleryOpen.open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={closeGallery}>
          <div style={{ width: '90%', maxWidth: 1100, height: '80%', position: 'relative' }} className="modal-content" onClick={(e) => e.stopPropagation()}>
            <Image src={place.gallery_urls?.[galleryOpen.index] || place.image_url || ''} alt="Galería" fill style={{ objectFit: 'contain' }} />
            <button onClick={() => setGalleryOpen(g => ({ ...g, index: Math.max(0, g.index - 1) }))} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.9)', border: 'none', padding: 10, borderRadius: 999 }}>&lt;</button>
            <button onClick={() => setGalleryOpen(g => ({ ...g, index: Math.min((place.gallery_urls?.length || 1) - 1, g.index + 1) }))} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.9)', border: 'none', padding: 10, borderRadius: 999 }}>&gt;</button>
            <button onClick={closeGallery} style={{ position: 'absolute', right: 10, top: 10, background: 'rgba(255,255,255,0.9)', border: 'none', padding: 8, borderRadius: 8 }}>Cerrar</button>
          </div>
        </div>
      )}

      {/* Video Modal */}
      {videoOpen.open && videoOpen.src && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={closeVideo}>
          <div style={{ width: '90%', maxWidth: 1000, height: '70%', position: 'relative' }} className="modal-content" onClick={(e) => e.stopPropagation()}>
            <video src={videoOpen.src} controls style={{ width: '100%', height: '100%', background: '#000' }} />
            <button onClick={closeVideo} style={{ position: 'absolute', right: 10, top: 10, background: 'rgba(255,255,255,0.9)', border: 'none', padding: 8, borderRadius: 8 }}>Cerrar</button>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {qrScannerOpen && (
        <QRScanner
          onScanSuccess={handleQRScanSuccess}
          onScanError={(error) => {
            console.error('Error escaneando QR:', error);
            alert(`Error al escanear: ${error}`);
          }}
          onClose={() => setQrScannerOpen(false)}
        />
      )}

    </div>
  );
}
