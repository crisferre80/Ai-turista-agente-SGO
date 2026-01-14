"use client";
import Map from "@/components/Map";
import ChatInterface from "@/components/ChatInterface";

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

const GalleryCard = ({ color, title }: { color: string, title: string }) => (
  <div style={{
    flex: 1,
    height: '120px',
    backgroundColor: color,
    borderRadius: '12px',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
  }}>
    <div style={{
      position: 'absolute',
      bottom: 0,
      width: '100%',
      background: 'rgba(0,0,0,0.5)',
      color: 'white',
      padding: '5px',
      fontSize: '0.8rem',
      textAlign: 'center'
    }}>
      {title}
    </div>
  </div>
);

export default function Home() {
  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px', height: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Top Text Banner */}
      <header className="app-header-banner">
        <h2>¡HOLA! SOY SANTI, TU ROBOT DE SANTIAGO DEL ESTERO</h2>
        <span className="app-subtext">LISTO PARA EXPLORAR NUESTRA TIERRA CONTIGO</span>
      </header>

      {/* Main Dashboard Interface */}
      <div className="dashboard-container">

        {/* Left Column: Map & Exploration */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

          {/* Map Area */}
          <div style={{ flex: 1, position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '4px solid rgba(255,255,255,0.2)' }}>
            <Map />
          </div>

          {/* Filter Buttons Row */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-filter active">HOTELES</button>
            <button className="btn-filter">RESTAURANTES</button>
            <button className="btn-filter">PARQUES</button>
          </div>

          {/* Gallery Row (Placeholder images) */}
          <div style={{ display: 'flex', gap: '15px' }}>
            <GalleryCard color="#FF7F50" title="Centro Cultural" />
            <GalleryCard color="#6495ED" title="Puente Carretero" />
            <GalleryCard color="#DA70D6" title="Catedral Basílica" />
          </div>

        </div>

        {/* Right Column: Quick Actions & Chat */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Quick Actions Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
            background: 'rgba(0,0,0,0.2)',
            padding: '15px',
            borderRadius: '16px'
          }}>
            <QuickActionBtn icon="🛏️" label="Hoteles" />
            <QuickActionBtn icon="🍽️" label="Restaurantes" />
            <QuickActionBtn icon="🎉" label="Eventos" />
            <QuickActionBtn icon="🌵" label="Paseos" />
          </div>

          {/* Chat Container */}
          <div style={{
            flex: 1,
            background: '#FDF5E6', // Old Lace / Warm white
            borderRadius: '16px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
          }}>
            <ChatInterface />
          </div>

        </div>

      </div>
    </div>
  );
}
