"use client";
import React, { useState, useEffect } from 'react';
import Map from "@/components/Map";
import ChatInterface from "@/components/ChatInterface";
import { supabase } from '@/lib/supabase';

const QuickActionBtn = ({ icon, label }: { icon: string, label: string }) => (
  <button style={{
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '12px',
    padding: '10px',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '5px',
    cursor: 'pointer',
    fontSize: '0.8rem'
  }}>
    <span style={{ fontSize: '1.5rem' }}>{icon}</span>
    <span>{label}</span>
  </button>
);

const GalleryCard = ({ color, title, img }: { color: string, title: string, img?: string }) => (
  <div style={{
    flex: '0 0 150px',
    height: '110px',
    backgroundColor: color,
    borderRadius: '12px',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
    backgroundImage: `url(${img})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  }}>
    <div style={{
      position: 'absolute',
      bottom: 0,
      width: '100%',
      background: 'rgba(0,0,0,0.6)',
      color: 'white',
      padding: '5px',
      fontSize: '0.75rem',
      textAlign: 'center'
    }}>
      {title}
    </div>
  </div>
);

export default function Home() {
  const [narration, setNarration] = useState<string | undefined>();
  const [activeStory, setActiveStory] = useState<{ url: string, name: string } | undefined>();
  const [attractions, setAttractions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttractions();
  }, []);


  const fetchAttractions = async () => {
    setLoading(true);
    // 1. Base default attractions (can also be in DB, but keeping as fallback)
    const baseAttractions = [
      {
        name: "Centro Cultural Bicentenario",
        coords: [-64.2588, -27.7876],
        description: "Museo y centro cultural histórico en el corazón de la ciudad.",
        image: "https://res.cloudinary.com/dhvrrxejo/image/upload/v1736881200/ccb_santiago.jpg",
        isBusiness: false,
        info: "Horarios: 09:00 a 21:00. Entrada libre."
      },
      {
        name: "Puente Carretero",
        coords: [-64.2644, -27.7733],
        description: "Icónico puente sobre el Río Dulce, símbolo de identidad santiagueña.",
        image: "https://res.cloudinary.com/dhvrrxejo/image/upload/v1736881200/puente_carretero.jpg",
        isBusiness: false,
        info: "Ideal para fotos al atardecer."
      }
    ];

    // 2. Fetch from Supabase
    const { data, error } = await supabase.from('attractions').select('*');

    if (data) {
      const formatted = data.map((p: any) => ({
        name: p.name,
        coords: [p.lng, p.lat],
        description: p.description,
        image: p.image_url || "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=400",
        isBusiness: p.is_business_listing,
        info: p.info_extra
      }));
      setAttractions([...baseAttractions, ...formatted]);
    } else {
      setAttractions(baseAttractions);
    }
    setLoading(false);
  };

  const handleNarration = (text: string) => {
    setNarration(text + ' ');
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Top Header */}
      <header style={{
        padding: '20px 0',
        textAlign: 'center',
        color: 'white',
        textShadow: '0 2px 4px rgba(0,0,0,0.3)'
      }}>
        <h2 style={{ fontSize: 'clamp(1rem, 4vw, 1.8rem)', margin: 0, fontWeight: '900' }}>
          ¡HOLA! SOY SANTI, TU ROBOT DE SANTIAGO DEL ESTERO
        </h2>
        <span style={{ fontSize: '0.9rem', opacity: 0.9 }}>
          DESCUBRE LA MADRE DE CIUDADES CON EL PODER DE LA NUBE
        </span>
      </header>

      {/* Main Container */}
      <div className="dashboard-container" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '20px',
        flex: 1,
        paddingBottom: '100px'
      }}>

        {/* Column 1: Map and Video */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          <div style={{
            height: '450px',
            position: 'relative',
            borderRadius: '24px',
            overflow: 'hidden',
            boxShadow: '0 15px 35px rgba(0,0,0,0.2)',
            border: '4px solid rgba(255,255,255,0.1)'
          }}>
            {loading ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eee' }}>
                <p>Cargando mapa en las nubes...</p>
              </div>
            ) : (
              <Map
                attractions={attractions}
                onNarrate={handleNarration}
                onStoryPlay={(url, name) => setActiveStory({ url, name })}
              />
            )}
          </div>

          {/* Multimedia Section */}
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
            padding: '20px',
            borderRadius: '24px',
            color: 'white'
          }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem' }}>🎥 Galería & Videos</h3>
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '12px' }}>
              <iframe
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                src="https://www.youtube.com/embed/dQw4w9WgXcQ"
                title="Santiago del Estero Tour"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '15px', overflowX: 'auto', paddingBottom: '5px' }}>
              {attractions.slice(0, 5).map((attr, i) => (
                <GalleryCard key={i} color="#555" title={attr.name} img={attr.image} />
              ))}
            </div>
          </div>
        </div>

        {/* Column 2: Chat and Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px',
            background: 'rgba(0,0,0,0.15)',
            padding: '20px',
            borderRadius: '24px'
          }}>
            <QuickActionBtn icon="🍽️" label="Gastronomía" />
            <QuickActionBtn icon="🏨" label="Hotelería" />
            <QuickActionBtn icon="🎭" label="Cultura" />
            <button
              onClick={() => window.location.href = '/login'}
              style={{ padding: '10px', borderRadius: '10px', border: 'none', background: '#D2691E', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Acceso Admin
            </button>
            <QuickActionBtn icon="👤" label="Mi Perfil" />
          </div>

          {/* Chat Housing */}
          <div style={{
            flex: 1,
            minHeight: '400px',
            background: 'rgba(255,255,255,0.95)',
            borderRadius: '24px',
            overflow: 'hidden',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
            position: 'relative'
          }}>
            <ChatInterface externalTrigger={narration} externalStory={activeStory} />
          </div>
        </div>

      </div>
    </div>
  );
}
