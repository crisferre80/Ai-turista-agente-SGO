'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Canvas } from '@react-three/fiber';
import { X, Loader2, AlertTriangle, Camera } from 'lucide-react';
import type { ARData } from '@/types/ar';
import { isMobileDevice } from '@/lib/webxr';
import ARScene from './ARPageClient/ARScene';
import WebXRScene from './ARPageClient/WebXRScene';

type Attraction = {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  category?: string;
  lat?: number;
  lng?: number;
  has_ar_content?: boolean;
  ar_model_url?: string;
  ar_hotspots?: ARData;
  qr_code?: string;
};

type ARPageClientProps = {
  attraction: Attraction;
};

export default function ARPageClient({ attraction }: ARPageClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [isPlaced, setIsPlaced] = useState(false);
  const [anchorPosition, setAnchorPosition] = useState<[number, number, number]>([0, 0, -3]);
  const [showPlacedFeedback, setShowPlacedFeedback] = useState(false);
  const [useWebXR, setUseWebXR] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);  

  // Efecto para detectar WebXR y decidir qué sistema usar
  useEffect(() => {
    const initCamera = async () => {
      try {
        console.log('🎥 Iniciando cámara para AR simulado...');
        
        if (!navigator.mediaDevices?.getUserMedia) {
          setError('Tu navegador no soporta acceso a la cámara.');
          setLoading(false);
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          } 
        });
        
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise((resolve) => {
            if (videoRef.current) {
              videoRef.current.onloadedmetadata = resolve;
            }
          });
          console.log('✅ Cámara inicializada');
        }
      } catch (err) {
        console.error('❌ Error accediendo a la cámara:', err);
        setError('No se pudo acceder a la cámara. Verifique los permisos.');
        setLoading(false);
      }
    };
    const initAR = async () => {
      try {
        console.log('🔍 Detectando capacidades AR...');
        
        // Verificar WebXR primero
        if ('xr' in navigator && navigator.xr) {
          const isSupported = await navigator.xr.isSessionSupported('immersive-ar');
          if (isSupported) {
            console.log('✅ WebXR AR soportado - Usando AR real');
            setUseWebXR(true);
            setLoading(false);
            return;
          }
        }
        
        // Fallback al sistema simulado con cámara
        console.log('⚠️ WebXR no disponible - Usando AR simulado');
        setUseWebXR(false);
        await initCamera();
        
      } catch (err) {
        console.error('❌ Error iniciando AR:', err);
        setError(`Error iniciando AR: ${err instanceof Error ? err.message : 'Error desconocido'}`);
        setLoading(false);
      }
    };

    initAR();
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        console.log('🛑 Stream detenido');
      }
    };
  }, []);

  // Efecto separado para asignar el stream al video cuando esté disponible (solo para AR simulado)
  useEffect(() => {
    if (useWebXR || !streamRef.current || !videoRef.current || cameraActive) {
      return;
    }

    const video = videoRef.current;
    const stream = streamRef.current;

    console.log('📹 Asignando stream a video elemento');
    video.srcObject = stream;
    
    // Reproducir video
    const playVideo = async () => {
      try {
        await video.play();
        console.log('✅ Video reproduciendo');
        setCameraActive(true);
      } catch (err) {
        console.error('❌ Error reproduciendo video:', err);
        // Reintento después de metadata
        video.onloadedmetadata = async () => {
          console.log('📹 Metadata cargado, reintentando...');
          try {
            await video.play();
            console.log('✅ Video reproduciendo (segundo intento)');
            setCameraActive(true);
          } catch (retryErr) {
            console.error('❌ Error en segundo intento:', retryErr);
            setError('No se pudo iniciar el video. Intenta recargar la página.');
          }
        };
      }
    };

    playVideo();
  }, [loading, cameraActive, useWebXR]);

  const handleClose = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    router.push(`/explorar/${attraction.id}`);
  };

  const handlePlaceScene = (event: React.PointerEvent) => {
    if (isPlaced) return;
    
    console.log('📍 Anclando escena en posición del toque (AR simulado)');
    
    // Obtener las coordenadas normalizadas del toque (-1 a 1)
    const target = event.target as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Calcular posición 3D basada en el toque
    // Para AR más realista, colocar a distancia más cercana y fija
    const distance = 2; // Distancia más cercana para simular AR
    const offsetX = x * 0.8; // Menos desplazamiento horizontal
    const offsetY = y * 0.5 + 0.2; // Menos desplazamiento vertical, ligeramente elevado
    
    const newPosition: [number, number, number] = [offsetX, offsetY, -distance];
    
    console.log('📍 Nueva posición de anclaje AR simulado:', newPosition);
    console.log('📍 Coordenadas de toque - x:', x.toFixed(2), 'y:', y.toFixed(2));
    
    setAnchorPosition(newPosition);
    setIsPlaced(true);
    
    // Mostrar feedback visual
    setShowPlacedFeedback(true);
    setTimeout(() => setShowPlacedFeedback(false), 2000);
  };

  // Si está cargando
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-bold">Iniciando Realidad Aumentada</h2>
          <p className="text-gray-300 mt-2">
            Preparando AR...
          </p>
          <div className="mt-4 p-3 bg-black/30 rounded text-xs text-gray-400">
            <div>Detectando capacidades de AR...</div>
          </div>
        </div>
      </div>
    );
  }

  // Si hay error
  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center p-4">
        <div className="bg-red-500/20 border-2 border-red-500 rounded-lg p-6 max-w-md">
          <div className="flex items-start gap-3 text-white">
            <AlertTriangle className="h-6 w-6 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-xl font-bold mb-2">Error al iniciar AR</h2>
              <p className="text-gray-200 mb-4">{error}</p>
              <div className="text-sm text-gray-300 bg-black/30 p-3 rounded mb-4">
                <p className="font-semibold mb-2">💡 Soluciones posibles:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Verifica que estés usando HTTPS (conexión segura)</li>
                  <li>Usa un navegador compatible con WebXR (Chrome, Edge)</li>
                  <li>Acepta los permisos de cámara cuando se soliciten</li>
                  <li>Comprueba que ninguna otra app esté usando la cámara</li>
                </ul>
              </div>
              <button
                onClick={handleClose}
                className="mt-4 bg-white text-red-500 px-6 py-3 rounded-lg font-semibold w-full hover:bg-gray-100 transition"
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Renderizado condicional: WebXR real o simulado
  if (useWebXR) {
    return <WebXRScene attraction={attraction} onClose={handleClose} />;
  }

  // --- RENDER AR SIMULADO (Fallback) ---
  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden">
      {/* Video de cámara como fondo */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        muted
        playsInline
        style={{
          zIndex: 1,
          backgroundColor: '#000'
        }}
        onLoadedMetadata={() => console.log('📹 Video metadata cargado (evento DOM)')}
        onPlay={() => console.log('▶️ Video iniciado (evento DOM)')}
        onError={(e) => console.error('❌ Error en video elemento:', e)}
        onCanPlay={() => console.log('✅ Video puede reproducirse')}
      />

      {/* Debug: Estado de la cámara */}
      <div className="absolute top-20 left-4 bg-black/70 text-white p-2 rounded text-xs z-50 space-y-0.5">
        <div className="text-orange-400">🔄 AR Simulado (Fallback)</div>
        <div>Cámara: {cameraActive ? '✅ Activa' : '⏳ Inactiva'}</div>
        <div>Loading: {loading ? 'Sí' : 'No'}</div>
        <div>Anclado: {isPlaced ? '✅ Sí' : '⏳ No'}</div>
        <div>Pos: [{anchorPosition.map(v => v.toFixed(1)).join(', ')}]</div>
        <div className="text-yellow-400 mt-1">Modelo: {attraction.ar_model_url ? '✅' : '❌ Sin URL'}</div>
      </div>

      {/* Indicador de que la cámara no está activa */}
      {!cameraActive && !loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-[90]">
          <div className="text-white text-center">
            <Camera className="h-16 w-16 mx-auto mb-4 animate-pulse" />
            <h3 className="text-xl font-bold mb-2">Activando cámara...</h3>
            <p className="text-gray-300">Por favor, acepta los permisos de cámara</p>
          </div>
        </div>
      )}

      {/* Feedback visual cuando se ancla la escena */}
      {showPlacedFeedback && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[95]">
          <div className="bg-green-500/90 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 animate-pulse">
            <div className="w-3 h-3 bg-white rounded-full"></div>
            <span className="font-bold text-lg">¡Escena anclada!</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-[100] bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center justify-between p-4">
          <div className="text-white">
            <h1 className="text-lg font-bold">{attraction.name}</h1>
            <p className="text-sm text-gray-300">Realidad Aumentada</p>
          </div>
          <button
            onClick={handleClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition"
            aria-label="Cerrar AR"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Canvas 3D con fondo transparente - solo se renderiza cuando la cámara está activa */}
      {cameraActive && (
        <Canvas
          ref={canvasRef}
          camera={{ position: [0, 1.6, 3], fov: 75 }}
          gl={{ 
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: true,
            powerPreference: 'high-performance',
            failIfMajorPerformanceCaveat: false
          }}
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'auto',
            zIndex: 2
          }}
          onPointerDown={handlePlaceScene}
          onCreated={(state) => {
            console.log('✅ Canvas 3D creado, WebGL:', state.gl.capabilities);
          }}
        >
          <ARScene
            attraction={{
              id: attraction.id,
              name: attraction.name,
              description: attraction.description,
              lat: attraction.lat || 0,
              lng: attraction.lng || 0,
              image_url: attraction.image_url,
              ar_model_url: attraction.ar_model_url,
              ar_hotspots: attraction.ar_hotspots,
              has_ar_content: true,
              qr_code: attraction.qr_code,
              category: attraction.category,
          }}
          showGrid={!isPlaced}
          disableOrbitControls={isPlaced && isMobileDevice()}
          anchorPosition={anchorPosition}
          isAnchored={isPlaced}
        />
        </Canvas>
      )}

      {/* Instrucciones y controles inferiores */}
      <div className="absolute bottom-0 left-0 right-0 z-[100] bg-gradient-to-t from-black/80 to-transparent p-4">
        <div className="max-w-md mx-auto">
          {/* Indicador de cámara activa */}
          <div className="flex items-center justify-center gap-2 text-white mb-3">
            <div className={`w-2 h-2 rounded-full ${cameraActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
            <span className="text-sm font-medium">
              {cameraActive ? 'Cámara activa' : 'Sin cámara'}
            </span>
          </div>

          {/* Instrucciones */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-3 text-white text-sm">
            <p className="font-medium mb-1">Instrucciones:</p>
            <ul className="space-y-1 text-xs text-gray-200">
              {!isPlaced ? (
                <>
                  <li>• Apunta la cámara hacia donde quieres colocar el objeto</li>
                  <li>• <strong>Toca la pantalla</strong> para fijar el objeto en esa posición</li>
                  <li>• El objeto aparecerá como si estuviera en el mundo real</li>
                </>
              ) : (
                <>
                  <li>✅ <strong>Objeto anclado</strong> - Ahora está fijo en el espacio</li>
                  <li>• Muévete alrededor para verlo desde diferentes ángulos</li>
                  <li>• La cámara simula movimientos naturales de AR</li>
                  <li>• Los objetos permanecen en su lugar como en AR real</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
