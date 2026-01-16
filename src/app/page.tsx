"use client";
import React, { useEffect, useState } from 'react';
import Map from '@/components/Map';
import ChatInterface from '@/components/ChatInterface';
import IntroOverlay from '@/components/IntroOverlay';
import { supabase } from '@/lib/supabase';

// IMAGES PROVIDED BY USER
const IMG_PATTERN = "https://res.cloudinary.com/dhvrrxejo/image/upload/v1768455560/istockphoto-1063378272-612x612_vby7gq.jpg";
const IMG_FLAG = "https://res.cloudinary.com/dhvrrxejo/image/upload/v1768455530/HD-wallpaper-flag-of-santiago-del-estero-grunge-art-rhombus-grunge-texture-argentine-province-santiago-del-estero-flag-argentina-national-symbols-santiago-del-estero-provinces-of-argentina-creative-art_aiecgf.jpg";

// COLORS EXTRACTED FROM FLAG
const COLOR_RED = "#9E1B1B";
const COLOR_BLUE = "#1A3A6C";
const COLOR_GOLD = "#F1C40F";
const COLOR_WHITE = "#FFFFFF";

// Componentes UI Atómicos
const GalleryCard = ({ title, img, color, onClick }: any) => (
  <div
    onClick={onClick}
    style={{
      flex: '0 0 160px',
      height: '220px',
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
    <img src={img} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    <div style={{
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
      padding: '15px',
      color: 'white'
    }}>
      <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 'bold' }}>{title}</h4>
      <div style={{ width: '20px', height: '3px', background: COLOR_RED, marginTop: '8px', borderRadius: '2px' }} />
    </div>
  </div>
);

const QuickActionBtn = ({ icon, label, onClick }: any) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      background: 'rgba(255,255,255,0.03)',
      backdropFilter: 'blur(10px)',
      border: `1px solid ${COLOR_WHITE}22`,
      borderRadius: '24px',
      padding: '20px',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      color: 'white',
      boxShadow: `0 4px 15px rgba(0,0,0,0.2)`
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = `${COLOR_BLUE}44`;
      e.currentTarget.style.borderColor = COLOR_GOLD;
      e.currentTarget.style.transform = 'translateY(-5px)';
      e.currentTarget.style.boxShadow = `0 10px 25px ${COLOR_BLUE}66`;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
      e.currentTarget.style.borderColor = `${COLOR_WHITE}22`;
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = `0 4px 15px rgba(0,0,0,0.2)`;
    }}
  >
    <span style={{ fontSize: '2.5rem', filter: `drop-shadow(0 0 10px ${COLOR_GOLD}44)` }}>{icon}</span>
    <span style={{ fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', color: COLOR_WHITE }}>{label}</span>
  </button>
);

export default function Home() {
  const [attractions, setAttractions] = useState<any[]>([]);
  const [narration, setNarration] = useState<string | undefined>(undefined);
  const [activeStory, setActiveStory] = useState<{ url: string; name: string } | undefined>(undefined);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlace, setActivePlace] = useState<any>(null);
  const [zoomImage, setZoomImage] = useState<string | undefined>(undefined);
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    fetchData();

    // Check if we need to focus on a specific place
    const focusPlace = localStorage.getItem('focusPlace');
    if (focusPlace) {
      localStorage.removeItem('focusPlace');
      // Wait for map and data to load
      setTimeout(() => {
        if (typeof window !== 'undefined' && (window as any).focusPlaceOnMap) {
          (window as any).focusPlaceOnMap(focusPlace);
        }
      }, 2000);
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: attrs } = await supabase.from('attractions').select('*');
      const { data: vids } = await supabase.from('app_videos').select('*');
      const { data: biz } = await supabase.from('businesses').select('*');

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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleNarration = (text: string) => {
    // Use a non-AI-triggering narration method
    (window as any).santiSpeak?.(text);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: `#0f172a`,
      color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* BACKGROUND LAYERS */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(135deg, #c5382eff 0%, #e2e8f0 100%)',
        zIndex: 0
      }} />
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: `url(${IMG_PATTERN})`,
        backgroundSize: '400px',
        opacity: 0.1,
        zIndex: 1,
        pointerEvents: 'none',
        mixBlendMode: 'multiply'
      }} />

      {/* INTRO OVERLAY (Root Level for Priority) */}
      {showIntro && (
        <IntroOverlay
          onComplete={() => {
            setShowIntro(false);
            sessionStorage.setItem('santi_visual_intro_seen', 'true');
            // Small delay to let the overlay fade out before Santi speaks
            setTimeout(() => {
              (window as any).santiNarrate?.("¡Hola chango! Ya estoy listo para guiarte. ¡Bienvenido a Santiago!");
            }, 500);
          }}
        />
      )}

      {/* CONTENT WRAPPER */}
      <div style={{ position: 'relative', zIndex: 10, padding: '70px 20px 0 20px' }}>
        {/* Top Header */}
        <header style={{
          padding: '20px 0',
          textAlign: 'center',
          color: '#1e293b'
        }}>
          {/* Vacío: El título ahora está junto a Santi */}
        </header>

        {/* Responsive Styles Injection */}
        <style dangerouslySetInnerHTML={{
          __html: `
          .multimedia-card { 
            padding: 40px; 
            border-radius: 40px; 
            width: 100%;
            box-sizing: border-box;
          }
          .scroll-container {
            display: flex;
            gap: 24px;
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
              attractions={attractions}
              onNarrate={handleNarration}
              onStoryPlay={(url, name) => setActiveStory({ url, name })}
              onPlaceFocus={setActivePlace}
            />
          )}
        </section>

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
                    color={COLOR_RED}
                    title={attr.name}
                    img={attr.image}
                    onClick={() => (window as any).santiNarrate?.(`Contame un poco sobre ${attr.name}`)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 2: Quick Actions & Chat Housing */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: '30px'
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
                icon="🍽️"
                label="Gastronomía"
                onClick={() => (window as any).santiNarrate?.("¿Qué lugares para comer hay registrados?")}
              />
              <QuickActionBtn
                icon="🏨"
                label="Hotelería"
                onClick={() => (window as any).santiNarrate?.("Recomendame hoteles registrados")}
              />
              <QuickActionBtn
                icon="🎭"
                label="Cultura"
                onClick={() => (window as any).santiNarrate?.("¿Qué actividades culturales me sugeris?")}
              />
              <QuickActionBtn
                icon="👤"
                label="Mi Perfil"
                onClick={() => (window as any).santiNarrate?.("¿Cómo puedo crear mi perfil certificado?")}
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
              <img
                src={activePlace.image || IMG_PATTERN}
                onClick={() => setZoomImage(activePlace.image)}
                style={{ width: '100%', height: '300px', objectFit: 'cover', cursor: 'zoom-in', borderBottom: `4px solid ${COLOR_GOLD}` }}
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
                        <img
                          key={idx}
                          src={url}
                          onClick={() => setZoomImage(url)}
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
                    (window as any).requestRoute(activePlace.coords[0], activePlace.coords[1], activePlace.name);
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
            <img
              src={zoomImage}
              style={{ maxWidth: '95%', maxHeight: '95%', borderRadius: '12px', boxShadow: `0 0 100px ${COLOR_GOLD}33`, cursor: 'default', border: `2px solid ${COLOR_GOLD}33` }}
              onClick={e => e.stopPropagation()}
            />
          </div>
        )}

        {/* Subtle Footer */}
        <footer style={{
          marginTop: 'auto',
          padding: '60px 20px',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.4)',
          fontSize: '0.9rem'
        }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '10px' }}>🌵🧉🎻</div>
          <p>© 2026 Agente Turístico Santiago del Estero. <br />Diseñado con orgullo para la Madre de Ciudades.</p>
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '20px' }}>
            <a href="/login" style={{ color: COLOR_GOLD, textDecoration: 'none', fontWeight: 'bold' }}>Acceso Staff</a>
            <span>|</span>
            <a href="#" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Protocolo Turístico</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
