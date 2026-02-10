'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Canvas } from '@react-three/fiber';
import { X, Loader2, AlertTriangle, Camera } from 'lucide-react';
import type { ARData } from '@/types/ar';
import { detectWebXRCapabilities, meetsARRequirements, isMobileDevice } from '@/lib/webxr';
import ARScene from './ARPageClient/ARScene';

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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Efecto para iniciar la cámara
  useEffect(() => {
    const initCamera = async () => {
      try {
        console.log('🎥 Iniciando cámara...');
        
        if (!navigator.mediaDevices?.getUserMedia) {
          setError('Tu navegador no soporta acceso a la cámara.');
          setLoading(false);
          return;
        }

        console.log('🎥 Solicitando acceso a cámara...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false,
        });
        
        console.log('✅ Cámara obtenida:', stream.active);
        console.log('📹 Tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })));
        streamRef.current = stream;

        // Esperar a que el video ref esté disponible
        let attempts = 0;
        const assignStreamToVideo = () => {
          console.log(`📹 Intento ${attempts + 1} - Video ref disponible:`, !!videoRef.current);
          
          if (videoRef.current) {
            const video = videoRef.current;
            console.log('📹 Asignando stream a video elemento');
            video.srcObject = stream;
            
            // Reproducir video
            video.play()
              .then(() => {
                console.log('✅ Video reproduciendo');
                setCameraActive(true);
                setLoading(false);
              })
              .catch(err => {
                console.error('❌ Error reproduciendo video:', err);
                // Reintento después de metadata
                video.onloadedmetadata = () => {
                  console.log('📹 Metadata cargado, reintentando...');
                  video.play()
                    .then(() => {
                      console.log('✅ Video reproduciendo (segundo intento)');
                      setCameraActive(true);
                      setLoading(false);
                    })
                    .catch(retryErr => {
                      console.error('❌ Error en segundo intento:', retryErr);
                      setLoading(false);
                    });
                };
              });
          } else if (attempts < 10) {
            // Reintentar si el ref no está disponible
            attempts++;
            setTimeout(assignStreamToVideo, 100);
          } else {
            console.error('❌ Video ref no disponible después de 10 intentos');
            setError('No se pudo inicializar el video. Intenta recargar la página.');
            setLoading(false);
          }
        };

        assignStreamToVideo();

        // Verificar capacidades WebXR (no bloquea)
        try {
          const caps = await detectWebXRCapabilities();
          const requirements = await meetsARRequirements();
          console.log('📱 WebXR capabilities:', caps);
          console.log('📱 AR requirements:', requirements);
        } catch (webxrError) {
          console.warn('⚠️ WebXR no disponible:', webxrError);
        }

      } catch (err) {
        console.error('❌ Error iniciando cámara:', err);
        setError(`No se pudo acceder a la cámara: ${err instanceof Error ? err.message : 'Error desconocido'}`);
        setLoading(false);
      }
    };

    initCamera();
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        console.log('🛑 Stream detenido');
      }
    };
  }, []);

  const handleClose = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    router.push(`/explorar/${attraction.id}`);
  };

  const handlePlaceScene = () => {
    if (!isPlaced) {
      setIsPlaced(true);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-bold">Iniciando Realidad Aumentada</h2>
          <p className="text-gray-300 mt-2">Preparando cámara y sensores...</p>
        </div>
      </div>
    );
  }

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
                  <li>Acepta los permisos de cámara cuando el navegador los solicite</li>
                  <li>Verifica que estés usando HTTPS (conexión segura)</li>
                  <li>Intenta recargar la página y dar permisos nuevamente</li>
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
      <div className="absolute top-20 left-4 bg-black/70 text-white p-2 rounded text-xs z-50">
        <div>Cámara: {cameraActive ? '✅ Activa' : '⏳ Inactiva'}</div>
        <div>Stream: {streamRef.current ? '✅' : '❌'}</div>
        <div>Video Ref: {videoRef.current ? '✅' : '❌'}</div>
        <div>Loading: {loading ? 'Sí' : 'No'}</div>
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
                  <li>• Apunta la cámara hacia una superficie plana (mesa, suelo)</li>
                  <li>• <strong>Toca la pantalla</strong> para anclar la escena en ese punto</li>
                </>
              ) : (
                <>
                  <li>• Mueve el dispositivo para ver los objetos desde diferentes ángulos</li>
                  <li>• Toca los elementos para ver más información</li>
                  <li>• Los objetos están anclados al mundo real</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
