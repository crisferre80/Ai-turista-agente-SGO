"use client";
import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import UserReviewsGallery from './UserReviewsGallery';

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
  
  // Santi narration state
  const [santiNarrating, setSantiNarrating] = useState(false);
  const [santiText, setSantiText] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false); // Track if audio is already playing to avoid duplicates
  const hasPlayedRef = useRef(false); // Track if we've already played audio for this page load
  const isEndingRef = useRef(false); // Track if narration end event is already in progress to prevent loops

  const openGallery = (index = 0) => setGalleryOpen({ open: true, index });
  const closeGallery = () => setGalleryOpen({ open: false, index: 0 });
  const openVideo = (src?: string) => setVideoOpen({ open: true, src });
  const closeVideo = () => setVideoOpen({ open: false, src: undefined });
  
  // Check if we arrived here while Santi is narrating
  useEffect(() => {
    // Safe storage getters/setters
    const getStorage = (key: string): string | null => {
      try {
        return localStorage.getItem(key);
      } catch {
        try {
          return sessionStorage.getItem(key);
        } catch {
          return null;
        }
      }
    };
    
    const removeStorage = (key: string) => {
      try {
        localStorage.removeItem(key);
      } catch {
        try {
          sessionStorage.removeItem(key);
        } catch {
          // Silent fail
        }
      }
    };
    
    const handleNarrationStart = (e: Event) => {
      const customEvent = e as CustomEvent;
      const text = customEvent.detail?.text || '';
      console.log('PlaceDetailClient: Narration start event received', text);
      setSantiText(text);
      setSantiNarrating(true);
    };
    
    const handleNarrationEnd = () => {
      // Prevent loop: if already ending, ignore this call
      if (isEndingRef.current) {
        console.log('PlaceDetailClient: Narration end already in progress, ignoring');
        return;
      }
      
      isEndingRef.current = true;
      console.log('PlaceDetailClient: Narration end event received');
      setSantiNarrating(false);
      isPlayingRef.current = false; // Reset playing flag
      
      // Clean up storage
      removeStorage('santi:narratingPlace');
      removeStorage('santi:narratingText');
      
      // Stop local audio if playing, but DON'T clear src (causes onerror loop)
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          // Don't set src to '' - it causes an error event that triggers this again
        } catch {
          // Ignore cleanup errors
        }
      }
      
      // Reset ending flag after a small delay
      setTimeout(() => {
        isEndingRef.current = false;
      }, 100);
    };
    
    // Function to play audio locally
    const playLocalAudio = async (text: string) => {
      // Prevent duplicate playback
      if (isPlayingRef.current) {
        console.log('PlaceDetailClient: Audio already playing, skipping duplicate request');
        return;
      }
      
      isPlayingRef.current = true;
      
      try {
        console.log('PlaceDetailClient: Requesting audio for:', text.substring(0, 50));
        
        // Emit start event BEFORE fetching audio so modal disappears promptly
        window.dispatchEvent(new CustomEvent('santi:narration:start', { detail: { text } }));
        
        const response = await fetch('/api/speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });

        if (!response.ok) {
          console.error('PlaceDetailClient: Audio generation failed', response.status, response.statusText);
          isPlayingRef.current = false;
          window.dispatchEvent(new CustomEvent('santi:narration:end'));
          return;
        }

        const blob = await response.blob();
        console.log('PlaceDetailClient: Blob received:', {
          size: blob.size,
          type: blob.type
        });
        
        if (blob.size === 0) {
          console.error('PlaceDetailClient: Empty blob received');
          isPlayingRef.current = false;
          window.dispatchEvent(new CustomEvent('santi:narration:end'));
          return;
        }
        
        const url = URL.createObjectURL(blob);
        console.log('PlaceDetailClient: Audio blob URL created:', url);

        if (!audioRef.current) {
          audioRef.current = new Audio();
        }
        
        // Clean up old audio but don't clear src yet
        if (audioRef.current.src && audioRef.current.src.startsWith('blob:')) {
          try {
            const oldSrc = audioRef.current.src;
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            URL.revokeObjectURL(oldSrc);
          } catch {
            // Ignore cleanup errors
          }
        }
        
        // Set new source
        audioRef.current.src = url;
        console.log('PlaceDetailClient: Audio src set to:', audioRef.current.src);
        
        audioRef.current.onended = () => {
          console.log('PlaceDetailClient: Audio ended');
          isPlayingRef.current = false;
          window.dispatchEvent(new CustomEvent('santi:narration:end'));
          URL.revokeObjectURL(url);
        };
        
        audioRef.current.onerror = (e) => {
          // Prevent loop: don't dispatch end event if already ending
          if (isEndingRef.current) {
            console.log('PlaceDetailClient: Audio error during end event, ignoring to prevent loop');
            return;
          }
          
          console.error('PlaceDetailClient: Audio onerror triggered');
          console.error('PlaceDetailClient: Event:', e);
          
          try {
            const event = e as Event;
            const target = event?.target as HTMLAudioElement | null;
            const error = target?.error;
            
            console.error('PlaceDetailClient: Audio error details', {
              hasTarget: !!target,
              hasError: !!error,
              code: error?.code,
              message: error?.message,
              networkState: target?.networkState,
              readyState: target?.readyState,
              src: target?.src,
              currentSrc: target?.currentSrc
            });
          } catch (logError) {
            console.error('PlaceDetailClient: Error while logging audio error:', logError);
          }
          
          isPlayingRef.current = false;
          window.dispatchEvent(new CustomEvent('santi:narration:end'));
          try {
            URL.revokeObjectURL(url);
          } catch {
            // Ignore revoke errors
          }
        };
        
        // Add load event to debug loading
        audioRef.current.onloadstart = () => {
          console.log('PlaceDetailClient: Audio loading started');
        };
        
        audioRef.current.oncanplay = () => {
          console.log('PlaceDetailClient: Audio can play');
        };
        
        try {
          console.log('PlaceDetailClient: Attempting to play audio...');
          const playPromise = audioRef.current.play();
          await playPromise;
          console.log('PlaceDetailClient: Audio playing successfully');
        } catch (playError) {
          console.error('PlaceDetailClient: Play() failed:', playError);
          console.error('PlaceDetailClient: Audio element state:', {
            src: audioRef.current.src,
            currentSrc: audioRef.current.currentSrc,
            readyState: audioRef.current.readyState,
            networkState: audioRef.current.networkState,
            paused: audioRef.current.paused,
            error: audioRef.current.error
          });
          isPlayingRef.current = false;
          window.dispatchEvent(new CustomEvent('santi:narration:end'));
          URL.revokeObjectURL(url);
          return;
        }
        
      } catch (error) {
        console.error('PlaceDetailClient: Error playing audio', error);
        isPlayingRef.current = false;
        window.dispatchEvent(new CustomEvent('santi:narration:end'));
      }
    };
    
    // Listen for narration events
    window.addEventListener('santi:narration:start', handleNarrationStart);
    window.addEventListener('santi:narration:end', handleNarrationEnd);
    
    // Check if we're in the middle of a narration - activate immediately
    const narratingPlace = getStorage('santi:narratingPlace');
    const narratingText = getStorage('santi:narratingText');
    
    console.log('PlaceDetailClient: Checking storage', { narratingPlace, placeId: place.id, narratingText, hasPlayed: hasPlayedRef.current });
    
    // Only play once per page load
    if (narratingPlace === place.id && narratingText && !hasPlayedRef.current) {
      console.log('PlaceDetailClient: Activating narration from storage');
      hasPlayedRef.current = true; // Mark as played immediately
      setSantiText(narratingText);
      setSantiNarrating(true);
      
      // Play audio locally since we're on a new page
      playLocalAudio(narratingText);
    }
    
    return () => {
      window.removeEventListener('santi:narration:start', handleNarrationStart);
      window.removeEventListener('santi:narration:end', handleNarrationEnd);
      
      // Reset played flag on unmount
      hasPlayedRef.current = false;
      
      // Cleanup audio on unmount
      isPlayingRef.current = false;
      isEndingRef.current = false;
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          // Don't clear src on unmount either - just pause
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, [place.id]);

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

  const initRoute = async () => {
    if (!navigator.geolocation) { alert('Tu navegador no soporta geolocalización'); return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const userLng = pos.coords.longitude;
      const userLat = pos.coords.latitude;
      try {
        const token = (process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '').trim();
        if (!token) { alert('MAPBOX token no disponible'); return; }
        const q = `https://api.mapbox.com/directions/v5/mapbox/driving/${userLng},${userLat};${place.lng},${place.lat}?geometries=geojson&access_token=${token}`;
        const r = await fetch(q);
        const j = await r.json();
        if (!j.routes || j.routes.length === 0) { alert('No se encontró ruta'); return; }
        const coords = j.routes[0].geometry.coordinates;
        if (!mapRef.current) return;
        // Update or add geojson route source (cast to any for small localized operation)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mr = mapRef.current as any;
        if (mr?.getSource && mr.getSource('route')) {
          mr.getSource('route')?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords } });
        } else if (mr?.addSource) {
          mr.addSource('route', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } } });
          mr.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#007cbf', 'line-width': 6 } });
        }

        // Calculate simple bounds from coords without using mapbox types
        const lons = coords.map((c: [number, number]) => c[0]);
        const lats = coords.map((c: [number, number]) => c[1]);
        const minLng = Math.min(...lons);
        const maxLng = Math.max(...lons);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapRef.current as any)?.fitBounds?.([[minLng, minLat], [maxLng, maxLat]], { padding: 60, duration: 1200 });
      } catch (err) { console.error('Error calculando ruta', err); alert('No pude calcular la ruta'); }
    }, () => { alert('Permite compartir ubicación para calcular la ruta'); });
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Santi narrating UI */}
      {santiNarrating && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          left: 24,
          zIndex: 9999,
          background: 'linear-gradient(135deg, #1A3A6C 0%, #2d5a9c 100%)',
          borderRadius: 16,
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          display: 'flex',
          gap: 16,
          padding: 20,
          alignItems: 'center',
          maxWidth: 480,
          animation: 'slideInLeft 0.5s ease-out'
        }}>
          <div style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: '#F1C40F',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            flexShrink: 0,
            animation: 'pulse 1.5s ease-in-out infinite'
          }}>
            🤖
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, color: '#F1C40F', marginBottom: 4 }}>Santi está narrando</div>
            <div style={{ color: 'white', fontSize: '0.95rem', lineHeight: 1.4 }}>
              {santiText.substring(0, 150)}{santiText.length > 150 ? '...' : ''}
            </div>
          </div>
        </div>
      )}
      
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
          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.1);
            }
          }
        `
      }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 18 }}>
        {/* Hero */}
        <div style={{ position: 'relative', height: 520, borderRadius: 16, overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.15)' }}>
          <Image src={place.image_url || 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1768455560/istockphoto-1063378272-612x612_vby7gq.jpg'} alt={place.name} fill style={{ objectFit: 'cover' }} />
          <div style={{ position: 'absolute', left: 24, bottom: 24, color: 'white', textShadow: '0 6px 28px rgba(0,0,0,0.6)' }}>
            <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 900 }}>{place.name}</h1>
            <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
              {place.category && <span style={{ background: 'rgba(255,255,255,0.9)', color: '#1A3A6C', padding: '6px 10px', borderRadius: 10, fontWeight: 700 }}>{place.category}</span>}
              <button onClick={handleShare} style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.45)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>Compartir</button>
            </div>
          </div>
        </div>

        {/* Main Info / Side panel */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>
          <div style={{ background: 'white', padding: 18, borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
            <h2 style={{ marginTop: 0, color: '#1A3A6C' }}>Descripción</h2>
            <p style={{ color: '#333', lineHeight: 1.7 }}>{place.description || 'No hay descripción disponible.'}</p>

            {/* Gallery Thumbnails */}
            {place.gallery_urls && place.gallery_urls.length > 0 && (
              <section style={{ marginTop: 18 }}>
                <h3 style={{ margin: 0, marginBottom: 8 }}>Galería</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
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
                    <div key={i} style={{ minWidth: 220, height: 130, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', position: 'relative' }} onClick={() => openVideo(v)}>
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
                    <div key={p.id} style={{ display: 'flex', gap: 12, background: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', boxShadow: '0 6px 20px rgba(0,0,0,0.06)' }}>
                      {p.image_url && <div style={{ width: 120, height: 80, position: 'relative', borderRadius: 8, overflow: 'hidden' }}><Image src={p.image_url} alt={p.title || 'Promo'} fill style={{ objectFit: 'cover' }} /></div>}
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
              <h3 style={{ margin: 0, marginBottom: 8 }}>Experiencias de visitantes</h3>
              <UserReviewsGallery placeId={place.id} isBusiness={!!place.isBusiness} />
            </section>

          </div>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'white', padding: 16, borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: '#666' }}>{place.isBusiness ? 'Negocio' : 'Atractivo'}</div>
                <div style={{ fontSize: 12, color: '#666' }}>{place.category}</div>
              </div>
              {place.contact_info && <div style={{ marginTop: 12 }}><strong>Contacto:</strong><br /> <a href={`tel:${place.contact_info}`} style={{ color: '#1A3A6C', fontWeight: 700 }}>{place.contact_info}</a></div>}
              {place.website_url && <div style={{ marginTop: 8 }}><a href={place.website_url} target="_blank" rel="noreferrer" style={{ color: '#1A3A6C', fontWeight: 700 }}>Visitar sitio web</a></div>}

              <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                <a href={`https://www.google.com/maps/search/?api=1&query=${place.lat || ''},${place.lng || ''}`} target="_blank" rel="noreferrer"><button style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #eee', background: '#fff', cursor: 'pointer' }}>Ver en Mapas</button></a>
                <button onClick={() => { navigator.clipboard.writeText(window.location.href); alert('Enlace copiado'); }} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #eee', background: '#fff', cursor: 'pointer' }}>Copiar enlace</button>
              </div>

              {place.isBusiness && (
                <div style={{ marginTop: 12 }}>
                  <button style={{ width: '100%', padding: '12px 14px', background: '#1A3A6C', color: 'white', border: 'none', borderRadius: 10, fontWeight: 800 }}>Contactar/Reservar</button>
                </div>
              )}

              {/* Mini map */}
              {place.lat && place.lng && (
                <div style={{ marginTop: 12 }}>
                  <div id={`place-mini-map-${place.id}`} style={{ width: '100%', height: 160, borderRadius: 10, overflow: 'hidden' }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={() => initRoute()} style={{ padding: '8px 12px', borderRadius: 8, background: '#14b8a6', color: 'white', border: 'none' }}>Calcular ruta</button>
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`} target="_blank" rel="noreferrer"><button style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #eee' }}>Abrir en Google Maps</button></a>
                  </div>
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
          <div style={{ width: '90%', maxWidth: 1100, height: '80%', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
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
          <div style={{ width: '90%', maxWidth: 1000, height: '70%', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <video src={videoOpen.src} controls style={{ width: '100%', height: '100%', background: '#000' }} />
            <button onClick={closeVideo} style={{ position: 'absolute', right: 10, top: 10, background: 'rgba(255,255,255,0.9)', border: 'none', padding: 8, borderRadius: 8 }}>Cerrar</button>
          </div>
        </div>
      )}

    </div>
  );
}
