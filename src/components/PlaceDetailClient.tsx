"use client";
import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import UserReviewsGallery from './UserReviewsGallery';
import { supabase } from '@/lib/supabase';

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
};

type Promotion = {
  id: string;
  title?: string;
  description?: string;
  image_url?: string;
  terms?: string;
};

export default function PlaceDetailClient({ place, promotions = [] }: { place: PlaceSerializable; promotions?: Promotion[] }) {
  const [galleryOpen, setGalleryOpen] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });
  const [videoOpen, setVideoOpen] = useState<{ open: boolean; src?: string }>({ open: false });
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
      if (!mapContainerRef.current || !place.lat || !place.lng) return;
      try {
        const mapboxgl = (await import('mapbox-gl')).default;
        mapboxgl.accessToken = (process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '').trim();
        if (!mapboxgl.accessToken) return;
        if (mapRef.current) return;
        const m = new mapboxgl.Map({ container: mapContainerRef.current, style: 'mapbox://styles/mapbox/streets-v12', center: [place.lng, place.lat], zoom: 14 });
        new mapboxgl.Marker().setLngLat([place.lng, place.lat]).addTo(m);
        mapRef.current = m as unknown;
      } catch (err) { console.warn('Mini map could not be initialized', err); }
    })();

    return () => {
      if (mapRef.current) {
        try { (mapRef.current as { remove?: () => void })?.remove?.(); } catch {};
        mapRef.current = null;
      }
    };
  }, [place.lat, place.lng]);


  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      
      <style dangerouslySetInnerHTML={{
        __html: `
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
          @media (max-width: 768px) {
            .place-detail-container {
              padding: 16px 12px !important;
            }
            .hero-section {
              height: 300px !important;
            }
            .hero-title {
              font-size: 1.8rem !important;
            }
            .main-grid {
              grid-template-columns: 1fr !important;
              gap: 12px !important;
            }
            .sidebar {
              display: flex !important;
              flex-direction: column !important;
              gap: 12px !important;
              margin-top: 20px !important;
              width: 100% !important;
            }
            .gallery-grid {
              grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)) !important;
            }
            .video-container {
              min-width: 180px !important;
              height: 100px !important;
            }
            .promotion-item {
              flex-direction: column !important;
              text-align: center;
            }
            .promotion-image {
              width: 100% !important;
              height: 120px !important;
            }
            .modal-content {
              width: 95% !important;
              height: 85% !important;
            }
            .narrating-modal {
              left: 16px !important;
              bottom: 16px !important;
              max-width: calc(100vw - 32px) !important;
              padding: 16px !important;
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
        <div style={{ position: 'relative', height: 520, borderRadius: 16, overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.15)' }} className="hero-section">
          <Image src={place.image_url || 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1768455560/istockphoto-1063378272-612x612_vby7gq.jpg'} alt={place.name} fill style={{ objectFit: 'cover' }} />
          <div style={{ position: 'absolute', left: 24, bottom: 24, color: 'white', textShadow: '0 6px 28px rgba(0,0,0,0.6)' }}>
            <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 900 }} className="hero-title">{place.name}</h1>
            <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {place.category && <span style={{ background: 'rgba(255,255,255,0.9)', color: '#1A3A6C', padding: '6px 10px', borderRadius: 10, fontWeight: 700 }}>{place.category}</span>}
              <button onClick={handleShare} style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.45)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>Compartir</button>
              {place.lat && place.lng && (
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`} target="_blank" rel="noreferrer">
                  <button style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.45)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    🗺️ Google Maps
                  </button>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Main Info / Side panel */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }} className="main-grid">
          <div style={{ background: 'white', padding: 18, borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
            <h2 style={{ marginTop: 0, color: '#1A3A6C' }}>Descripción</h2>
            <p style={{ color: '#333', lineHeight: 1.7 }}>{place.description || 'No hay descripción disponible.'}</p>

            {/* Gallery Thumbnails */}
            {place.gallery_urls && place.gallery_urls.length > 0 && (
              <section style={{ marginTop: 18 }}>
                <h3 style={{ margin: 0, marginBottom: 8 }}>Galería</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }} className="gallery-grid">
                  {place.gallery_urls.map((u, i) => (
                    <div key={i} onClick={() => openGallery(i)} style={{ cursor: 'pointer', borderRadius: 8, overflow: 'hidden', height: 100, position: 'relative' }}>
                      <Image src={u} alt={`${place.name} foto ${i + 1}`} fill style={{ objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Videos */}
            {place.video_urls && place.video_urls.length > 0 && (
              <section style={{ marginTop: 18 }}>
                <h3 style={{ margin: 0, marginBottom: 8 }}>Videos</h3>
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
            <div style={{ background: 'white', padding: 16, borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: '#666' }}>{place.isBusiness ? 'Negocio' : 'Atractivo'}</div>
                <div style={{ fontSize: 12, color: '#666' }}>{place.category}</div>
              </div>
              {place.contact_info && <div style={{ marginTop: 12 }}><strong>Contacto:</strong><br /> <a href={`tel:${place.contact_info}`} style={{ color: '#1A3A6C', fontWeight: 700 }}>{place.contact_info}</a></div>}
              {place.website_url && <div style={{ marginTop: 8 }}><a href={place.website_url} target="_blank" rel="noreferrer" style={{ color: '#1A3A6C', fontWeight: 700 }}>Visitar sitio web</a></div>}

              {place.isBusiness && (
                <div style={{ marginTop: 12 }}>
                  <button style={{ width: '100%', padding: '12px 14px', background: '#1A3A6C', color: 'white', border: 'none', borderRadius: 10, fontWeight: 800 }}>Contactar/Reservar</button>
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
            <div style={{ background: 'white', padding: 16, borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}>
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

    </div>
  );
}
