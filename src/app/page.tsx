"use client";
import React, { useEffect, useState } from 'react';
import Map from '@/components/Map';
import ChatInterface from '@/components/ChatInterface';
import IntroOverlay from '@/components/IntroOverlay';
import { supabase } from '@/lib/supabase';
import { santiSpeak, santiNarrate, stopSantiNarration } from '@/lib/speech';
import Image from 'next/image';
import Link from 'next/link';

// COLORS EXTRACTED FROM FLAG
const COLOR_RED = "#9E1B1B";
const COLOR_BLUE = "#1A3A6C";
const COLOR_GOLD = "#F1C40F";
const COLOR_WHITE = "#FFFFFF";
const INTRO_KEY = 'santi_visual_intro_seen_v2';

// Placeholder image for missing images
const IMG_PATTERN = 'https://via.placeholder.com/400x300?text=Imagen+no+disponible';

// Tipo para lugares/attractions
interface Attraction {
  id: string;
  name: string;
  image: string;
  description: string;
  coords: [number, number];
  isBusiness?: boolean;
  info?: string;
  category?: string;
  contact_info?: string;
  gallery_urls?: string[];
}

// Tipo para videos
interface Video {
  id: string;
  video_url: string;
  title: string;
  description?: string;
}

const GalleryCard = ({ title, img, onClick }: { title: string; img?: string; onClick: () => void }) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const cardWidth = isMobile ? 140 : 160;
  const cardHeight = isMobile ? 190 : 220;

  return (
    <div
      onClick={onClick}
      style={{
        flex: `0 0 ${cardWidth}px`,
        width: `${cardWidth}px`,
        height: `${cardHeight}px`,
        borderRadius: '20px',
        overflow: 'hidden',
        position: 'relative',
        cursor: 'pointer',
        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        boxShadow: '0 10px 20px rgba(0,0,0,0.3)',
        border: `2px solid ${COLOR_BLUE}44`
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-10px) scale(1.05)';
        e.currentTarget.style.boxShadow = `0 20px 40px ${COLOR_RED}44`;
        e.currentTarget.style.borderColor = COLOR_RED;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0) scale(1)';
        e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.3)';
        e.currentTarget.style.borderColor = `${COLOR_BLUE}44`;
      }}
    >
      <Image
        src={img || IMG_PATTERN}
        alt={title}
        width={cardWidth}
        height={cardHeight}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transition: 'transform 0.4s ease'
        }}
      />
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
        padding: isMobile ? '12px' : '15px',
        color: 'white'
      }}>
        <h4 style={{
          margin: 0,
          fontSize: isMobile ? '0.8rem' : '0.9rem',
          fontWeight: 'bold',
          lineHeight: '1.2',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>
          {title}
        </h4>
        <div style={{
          width: isMobile ? '16px' : '20px',
          height: '3px',
          background: COLOR_RED,
          marginTop: '6px',
          borderRadius: '2px'
        }} />
      </div>
    </div>
  );
};

const QuickActionBtn = ({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      background: 'rgba(255,255,255,0.9)',
      backdropFilter: 'blur(10px)',
      border: `2px solid ${COLOR_BLUE}33`,
      borderRadius: '24px',
      padding: '20px',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      color: COLOR_BLUE,
      boxShadow: `0 4px 15px rgba(0,0,0,0.1)`
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = COLOR_BLUE;
      e.currentTarget.style.borderColor = COLOR_GOLD;
      e.currentTarget.style.color = 'white';
      e.currentTarget.style.transform = 'translateY(-5px)';
      e.currentTarget.style.boxShadow = `0 10px 25px ${COLOR_BLUE}33`;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'rgba(255,255,255,0.9)';
      e.currentTarget.style.borderColor = `${COLOR_BLUE}33`;
      e.currentTarget.style.color = COLOR_BLUE;
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = `0 4px 15px rgba(0,0,0,0.1)`;
    }}
  >
    <span style={{ fontSize: '2.5rem', filter: `drop-shadow(0 0 10px ${COLOR_GOLD}44)` }}>{icon}</span>
    <span style={{ fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</span>
  </button>
);

// Header ESTILO REFERENCIA.PNG - oscuro limpio
const HeaderBar: React.FC = () => {
  const [pwaAvailable, setPwaAvailable] = useState(false);
  const [pwaInstalled, setPwaInstalled] = useState(false);

  useEffect(() => {
    type PwaDetail = { available?: boolean; installed?: boolean; showIosHint?: boolean };
    type SantIAPwaPromptResult = { outcome: 'accepted' | 'dismissed'; platform?: string };
    type SantIAPwaApi = { isAvailable?: () => boolean; isInstalled?: () => boolean; prompt?: () => Promise<SantIAPwaPromptResult | null>; closeIosHint?: () => void };

    const win = window as unknown as { __santIA_pwa?: SantIAPwaApi };
    const api = win.__santIA_pwa;
    if (api) {
      // defer to avoid synchronous setState inside effect
      setTimeout(() => {
        setPwaAvailable(!!api.isAvailable?.());
        setPwaInstalled(!!api.isInstalled?.());
      }, 0);
    }

    const handler = (e: Event) => {
      const custom = e as CustomEvent<PwaDetail>;
      const detail = custom?.detail || {};
      setTimeout(() => {
        setPwaAvailable(!!detail.available);
        setPwaInstalled(!!detail.installed);
      }, 0);
    };

    window.addEventListener('santIA-pwa', handler as EventListener);
    return () => window.removeEventListener('santIA-pwa', handler as EventListener);
  }, []);

  const handleInstallClick = async () => {
    type SantIAPwaPromptResult = { outcome: 'accepted' | 'dismissed'; platform?: string };
    const win = window as unknown as { __santIA_pwa?: { prompt?: () => Promise<SantIAPwaPromptResult | null> } };
    const api = win.__santIA_pwa;
    if (api && api.prompt) {
      await api.prompt();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: 70,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 40px',
      background: '#0e1f1d',
      borderBottom: `1px solid ${COLOR_GOLD}33`,
      zIndex: 5000,
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
        <div style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          overflow: 'hidden',
          display: 'grid',
          placeItems: 'center',
          boxShadow: `0 4px 12px ${COLOR_GOLD}44`,
          border: `2px solid ${COLOR_WHITE}`
        }}>
          <Image
            src="/santi-avatar.png"
            alt="Santi"
            width={42}
            height={42}
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.05) translateY(1px)' }}
          />
        </div>
        <div style={{ 
          color: COLOR_WHITE, 
          fontWeight: 900, 
          fontSize: '1.1rem',
          letterSpacing: 0.5 
        }}>
          Santi IA
        </div>
      </div>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/explorar" style={{ 
          color: COLOR_WHITE, 
          textDecoration: 'none', 
          fontWeight: 600,
          transition: 'color 0.2s'
        }}>
          Explorar
        </Link>
        <Link href="/login" style={{ 
          color: '#0e1f1d', 
          background: COLOR_GOLD, 
          padding: '10px 20px', 
          borderRadius: 8, 
          fontWeight: 800, 
          textDecoration: 'none',
          boxShadow: `0 4px 15px ${COLOR_GOLD}44`,
          transition: 'transform 0.2s'
        }}>
          Acreditación
        </Link>
        {pwaAvailable && !pwaInstalled && (
          <button onClick={handleInstallClick} style={{ background: '#fff', color: '#0e1f1d', padding: '8px 12px', borderRadius: 8, fontWeight: 800 }}>Instalar</button>
        )}
      </nav>
    </div>
  );
};

// Tarjeta destacada con animaciones modernas
const FeaturedCard = ({ title, img }: { title: string; img?: string }) => (
  <div className="featured-card" style={{
    position: 'relative',
    borderRadius: 24,
    overflow: 'hidden',
    background: '#0b1220',
    border: `1px solid ${COLOR_WHITE}14`,
    boxShadow: '0 15px 40px rgba(0,0,0,0.35)'
  }}>
    <div style={{ position: 'relative', width: '100%', paddingTop: '62%' }}>
      <Image
        src={img || IMG_PATTERN}
        alt={title}
        fill
        sizes="(max-width: 768px) 100vw, 33vw"
        style={{ objectFit: 'cover', filter: 'saturate(1.1) contrast(1.05) brightness(0.95)', transform: 'scale(1.02)' }}
      />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.75) 10%, rgba(0,0,0,0.15) 70%, transparent)',
        pointerEvents: 'none'
      }} />
    </div>
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h4 style={{ margin: 0, color: '#eef2ff', textShadow: '0 2px 10px rgba(0,0,0,0.6)', fontWeight: 900, letterSpacing: 0.3 }}>{title}</h4>
        <Link href="/explorar" style={{ background: COLOR_GOLD, color: '#0e1f1d', borderRadius: 999, padding: '8px 14px', fontWeight: 800, textDecoration: 'none', boxShadow: `0 10px 25px ${COLOR_GOLD}44` }}>Explorar</Link>
      </div>
    </div>
    <div className="featured-card__glow" style={{ position: 'absolute', inset: 0, borderRadius: 24, pointerEvents: 'none' }} />
  </div>
);

export default function Home() {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [filters, setFilters] = useState({ atracciones: true, alojamientos: true, gastronomia: true, cultura: true });
  const [narration] = useState<string | undefined>(undefined);
  const [activeStory, setActiveStory] = useState<{ url: string; name: string } | undefined>(undefined);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlace, setActivePlace] = useState<Attraction | null>(null);
  const [zoomImage, setZoomImage] = useState<string | undefined>(undefined);
  const [showIntro, setShowIntro] = useState(false);
  const [mapMenuOpen, setMapMenuOpen] = useState(false);
  const [carouselPhotos, setCarouselPhotos] = useState<string[]>([]);

  useEffect(() => {
    fetchData();

    // Check intro
    const introSeen = sessionStorage.getItem(INTRO_KEY);
    setShowIntro(!introSeen);

    // Check if we need to focus on a specific place
    const focusPlace = localStorage.getItem('focusPlace');
    if (focusPlace) {
      localStorage.removeItem('focusPlace');
      // Wait for map and data to load
      setTimeout(() => {
        if (typeof window !== 'undefined' && window.focusPlaceOnMap) {
          window.focusPlaceOnMap(focusPlace);
        }
      }, 2000);
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: attrs, error: attrsErr } = await supabase.from('attractions').select('*');
      if (attrsErr) console.warn('Attractions fetch error', attrsErr);

      const { data: vids, error: vidsErr } = await supabase.from('app_videos').select('*');
      if (vidsErr) console.warn('Videos fetch error', vidsErr);

      // Fetch businesses with explicit columns to avoid PostgREST errors when schema changes
      const { data: biz, error: bizErr } = await supabase
        .from('businesses')
        .select('id,name,website_url,contact_info,image_url,lat,lng,category,plan,is_active,payment_status');
      if (bizErr) console.warn('Businesses fetch error', bizErr);

      const { data: carousel, error: carouselErr } = await supabase.from('carousel_photos').select('image_url').eq('is_active', true).order('order_position');
      if (carouselErr) console.warn('Carousel fetch error', carouselErr);

      const mappedBiz = (biz || []).map(b => ({
        ...b,
        isBusiness: true,
        image: b.image_url,
        description: b.contact_info || b.category,
        coords: [b.lng, b.lat]
      }));

      const mappedAttrs = (attrs || []).map(a => ({
        ...a,
        isBusiness: false,
        image: a.image_url,
        info: a.info_extra,
        coords: [a.lng, a.lat]
      }));

      const allPlaces = [...mappedAttrs, ...mappedBiz];
      setAttractions(allPlaces);
      setVideos(vids || []);
      
      // Set carousel photos, fallback to static if empty
      const carouselUrls = carousel && carousel.length > 0 
        ? carousel.map((c: { image_url: string }) => c.image_url)
        : [
            '/fotos/ciudadsgo.jpg',
            '/fotos/dique.jfif',
            '/fotos/estadio.jpg',
            '/fotos/pergola.jpg',
            '/fotos/termas costanera.jpg',
            '/fotos/parqueencuentro1-1.jpeg',
            '/fotos/municapi_plazasarmiento.jpg',
            '/fotos/ccb.jpg',
            '/fotos/unnamed (1).jpg',
            '/fotos/unnamed (2).jpg'
          ];
      setCarouselPhotos(carouselUrls);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleNarration = (text: string, opts?: { source?: string, force?: boolean }) => {
    santiSpeak(text, opts);
  };

  // Expose helper to stop narration globally so other components (like Map) can prioritize route TTS
  useEffect(() => {
    try {
      (window as any).stopSantiNarration = stopSantiNarration;
    } catch {}
    return () => {
      try { if ((window as any).stopSantiNarration) delete (window as any).stopSantiNarration; } catch {}
    };
  }, []);

  // Map filtered attractions according to overlay filters
  const filteredAttractions = React.useMemo(() => {
    const anyOn = Object.values(filters).some(Boolean);
    if (!anyOn) return attractions; // si nada seleccionado, mostrar todo

    const includes = (value?: string, substr?: string) => (value || '').toLowerCase().includes((substr || '').toLowerCase());

    return attractions.filter(a => {
      const cat = a.category || '';
      const isBiz = !!a.isBusiness;

      const matchAtracciones = !isBiz;
      const matchAlojamientos = isBiz && (includes(cat, 'hotel') || includes(cat, 'aloj'));
      const matchGastronomia = (isBiz && (includes(cat, 'rest') || includes(cat, 'gastr'))) || (!isBiz && includes(cat, 'gastr'));
      const matchCultura = (!isBiz && (includes(cat, 'histor') || includes(cat, 'cultur'))) || (isBiz && includes(cat, 'artes'));

      return (
        (filters.atracciones && matchAtracciones) ||
        (filters.alojamientos && matchAlojamientos) ||
        (filters.gastronomia && matchGastronomia) ||
        (filters.cultura && matchCultura)
      );
    });
  }, [attractions, filters]);

  // Mostrar la intro primero, sobre cualquier otro contenido
  if (showIntro) {
    return (
      <IntroOverlay
        onComplete={() => {
          setShowIntro(false);
          sessionStorage.setItem(INTRO_KEY, 'true');
          setTimeout(() => {
            santiNarrate("¡Hola chango! Ya estoy listo para guiarte. ¡Bienvenido a Santiago!");
          }, 500);
        }}
      />
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: `url('/fotos/ciudadsgo.jpg') center/cover no-repeat fixed, linear-gradient(135deg, rgba(232, 244, 248, 0.85) 0%, rgba(254, 243, 224, 0.85) 100%)`,
      backgroundBlendMode: 'overlay',
      color: '#1e293b',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      <HeaderBar />
      
      {/* CONTENT WRAPPER */}
      <div style={{ 
        position: 'relative', 
        zIndex: 10, 
        padding: '90px clamp(20px, 5vw, 60px) 40px clamp(20px, 5vw, 60px)', 
        maxWidth: '1600px', 
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {/* CARRUSEL DE POSTALES DE LA PROVINCIA */}
        <section style={{
          marginTop: 20,
          marginBottom: 40,
          borderRadius: 10,
          overflow: 'hidden',
          position: 'relative',
          boxShadow: '0 25px 95px rgba(0,0,0,0.45)',
          background: 'white',
          padding: '10px',
          border: `2px solid ${COLOR_GOLD}22`
        }}>
          <h3 style={{
            margin: '0 0 5px 0',
            fontSize: '1.5rem',
            fontWeight: '950',
            color: COLOR_BLUE,
            letterSpacing: '-0.2px',
            textAlign: 'center'
          }}>📸 Postales de Santiago del Estero</h3>
          <div className="carousel-container" style={{
            position: 'relative',
            height: '280px',
            overflow: 'hidden',
            borderRadius: 0,
            width: '100vw',
            marginLeft: 'calc(50% - 50vw)',
            marginRight: 'calc(50% - 50vw)',
            background: 'transparent',
            boxShadow: 'none'
          }}>
            <div className="carousel-track" style={{
              display: 'flex',
              height: '100%',
              animation: 'carouselScroll 25s linear infinite'
            }}>
              {carouselPhotos.map((src, idx) => (
                <div key={idx} style={{
                  flex: '0 0 25%',
                  height: '100%',
                  padding: '0 8px',
                  boxSizing: 'border-box'
                }}>
                  <div style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    borderRadius: 0,
                    overflow: 'hidden',
                    boxShadow: 'none'
                  }}>
                    <Image
                      src={src}
                      alt={`Postal ${idx + 1}`}
                      fill
                      sizes="(max-width: 768px) 100vw, 24vw"
                      style={{
                        objectFit: 'cover'
                      }}
                    />
                  </div>
                </div>
              ))}
              {/* Duplicate for seamless loop */}
              {carouselPhotos.slice(0, Math.ceil(carouselPhotos.length / 2)).map((src, idx) => (
                <div key={`dup-${idx}`} style={{
                  flex: '0 0 25%',
                  height: '100%',
                  padding: '0 8px',
                  boxSizing: 'border-box'
                }}>
                  <div style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    borderRadius: 0,
                    overflow: 'hidden',
                    boxShadow: 'none'
                  }}>
                    <Image
                      src={src}
                      alt={`Postal ${idx + 1}`}
                      fill
                      sizes="(max-width: 568px) 100vw, 24vw"
                      style={{
                        objectFit: 'cover'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Responsive Styles Injection */}
        <style dangerouslySetInnerHTML={{
          __html: `
          @keyframes carouselScroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .carousel-container:hover .carousel-track {
            animation-play-state: paused;
          }
          .featured-card { transition: transform .3s ease, box-shadow .3s ease; }
          .featured-card:hover { transform: translateY(-6px); box-shadow: 0 25px 60px rgba(0,0,0,0.5); }
          .featured-card__glow { box-shadow: inset 0 0 0 0 rgba(241,196,15,0.0); transition: box-shadow .4s ease; }
          .featured-card:hover .featured-card__glow { box-shadow: inset 0 0 0 2px rgba(241,196,15,0.35); }
          .featured-card:hover img { transform: scale(1.06) !important; transition: transform .6s ease; }
          .multimedia-card { 
            padding: 40px; 
            border-radius: 40px; 
            width: 100%;
            box-sizing: border-box;
          }
          .scroll-container {
            display: flex;
            gap: 15px;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 20px;
            scrollbar-width: thin;
          }
          .scroll-container::-webkit-scrollbar {
            height: 6px;
          }
          .scroll-container::-webkit-scrollbar-thumb {
            background: ${COLOR_GOLD}44;
            border-radius: 10px;
          }
          .scroll-item {
            flex: 0 0 500px;
            scroll-snap-align: start;
          }
          @media (max-width: 768px) {
            .carousel-container { height: 140px !important; }
            .carousel-track { animation: carouselScroll 20s linear infinite !important; }
            .carousel-track > div { flex: 0 0 45% !important; padding: 0 6px !important; }
            section:has(.carousel-container) { padding: 15px !important; border-radius: 16px !important; }
            .multimedia-card { 
              padding: 24px 16px; 
              border-radius: 24px; 
              margin: 0;
              width: calc(100% + 10px);
              margin-left: -5px;
            }
            .scroll-item {
              flex: 0 0 85vw;
            }
            .scroll-container {
              gap: 15px;
              padding-bottom: 15px;
              margin: 0 -16px;
              padding-left: 16px;
              padding-right: 16px;
            }
            .multimedia-card h3 {
              font-size: 1.4rem !important;
              margin-bottom: 15px !important;
            }
            .hero-map { 
              height: 80vh !important;
            }
          }
        `}} />

        {/* HERO SECTION: THE MAP */}
        <section className="hero-map" style={{
          height: '65vh',
          width: '100%',
          position: 'relative',
          borderRadius: '32px',
          overflow: 'hidden',
          boxShadow: `0 30px 60px rgba(0,0,0,0.6)`,
          border: `2px solid ${COLOR_WHITE}22`,
          marginBottom: '40px'
        }}>
          {loading ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: 'white' }}>
              <div style={{ textAlign: 'center' }}>
                <div className="spinner" style={{ border: `4px solid ${COLOR_BLUE}22`, borderTop: `4px solid ${COLOR_GOLD}`, borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto 15px' }}></div>
                <p style={{ fontWeight: 'bold', fontSize: '1.2rem', color: COLOR_GOLD }}>Santi está desplegando el mapa...</p>
              </div>
            </div>
          ) : (
            <Map
              attractions={filteredAttractions}
              onNarrate={handleNarration}
              onStoryPlay={(url, name) => setActiveStory({ url, name })}
              onPlaceFocus={setActivePlace}
            />
          )}
          {/* Panel lateral EXPLORA mejorado */}
          {!mapMenuOpen ? (
            <div
              onClick={() => setMapMenuOpen(true)}
              title="Abrir opciones"
              style={{
                position: 'absolute',
                left: 20,
                top: 20,
                width: 58,
                height: 58,
                borderRadius: 12,
                background: '#0e1f1d',
                border: `2px solid ${COLOR_GOLD}`,
                display: 'grid',
                placeItems: 'center',
                color: COLOR_GOLD,
                cursor: 'pointer',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                zIndex: 5,
                fontSize: '1.5rem',
                fontWeight: 'bold'
              }}
            >
              ☰
            </div>
          ) : (
            <div style={{
              position: 'absolute',
              left: 20,
              top: 20,
              width: 280,
              background: 'white',
              borderRadius: 20,
              padding: 20,
              border: `2px solid ${COLOR_GOLD}`,
              color: '#1e293b',
              zIndex: 5,
              boxShadow: '0 15px 50px rgba(0,0,0,0.4)'
            }}>
              {/* Header del panel EXPLORA */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
                paddingBottom: 15,
                borderBottom: `2px solid ${COLOR_GOLD}44`
              }}>
                <h3 style={{ 
                  margin: 0, 
                  fontWeight: 900, 
                  fontSize: '1.3rem',
                  color: COLOR_BLUE 
                }}>
                  EXPLORA
                </h3>
                <button
                  onClick={() => setMapMenuOpen(false)}
                  aria-label="Cerrar panel"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    border: 'none',
                    background: COLOR_RED,
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '1.1rem',
                    fontWeight: 'bold'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Toggles estilo REFERENCIA */}
              {([
                { key: 'atracciones', label: 'Atracciones', icon: '📍' },
                { key: 'alojamientos', label: 'Alojamientos', icon: '🏨' },
                { key: 'gastronomia', label: 'Gastronomía', icon: '🍽️' },
                { key: 'cultura', label: 'Cultura', icon: '🎭' },
              ] as const).map((item) => {
                const active = filters[item.key];
                return (
                  <div key={item.key} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '12px 0',
                    borderBottom: '1px solid #f0f0f0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                      <span style={{ fontWeight: 600, color: '#334155' }}>{item.label}</span>
                    </div>
                    <div
                      onClick={() => setFilters(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                      style={{
                        width: 50,
                        height: 28,
                        borderRadius: 999,
                        background: active ? COLOR_GOLD : '#cbd5e1',
                        position: 'relative',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: active ? `0 4px 12px ${COLOR_GOLD}66` : 'none'
                      }}
                    >
                      <div style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: 'white',
                        position: 'absolute',
                        top: 3,
                        left: active ? 25 : 3,
                        transition: 'left 0.3s ease',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Tarjetas destacadas ESTILO REFERENCIA.PNG */}
        <section style={{ padding: '30px 0 40px 0' }}>
          <h2 style={{
            fontSize: '2rem',
            fontWeight: '900',
            color: 'white',
            marginBottom: 25,
            textAlign: 'center',
            textShadow: '0 2px 10px rgba(0,0,0,0.3)'
          }}>
            Lugares Destacados
          </h2>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
            gap: 24 
          }}>
            {attractions.filter(a => a.image).slice(0, 4).map((a, idx) => (
              <FeaturedCard key={idx} title={a.name} img={a.image} />
            ))}
          </div>


        </section>

        {/* SECTION: Explore Button */}
        <div style={{ textAlign: 'center', margin: '40px 0' }}>
          <button
            onClick={() => window.location.href = '/explorar'}
            style={{
              background: `linear-gradient(135deg, ${COLOR_BLUE}, ${COLOR_RED})`,
              color: 'white',
              border: 'none',
              padding: '20px 40px',
              borderRadius: '50px',
              fontSize: '1.5rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: `0 10px 30px rgba(0,0,0,0.3)`,
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            🗺️ Explorar Lugares
          </button>
        </div>

        {/* MAIN CONTENT STACK */}
        <div className="content-stack" style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '40px',
          paddingBottom: '140px'
        }}>

          {/* SECTION 1: Multimedia (Videos & Gallery) */}
          <div className="multimedia-card" style={{
            background: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(20px)',
            color: '#1e293b',
            boxShadow: '0 20px 50px rgba(0,0,0,0.05)',
            border: `1px solid rgba(0,0,0,0.05)`
          }}>
            <h3 style={{ margin: '0 0 25px 0', fontSize: '1.8rem', fontWeight: '900', color: COLOR_BLUE, textAlign: 'right' }}>🎥 Santiago en Video</h3>
            <div className="scroll-container">
              {videos.length > 0 ? (
                videos.map((vid) => (
                  <div key={vid.id} className="scroll-item">
                    <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.6)', border: `1px solid ${COLOR_BLUE}44` }}>
                      <iframe
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                        src={vid.video_url}
                        title={vid.title}
                        frameBorder="0"
                        allowFullScreen
                      ></iframe>
                    </div>
                    <p style={{ fontSize: '1.1rem', marginTop: '15px', textAlign: 'center', fontWeight: '600', color: COLOR_WHITE }}>{vid.title}</p>
                  </div>
                ))
              ) : (
                <div className="scroll-item" style={{ flex: '0 0 100%' }}>
                  <div style={{ position: 'relative', paddingBottom: '30%', height: 0, overflow: 'hidden', borderRadius: '24px', width: '100%' }}>
                    <iframe
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                      src="https://www.youtube.com/embed/dQw4w9WgXcQ"
                      title="Default Video"
                      frameBorder="0"
                      allowFullScreen
                    ></iframe>
                  </div>
                </div>
              )}
            </div>

            <h3 style={{ margin: '40px 0 20px 0', fontSize: '1.5rem', fontWeight: '800', opacity: 0.9, color: COLOR_BLUE, textAlign: 'right' }}>📸 Galería de Atractivos</h3>
            <div className="scroll-container" style={{ paddingBottom: '10px' }}>
              {attractions.filter(t => t.image).slice(0, 15).map((attr, i) => (
                <div key={i} style={{ scrollSnapAlign: 'start' }}>
                  <GalleryCard
                    title={attr.name}
                    img={attr.image}
                    onClick={() => santiNarrate(`Contame un poco sobre ${attr.name}`)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 2: Quick Actions & Chat Housing */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(clamp(300px, 40vw, 500px), 1fr))',
            gap: 'clamp(20px, 4vw, 40px)'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '20px',
              background: 'rgba(255,255,255,0.6)',
              padding: '35px',
              borderRadius: '40px',
              border: `1px solid ${COLOR_BLUE}11`
            }}>
              <QuickActionBtn
                icon="https://res.cloudinary.com/dhvrrxejo/image/upload/v1768935115/gastronomia_jjitbf.png"
                label="Gastronomía"
                onClick={() => santiNarrate("¿Qué lugares para comer hay registrados?")}
              />
              <QuickActionBtn
                icon="https://res.cloudinary.com/dhvrrxejo/image/upload/v1768935120/Hoteles_kgufif.png"
                label="Hotelería"
                onClick={() => santiNarrate("Recomendame hoteles registrados")}
              />
              <QuickActionBtn
                icon="https://res.cloudinary.com/dhvrrxejo/image/upload/v1768935116/cultura_trx5ji.png"
                label="Cultura"
                onClick={() => santiNarrate("¿Qué actividades culturales me sugeris?")}
              />
              <QuickActionBtn
                icon="https://res.cloudinary.com/dhvrrxejo/image/upload/v1768935117/lugares_rzfnrh.png"
                label="Lugares"
                onClick={() => santiNarrate("¿Qué lugares turísticos me recomiendas visitar?")}
              />
            </div>

          </div>
        </div>

        {/* PROTAGONIST CHAT INTERFACE (Fixed at root for perfect positioning) */}
        <ChatInterface
          externalTrigger={narration}
          externalStory={activeStory}
          isModalOpen={!!activePlace}
        />

        {/* Place Detail Modal */}
        {activePlace && (
          <div
            onClick={() => setActivePlace(null)}
            style={{
              position: 'fixed',
              top: 0, left: 0, width: '100%', height: '100%',
              backgroundColor: 'rgba(0,0,0,0.92)',
              backdropFilter: 'blur(15px)',
              zIndex: 20000,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              padding: '40px 20px',
              overflowY: 'auto'
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                backgroundColor: '#1E293B',
                borderRadius: '32px',
                maxWidth: '550px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                position: 'relative',
                boxShadow: `0 40px 100px rgba(0,0,0,0.8)`,
                border: `2px solid ${COLOR_GOLD}33`,
                color: 'white'
              }}
            >
              <button
                onClick={() => setActivePlace(null)}
                style={{ position: 'absolute', top: '15px', right: '15px', background: COLOR_RED, color: 'white', border: 'none', borderRadius: '50%', width: '35px', height: '35px', cursor: 'pointer', zIndex: 10, fontWeight: 'bold' }}
              >
                ✕
              </button>
              <Image
                src={activePlace.image || IMG_PATTERN}
                onClick={() => setZoomImage(activePlace.image)}
                alt={activePlace.name}
                width={550}
                height={300}
                style={{ maxWidth: '100%', width: '100%', height: '300px', objectFit: 'cover', cursor: 'zoom-in', borderBottom: `4px solid ${COLOR_GOLD}` }}
              />
              <div style={{ padding: '30px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
                  <h2 style={{ margin: 0, fontSize: '2rem', color: COLOR_GOLD, fontWeight: '900' }}>{activePlace.name}</h2>
                  <span style={{ alignSelf: 'flex-start', backgroundColor: COLOR_BLUE, color: 'white', padding: '6px 16px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    {activePlace.isBusiness ? '🏢 COMERCIO CERTIFICADO' : '⭐ ATRACTIVO TURÍSTICO'}
                  </span>
                </div>
                <p style={{ color: '#E2E8F0', lineHeight: '1.8', fontSize: '1.1rem' }}>{activePlace.description}</p>

                {activePlace.info && (
                  <div style={{ marginTop: '25px', padding: '20px', background: 'rgba(255,255,255,0.05)', borderRadius: '20px', borderLeft: `6px solid ${COLOR_GOLD}` }}>
                    <strong style={{ display: 'block', marginBottom: '8px', color: COLOR_GOLD, fontSize: '1.2rem' }}>📌 Tips de Santi:</strong>
                    <p style={{ margin: 0, fontSize: '1rem', color: '#CBD5E1' }}>{activePlace.info}</p>
                  </div>
                )}

                {activePlace.gallery_urls && activePlace.gallery_urls.length > 0 && (
                  <div style={{ marginTop: '30px' }}>
                    <h4 style={{ marginBottom: '15px', color: COLOR_GOLD }}>📸 Galería de Fotos</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                      {activePlace.gallery_urls.map((url: string, idx: number) => (
                        <Image
                          key={idx}
                          src={url}
                          onClick={() => setZoomImage(url)}
                          alt={`Imagen ${idx + 1} de ${activePlace.name}`}
                          width={140}
                          height={110}
                          style={{ width: '100%', height: '110px', objectFit: 'cover', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.3s', border: `1px solid ${COLOR_WHITE}22` }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                  window.requestRoute?.(activePlace.coords[0], activePlace.coords[1], activePlace.name);
                    setActivePlace(null);
                  }}
                  style={{ width: '100%', marginTop: '40px', background: `linear-gradient(45deg, ${COLOR_RED}, ${COLOR_BLUE})`, color: 'white', border: 'none', padding: '20px', borderRadius: '20px', fontWeight: '900', fontSize: '1.3rem', cursor: 'pointer', boxShadow: `0 15px 35px ${COLOR_RED}66`, textTransform: 'uppercase', letterSpacing: '2px' }}
                >
                  🚀 ¡EMPEZAR VIAJE AHORA!
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lightbox / Zoomed Image */}
        {zoomImage && (
          <div
            onClick={() => setZoomImage(undefined)}
            style={{
              position: 'fixed',
              top: 0, left: 0, width: '100%', height: '100%',
              backgroundColor: 'rgba(0,0,0,0.98)',
              zIndex: 40000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'zoom-out',
              padding: '20px',
              animation: 'fadeIn 0.3s ease-out'
            }}
          >
            <button
              onClick={() => setZoomImage(undefined)}
              style={{ position: 'absolute', top: '30px', right: '30px', background: COLOR_GOLD, color: 'black', border: 'none', borderRadius: '50%', width: '50px', height: '50px', cursor: 'pointer', fontSize: '24px', fontWeight: 'bold' }}
            >
              ✕
            </button>
            <Image
              src={zoomImage}
              alt="Imagen ampliada"
              width={800}
              height={600}
              style={{ maxWidth: '95%', maxHeight: '95%', borderRadius: '12px', boxShadow: `0 0 100px ${COLOR_GOLD}33`, cursor: 'default', border: `2px solid ${COLOR_GOLD}33` }}
              onClick={e => e.stopPropagation()}
            />
          </div>
        )}

        {/* Subtle Footer */}
        <footer style={{
          marginTop: 'auto',
          padding: '70px 20px',
          textAlign: 'center',
          color: 'rgba(30, 31, 73, 0.86)',
          fontSize: '0.9rem',
          background: 'rgba(255,255,255,0.9)',
          borderRadius: '20px 20px 0 0',
          margin: '40px -20px 0 -20px'
        }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '10px' }}>🌵🧉🎻</div>
          <p>© 2026 Agente Turístico Santiago del Estero. <br />Diseñado con orgullo para la Madre de Ciudades.</p>
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '20px' }}>
            <a href="/login" style={{ color: COLOR_GOLD, textDecoration: 'none', fontWeight: 'bold' }}>Acceso Staff</a>
            <span>|</span>
            <a href="#" style={{ color: 'rgba(29, 28, 112, 0.4)', textDecoration: 'none' }}>Protocolo Turístico</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
