'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Canvas } from '@react-three/fiber';
import { X, Loader2, AlertTriangle } from 'lucide-react';
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

  useEffect(() => {
    initAR();
    return () => {
      // Limpiar stream al desmontar
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const initAR = async () => {
    try {
      // Verificar capacidades WebXR
      const caps = await detectWebXRCapabilities();
      const requirements = await meetsARRequirements();

      if (!requirements.meets) {
        throw new Error(`Requisitos no cumplidos: ${requirements.missing.join(', ')}`);
      }

      if (!caps.isSupported) {
        throw new Error(
          'WebXR no está soportado. Usa un navegador moderno en HTTPS.'
        );
      }

      // Iniciar cámara
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
            audio: false,
          });
          streamRef.current = stream;

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setCameraActive(true);
          }
        } catch (camError) {
          console.error('Error iniciando cámara:', camError);
          setError('No se pudo acceder a la cámara. Verifica los permisos.');
          return;
        }
      }

      setLoading(false);
    } catch (err) {
      console.error('Error inicializando AR:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setLoading(false);
    }
  };

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
        autoPlay
        muted
        playsInline
      />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent">
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

      {/* Canvas 3D con fondo transparente */}
      <Canvas
        ref={canvasRef}
        camera={{ position: [0, 1.6, 3], fov: 75 }}
        gl={{ 
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: true
        }}
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'auto'
        }}
        onPointerDown={handlePlaceScene}
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

      {/* Instrucciones y controles inferiores */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
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
