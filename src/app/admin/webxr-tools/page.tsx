'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import dynamic from 'next/dynamic';
import { 
  Camera, QrCode, Anchor, Lightbulb, Layers, Video, 
  Box, ArrowLeft, Zap, Eye, Grid3x3, MapPin
} from 'lucide-react';

// Importar componentes dinámicamente (usan canvas y geolocation)
const ImageQRUploader = dynamic(() => import('@/components/ImageQRUploader'), { 
  ssr: false,
  loading: () => <div style={{ padding: '20px', textAlign: 'center' }}>Cargando componente QR...</div>
});
const GPSObjectPositioner = dynamic(() => import('@/components/GPSObjectPositioner'), { 
  ssr: false,
  loading: () => <div style={{ padding: '20px', textAlign: 'center' }}>Cargando componente GPS...</div>
});

// Colores del theme admin
const COLOR_GOLD = '#f4c430';
const COLOR_BLUE = '#0f3460';

interface Attraction {
  id: string;
  name: string;
  ar_model_url?: string;
  qr_code_url?: string;
  qr_physical_width?: number;
}

export default function WebXRToolsPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'qr' | 'gps' | 'tracking' | 'anchors' | 'lighting' | 'depth' | 'camera' | 'scene'>('overview');
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [selectedAttraction, setSelectedAttraction] = useState<Attraction | null>(null);
  const [loading, setLoading] = useState(false);
  
  const loadAttractions = useCallback(async () => {
    setLoading(true);
    console.log('🔄 Iniciando carga de atractivos...');
    
    // Verificar configuración primero
    if (!isSupabaseConfigured()) {
      console.error('❌ Supabase no está configurado');
      alert(
        'Supabase no está configurado correctamente.\n\n' +
        'Verifica que .env.local tenga:\n' +
        '- NEXT_PUBLIC_SUPABASE_URL\n' +
        '- NEXT_PUBLIC_SUPABASE_ANON_KEY\n\n' +
        'Después reinicia el servidor (npm run dev)'
      );
      setLoading(false);
      return;
    }
    
    try {
      // Verificar configuración de Supabase
      const { data: { session } } = await supabase.auth.getSession();
      console.log('📋 Sesión actual:', session ? 'Autenticado' : 'No autenticado');
      
      const { data, error } = await supabase
        .from('attractions')
        .select('id, name, ar_model_url')
        .order('name');

      if (error) {
        console.error('❌ Error cargando atractivos:');
        console.error('  - Mensaje:', error.message || 'Sin mensaje');
        console.error('  - Código:', error.code || 'Sin código');
        console.error('  - Detalles:', error.details || 'Sin detalles');
        console.error('  - Hint:', error.hint || 'Sin hint');
        console.error('  - Error completo:', JSON.stringify(error, null, 2));
        
        alert(
          `Error cargando atractivos:\n\n` +
          `Mensaje: ${error.message || 'Error desconocido'}\n` +
          `Código: ${error.code || 'N/A'}\n\n` +
          `Verifica:\n` +
          `1. Conexión a internet\n` +
          `2. Variables de entorno (.env.local)\n` +
          `3. Tabla 'attractions' existe en Supabase\n` +
          `4. Políticas RLS configuradas`
        );
      } else {
        console.log('✅ Atractivos cargados:', data?.length || 0);
        if (data && data.length > 0) {
          console.log('📍 Primer atractivo:', data[0]);
        }
        setAttractions(data || []);
        if (data && data.length > 0) {
          setSelectedAttraction(data[0]);
          console.log('✅ Atractivo seleccionado:', data[0].name);
        } else {
          console.warn('⚠️ No hay atractivos en la base de datos');
        }
      }
    } catch (err) {
      console.error('💥 Excepción al cargar atractivos:', err);
      alert('Error crítico: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  // Verificar autenticación
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const legacyAuth = localStorage.getItem('adminToken');

      if (!user && legacyAuth !== 'granted') {
        router.push('/login');
      } else {
        setIsAuthorized(true);
        loadAttractions();
      }
    };

    checkAuth();
  }, [router, loadAttractions]);

  if (!isAuthorized) return null;

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    background: isActive ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
    color: isActive ? 'white' : '#666',
    border: 'none',
    padding: '12px 20px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: isActive ? '600' : '400',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    textAlign: 'left'
  });

  const cardStyle: React.CSSProperties = {
    background: 'white',
    borderRadius: '20px',
    padding: '30px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
    border: '1px solid #e5e7eb',
    marginBottom: '20px'
  };

  const featureCardStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
    borderRadius: '16px',
    padding: '25px',
    border: '1px solid #e5e7eb',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #e8f4f8 0%, #fef3e0 100%)',
      padding: '20px'
    }}>
      {/* Header */}
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '25px 30px',
        marginBottom: '30px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <button
            onClick={() => router.push('/admin')}
            style={{
              background: 'transparent',
              border: 'none',
              color: COLOR_BLUE,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              marginBottom: '10px'
            }}
          >
            <ArrowLeft size={18} />
            Volver al Admin
          </button>
          <h1 style={{
            fontSize: '32px',
            margin: '0',
            color: COLOR_BLUE,
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Zap style={{ color: COLOR_GOLD }} size={32} />
            WebXR Tools
          </h1>
          <p style={{ color: '#666', margin: '8px 0 0 0', fontSize: '14px' }}>
            Herramientas avanzadas de Realidad Aumentada y Three.js
          </p>
        </div>

        {/* Selector de atractivo */}
        <div style={{ minWidth: '300px' }}>
          <label style={{ 
            display: 'block', 
            fontSize: '12px', 
            color: '#666', 
            marginBottom: '8px',
            fontWeight: '500'
          }}>
            Atractivo seleccionado
          </label>
          <select
            value={selectedAttraction?.id || ''}
            onChange={(e) => {
              const attr = attractions.find(a => a.id === e.target.value);
              setSelectedAttraction(attr || null);
            }}
            style={{
              width: '100%',
              padding: '10px 15px',
              borderRadius: '10px',
              border: '2px solid #e5e7eb',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            {attractions.map(attr => (
              <option key={attr.id} value={attr.id}>
                {attr.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Banner de diagnóstico */}
      {attractions.length === 0 && !loading && (
        <div style={{
          background: '#fff3cd',
          border: '2px solid #ffc107',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'start',
          gap: '15px'
        }}>
          <div style={{ fontSize: '32px' }}>⚠️</div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#856404', fontSize: '18px', fontWeight: 'bold' }}>
              No se encontraron atractivos turísticos
            </h3>
            <p style={{ margin: '0 0 15px 0', color: '#856404', fontSize: '14px', lineHeight: '1.6' }}>
              Para usar WebXR Tools necesitas tener al menos un atractivo turístico creado en la base de datos.
            </p>
            <div style={{ background: 'white', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
              <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: '#333' }}>Pasos para solucionar:</p>
              <ol style={{ margin: 0, paddingLeft: '20px', color: '#666', fontSize: '14px', lineHeight: '1.8' }}>
                <li>
                  <strong>Verifica que .env.local existe</strong> con las credenciales de Supabase:
                  <pre style={{ 
                    background: '#f5f5f5', 
                    padding: '10px', 
                    borderRadius: '4px', 
                    marginTop: '8px',
                    fontSize: '12px',
                    overflow: 'auto'
                  }}>
{`NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-key-aqui`}
                  </pre>
                </li>
                <li>Reinicia el servidor después de crear .env.local (Ctrl+C y luego <code>npm run dev</code>)</li>
                <li>Verifica en la consola del navegador (F12) si hay errores de conexión a Supabase</li>
                <li>Crea tu primer atractivo turístico desde el Panel de Admin</li>
              </ol>
            </div>
            <button
              onClick={() => {
                console.log('🔍 Estado de Supabase:', {
                  configurado: isSupabaseConfigured(),
                  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
                  hayKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
                });
                alert('Revisa la consola del navegador (F12) para más detalles');
              }}
              style={{
                padding: '8px 16px',
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              🔍 Diagnosticar Conexión
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '30px',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>⏳</div>
          <p style={{ fontSize: '16px', color: '#666', margin: 0 }}>Cargando atractivos turísticos...</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '20px' }}>
        {/* Sidebar */}
        <div style={{
          width: '280px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <button onClick={() => setActiveTab('overview')} style={tabStyle(activeTab === 'overview')}>
            <Grid3x3 size={18} />
            Resumen
          </button>
          
          <button onClick={() => setActiveTab('qr')} style={tabStyle(activeTab === 'qr')}>
            <QrCode size={18} />
            QR Codes
          </button>

          <button onClick={() => setActiveTab('gps')} style={tabStyle(activeTab === 'gps')}>
            <MapPin size={18} />
            GPS Positioning
          </button>

          <button onClick={() => setActiveTab('tracking')} style={tabStyle(activeTab === 'tracking')}>
            <Camera size={18} />
            Image Tracking
          </button>

          <button onClick={() => setActiveTab('anchors')} style={tabStyle(activeTab === 'anchors')}>
            <Anchor size={18} />
            Anchors API
          </button>

          <button onClick={() => setActiveTab('lighting')} style={tabStyle(activeTab === 'lighting')}>
            <Lightbulb size={18} />
            Light Estimation
          </button>

          <button onClick={() => setActiveTab('depth')} style={tabStyle(activeTab === 'depth')}>
            <Layers size={18} />
            Depth Sensing
          </button>

          <button onClick={() => setActiveTab('camera')} style={tabStyle(activeTab === 'camera')}>
            <Video size={18} />
            Camera Access
          </button>

          <div style={{ 
            height: '1px', 
            background: '#e5e7eb', 
            margin: '15px 0' 
          }} />

          <button 
            onClick={() => router.push('/admin/ar-config')} 
            style={tabStyle(activeTab === 'scene')}
          >
            <Box size={18} />
            Editor de Escena 3D
          </button>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1 }}>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div>
              <div style={cardStyle}>
                <h2 style={{ fontSize: '24px', marginBottom: '20px', color: COLOR_BLUE }}>
                  Características WebXR Implementadas
                </h2>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: '20px',
                  marginBottom: '30px'
                }}>
                  <div 
                    style={{ ...featureCardStyle, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                    onClick={() => setActiveTab('qr')}
                  >
                    <QrCode size={32} color="white" />
                    <div>
                      <h3 style={{ color: 'white', fontSize: '18px', margin: '0 0 5px 0' }}>
                        QR Code Generator
                      </h3>
                      <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', margin: 0 }}>
                        Genera códigos QR para activar experiencias AR automáticamente
                      </p>
                    </div>
                  </div>

                  <div 
                    style={{ ...featureCardStyle, background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}
                    onClick={() => setActiveTab('tracking')}
                  >
                    <Camera size={32} color="white" />
                    <div>
                      <h3 style={{ color: 'white', fontSize: '18px', margin: '0 0 5px 0' }}>
                        Image Tracking
                      </h3>
                      <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', margin: 0 }}>
                        Detecta imágenes y marcadores para posicionar objetos AR
                      </p>
                    </div>
                  </div>

                  <div 
                    style={{ ...featureCardStyle, background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}
                    onClick={() => setActiveTab('anchors')}
                  >
                    <Anchor size={32} color="white" />
                    <div>
                      <h3 style={{ color: 'white', fontSize: '18px', margin: '0 0 5px 0' }}>
                        Anchors API
                      </h3>
                      <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', margin: 0 }}>
                        Ancla objetos permanentemente en el mundo real
                      </p>
                    </div>
                  </div>

                  <div 
                    style={{ ...featureCardStyle, background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' }}
                    onClick={() => setActiveTab('lighting')}
                  >
                    <Lightbulb size={32} color="white" />
                    <div>
                      <h3 style={{ color: 'white', fontSize: '18px', margin: '0 0 5px 0' }}>
                        Light Estimation
                      </h3>
                      <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', margin: 0 }}>
                        Iluminación realista según el entorno
                      </p>
                    </div>
                  </div>

                  <div 
                    style={{ ...featureCardStyle, background: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)' }}
                    onClick={() => setActiveTab('depth')}
                  >
                    <Layers size={32} color="white" />
                    <div>
                      <h3 style={{ color: 'white', fontSize: '18px', margin: '0 0 5px 0' }}>
                        Depth Sensing
                      </h3>
                      <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', margin: 0 }}>
                        Oclusión realista con objetos del mundo real
                      </p>
                    </div>
                  </div>

                  <div 
                    style={{ ...featureCardStyle, background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' }}
                    onClick={() => setActiveTab('camera')}
                  >
                    <Video size={32} color="#333" />
                    <div>
                      <h3 style={{ color: '#333', fontSize: '18px', margin: '0 0 5px 0' }}>
                        Camera Access
                      </h3>
                      <p style={{ color: '#666', fontSize: '13px', margin: 0 }}>
                        Acceso a frames de cámara para computer vision
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{
                  background: '#f0f9ff',
                  border: '2px solid #bfdbfe',
                  borderRadius: '12px',
                  padding: '20px',
                  marginTop: '20px'
                }}>
                  <h3 style={{ color: COLOR_BLUE, fontSize: '16px', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Eye size={20} />
                    Estado del Atractivo Actual
                  </h3>
                  {selectedAttraction ? (
                    <div style={{ fontSize: '14px', color: '#666' }}>
                      <p style={{ margin: '5px 0' }}>
                        <strong>Nombre:</strong> {selectedAttraction.name}
                      </p>
                      <p style={{ margin: '5px 0' }}>
                        <strong>Modelo 3D:</strong> {selectedAttraction.ar_model_url ? '✅ Configurado' : '❌ No configurado'}
                      </p>
                      <p style={{ margin: '5px 0' }}>
                        <strong>QR Code:</strong> {selectedAttraction.qr_code_url ? '✅ Generado' : '❌ No generado'}
                      </p>
                    </div>
                  ) : (
                    <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>
                      Selecciona un atractivo en el selector superior
                    </p>
                  )}
                </div>
              </div>

              <div style={cardStyle}>
                <h3 style={{ fontSize: '20px', marginBottom: '15px', color: COLOR_BLUE }}>
                  📚 Documentación
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <a 
                    href="/docs/README_image_tracking_qr.md" 
                    target="_blank"
                    style={{
                      padding: '15px',
                      background: '#f9fafb',
                      borderRadius: '10px',
                      border: '1px solid #e5e7eb',
                      textDecoration: 'none',
                      color: COLOR_BLUE,
                      fontSize: '14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span>📱 Guía de Image Tracking y QR Codes</span>
                    <span style={{ color: '#666' }}>→</span>
                  </a>
                  <a 
                    href="/docs/README_webxr_advanced_features.md" 
                    target="_blank"
                    style={{
                      padding: '15px',
                      background: '#f9fafb',
                      borderRadius: '10px',
                      border: '1px solid #e5e7eb',
                      textDecoration: 'none',
                      color: COLOR_BLUE,
                      fontSize: '14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span>🔧 Características Avanzadas de WebXR</span>
                    <span style={{ color: '#666' }}>→</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* QR Tab */}
          {activeTab === 'qr' && (
            <div style={cardStyle}>
              <h2 style={{ fontSize: '24px', marginBottom: '10px', color: COLOR_BLUE }}>
                Generador de Códigos QR con Imagen de Referencia
              </h2>
              <p style={{ color: '#666', marginBottom: '25px', fontSize: '14px' }}>
                Sube una imagen de referencia (póster, logo, etc.), genera un código QR vinculado y colócalos juntos físicamente. Al escanear el QR, el objeto 3D se anclará cuando la cámara detecte la imagen.
              </p>
              
              {!selectedAttraction ? (
                <div style={{
                  padding: '40px',
                  textAlign: 'center',
                  background: '#fff3cd',
                  borderRadius: '12px',
                  border: '2px solid #ffc107'
                }}>
                  <p style={{ fontSize: '18px', marginBottom: '10px' }}>⚠️ No hay atractivos disponibles</p>
                  <p style={{ color: '#666', fontSize: '14px' }}>Primero debes crear al menos un atractivo turístico en el sistema.</p>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: '20px', padding: '12px', background: '#e8f4f8', borderRadius: '8px' }}>
                    <strong>Atractivo seleccionado:</strong> {selectedAttraction.name}
                  </div>
                  <ImageQRUploader
                    attractionId={selectedAttraction.id}
                    attractionName={selectedAttraction.name}
                    onQRGenerated={(qrUrl, imageUrl, width) => {
                      console.log('✅ QR generado:', { qrUrl, imageUrl, width });
                    }}
                  />
                </>
              )}
            </div>
          )}

          {/* GPS Tab */}
          {activeTab === 'gps' && (
            <div style={cardStyle}>
              <h2 style={{ fontSize: '24px', marginBottom: '10px', color: COLOR_BLUE }}>
                Posicionamiento GPS
              </h2>
              <p style={{ color: '#666', marginBottom: '25px', fontSize: '14px' }}>
                Posiciona objetos AR persistentes en coordenadas geográficas específicas. Los usuarios verán el objeto 3D cuando estén cerca de esa ubicación.
              </p>
              
              {!selectedAttraction ? (
                <div style={{
                  padding: '40px',
                  textAlign: 'center',
                  background: '#fff3cd',
                  borderRadius: '12px',
                  border: '2px solid #ffc107'
                }}>
                  <p style={{ fontSize: '18px', marginBottom: '10px' }}>⚠️ No hay atractivos disponibles</p>
                  <p style={{ color: '#666', fontSize: '14px' }}>Primero debes crear al menos un atractivo turístico en el sistema.</p>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: '20px', padding: '12px', background: '#e8f4f8', borderRadius: '8px' }}>
                    <strong>Atractivo seleccionado:</strong> {selectedAttraction.name}
                  </div>
                  <GPSObjectPositioner
                    attractionId={selectedAttraction.id}
                    attractionName={selectedAttraction.name}
                    modelUrl={selectedAttraction.ar_model_url}
                  />
                </>
              )}
            </div>
          )}

          {/* Image Tracking Tab */}
          {activeTab === 'tracking' && (
            <div style={cardStyle}>
              <h2 style={{ fontSize: '24px', marginBottom: '10px', color: COLOR_BLUE }}>
                Image Tracking
              </h2>
              <p style={{ color: '#666', marginBottom: '25px', fontSize: '14px' }}>
                Detecta imágenes y marcadores personalizados para activar experiencias AR
              </p>

              <div style={{
                background: '#f0f9ff',
                border: '2px solid #bfdbfe',
                borderRadius: '12px',
                padding: '20px'
              }}>
                <h3 style={{ fontSize: '16px', marginBottom: '15px', color: COLOR_BLUE }}>
                  📷 Componente ARImageTracking
                </h3>
                <p style={{ color: '#666', fontSize: '14px', marginBottom: '10px' }}>
                  Esta característica permite detectar:
                </p>
                <ul style={{ color: '#666', fontSize: '14px', paddingLeft: '20px' }}>
                  <li>Códigos QR generados</li>
                  <li>Logos y marcadores personalizados</li>
                  <li>Imágenes de referencia (pósters, carteles, etc.)</li>
                </ul>
                <p style={{ color: '#666', fontSize: '14px', marginTop: '15px' }}>
                  <strong>Estado:</strong> ✅ Implementado en <code style={{ background: '#e5e7eb', padding: '2px 6px', borderRadius: '4px' }}>ARImageTracking.tsx</code>
                </p>
              </div>

              <div style={{ marginTop: '20px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '15px', color: COLOR_BLUE }}>
                  Cómo funciona
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      flexShrink: 0
                    }}>
                      1
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 5px 0', fontSize: '14px', color: COLOR_BLUE }}>
                        Generar marcador
                      </h4>
                      <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
                        Usa el generador de QR o sube una imagen de referencia
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      flexShrink: 0
                    }}>
                      2
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 5px 0', fontSize: '14px', color: COLOR_BLUE }}>
                        Imprimir y colocar
                      </h4>
                      <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
                        Imprime el marcador y colócalo en la ubicación deseada
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      flexShrink: 0
                    }}>
                      3
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 5px 0', fontSize: '14px', color: COLOR_BLUE }}>
                        Escanear y disfrutar
                      </h4>
                      <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
                        Al detectar el marcador, el objeto AR aparece automáticamente
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Anchors Tab */}
          {activeTab === 'anchors' && (
            <div style={cardStyle}>
              <h2 style={{ fontSize: '24px', marginBottom: '10px', color: COLOR_BLUE }}>
                Anchors API
              </h2>
              <p style={{ color: '#666', marginBottom: '25px', fontSize: '14px' }}>
                Los objetos AR permanecen anclados en posiciones del mundo real
              </p>

              <div style={{
                background: '#f0fdf4',
                border: '2px solid #bbf7d0',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: '#22c55e',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px'
                  }}>
                    ✓
                  </div>
                  <h3 style={{ fontSize: '16px', margin: 0, color: '#15803d' }}>
                    Feature implementada y activa
                  </h3>
                </div>
                <p style={{ color: '#166534', fontSize: '13px', margin: 0, paddingLeft: '40px' }}>
                  Esta característica está integrada en <code style={{ background: 'white', padding: '2px 6px', borderRadius: '4px' }}>ARAnchors.tsx</code> y se activa automáticamente cuando se colocan objetos en AR.
                </p>
              </div>

              <h3 style={{ fontSize: '18px', marginBottom: '15px', color: COLOR_BLUE }}>
                Capacidades
              </h3>
              <ul style={{ color: '#666', fontSize: '14px', lineHeight: '1.8' }}>
                <li><strong>Crear anchors desde hit tests:</strong> Al tocar una superficie, el objeto se ancla automáticamente</li>
                <li><strong>Crear anchors desde poses manuales:</strong> Posicionar objetos en coordenadas específicas</li>
                <li><strong>Tracking automático:</strong> El sistema actualiza la posición del anchor cada frame</li>
                <li><strong>Gestión de anchors:</strong> Eliminar anchors individuales o todos a la vez</li>
              </ul>

              <div style={{
                background: '#fef9c3',
                border: '2px solid #fde047',
                borderRadius: '12px',
                padding: '20px',
                marginTop: '20px'
              }}>
                <h4 style={{ color: '#a16207', fontSize: '14px', margin: '0 0 10px 0' }}>
                  💡 Uso en la app
                </h4>
                <p style={{ color: '#854d0e', fontSize: '13px', margin: 0 }}>
                  Los usuarios verán un icono de ancla (🔗) cuando un objeto esté persistentemente anclado. El objeto permanecerá en la misma posición incluso si el usuario se mueve o mira hacia otro lado.
                </p>
              </div>
            </div>
          )}

          {/* Light Estimation Tab */}
          {activeTab === 'lighting' && (
            <div style={cardStyle}>
              <h2 style={{ fontSize: '24px', marginBottom: '10px', color: COLOR_BLUE }}>
                Light Estimation
              </h2>
              <p style={{ color: '#666', marginBottom: '25px', fontSize: '14px' }}>
                Iluminación realista que se adapta al entorno del usuario
              </p>

              <div style={{
                background: '#f0fdf4',
                border: '2px solid #bbf7d0',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: '#22c55e',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px'
                  }}>
                    ✓
                  </div>
                  <h3 style={{ fontSize: '16px', margin: 0, color: '#15803d' }}>
                    Feature implementada y activa
                  </h3>
                </div>
                <p style={{ color: '#166534', fontSize: '13px', margin: 0, paddingLeft: '40px' }}>
                  Se aplica automáticamente en <code style={{ background: 'white', padding: '2px 6px', borderRadius: '4px' }}>ARLightEstimation.tsx</code>. Los objetos AR se iluminan según la luz del entorno real.
                </p>
              </div>

              <h3 style={{ fontSize: '18px', marginBottom: '15px', color: COLOR_BLUE }}>
                Beneficios
              </h3>
              <ul style={{ color: '#666', fontSize: '14px', lineHeight: '1.8' }}>
                <li>Objetos virtuales reciben la misma iluminación que objetos reales</li>
                <li>Sombras más realistas y coherentes con el entorno</li>
                <li>Adaptación automática a cambios de iluminación</li>
                <li>Soporte para Spherical Harmonics (iluminación indirecta compleja)</li>
              </ul>
            </div>
          )}

          {/* Depth Sensing Tab */}
          {activeTab === 'depth' && (
            <div style={cardStyle}>
              <h2 style={{ fontSize: '24px', marginBottom: '10px', color: COLOR_BLUE }}>
                Depth Sensing
              </h2>
              <p style={{ color: '#666', marginBottom: '25px', fontSize: '14px' }}>
                Oclusión realista: objetos reales ocultan objetos virtuales
              </p>

              <div style={{
                background: '#fef3c7',
                border: '2px solid #fcd34d',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: '#f59e0b',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px'
                  }}>
                    ⚠
                  </div>
                  <h3 style={{ fontSize: '16px', margin: 0, color: '#92400e' }}>
                    Requiere hardware específico
                  </h3>
                </div>
                <p style={{ color: '#78350f', fontSize: '13px', margin: 0, paddingLeft: '40px' }}>
                  Implementado en <code style={{ background: 'white', padding: '2px 6px', borderRadius: '4px' }}>ARDepthSensing.tsx</code> pero deshabilitado por defecto. Requiere dispositivos con sensor LiDAR (iPad Pro) o ToF (algunos Android high-end).
                </p>
              </div>

              <h3 style={{ fontSize: '18px', marginBottom: '15px', color: COLOR_BLUE }}>
                Usos
              </h3>
              <ul style={{ color: '#666', fontSize: '14px', lineHeight: '1.8' }}>
                <li>Personas pueden caminar delante de objetos AR y ocultarlos</li>
                <li>Objetos AR respetan la geometría del entorno</li>
                <li>Base para física avanzada (colisiones realistas)</li>
                <li>Detección de superficies y obstáculos</li>
              </ul>

              <div style={{
                background: '#f0f9ff',
                border: '2px solid #bfdbfe',
                borderRadius: '12px',
                padding: '15px',
                marginTop: '20px'
              }}>
                <p style={{ color: '#1e40af', fontSize: '13px', margin: 0 }}>
                  <strong>Para habilitar:</strong> Cambiar <code style={{ background: 'white', padding: '2px 6px', borderRadius: '4px' }}>autoApplyOcclusion=true</code> en WebXRScene.tsx cuando el hardware lo soporte.
                </p>
              </div>
            </div>
          )}

          {/* Camera Access Tab */}
          {activeTab === 'camera' && (
            <div style={cardStyle}>
              <h2 style={{ fontSize: '24px', marginBottom: '10px', color: COLOR_BLUE }}>
                Camera Access
              </h2>
              <p style={{ color: '#666', marginBottom: '25px', fontSize: '14px' }}>
                Acceso a frames de cámara para computer vision avanzada
              </p>

              <div style={{
                background: '#fef2f2',
                border: '2px solid #fecaca',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: '#ef4444',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px'
                  }}>
                    🧪
                  </div>
                  <h3 style={{ fontSize: '16px', margin: 0, color: '#991b1b' }}>
                    API Experimental
                  </h3>
                </div>
                <p style={{ color: '#7f1d1d', fontSize: '13px', margin: 0, paddingLeft: '40px' }}>
                  Implementado en <code style={{ background: 'white', padding: '2px 6px', borderRadius: '4px' }}>ARCameraAccess.tsx</code> pero requiere Chrome 110+ con flag experimental habilitado. API en desarrollo activo.
                </p>
              </div>

              <h3 style={{ fontSize: '18px', marginBottom: '15px', color: COLOR_BLUE }}>
                Posibilidades futuras
              </h3>
              <ul style={{ color: '#666', fontSize: '14px', lineHeight: '1.8' }}>
                <li>Detección de objetos en tiempo real</li>
                <li>Reconocimiento de rostros y gestos</li>
                <li>Efectos de video (filtros, máscaras)</li>
                <li>Análisis de imagen para features avanzadas</li>
              </ul>

              <div style={{
                background: '#f0f9ff',
                border: '2px solid #bfdbfe',
                borderRadius: '12px',
                padding: '15px',
                marginTop: '20px'
              }}>
                <p style={{ color: '#1e40af', fontSize: '13px', margin: 0 }}>
                  <strong>Para habilitar:</strong> chrome://flags → buscar &quot;WebXR Camera Access&quot; → habilitar → reiniciar navegador
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: '30px',
            textAlign: 'center'
          }}>
            <div style={{
              width: '50px',
              height: '50px',
              border: '4px solid #f3f4f6',
              borderTopColor: COLOR_BLUE,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 15px'
            }} />
            <p style={{ color: COLOR_BLUE, fontSize: '14px', margin: 0 }}>
              Cargando...
            </p>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `
      }} />
    </div>
  );
}
