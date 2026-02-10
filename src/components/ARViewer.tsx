'use client';

/**
 * Componente principal de Realidad Aumentada usando WebXR y Three.js
 * Renderiza modelos 3D, información y videos en AR
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Canvas } from '@react-three/fiber';
import { X, Loader2, AlertTriangle, Maximize2 } from 'lucide-react';
import type { ARViewerProps, WebXRCapabilities, ARLoadingState } from '@/types/ar';
import { detectWebXRCapabilities, meetsARRequirements, isMobileDevice } from '@/lib/webxr';
import ARScene from './ARScene';

export default function ARViewer({ attraction, onClose, onError }: ARViewerProps) {
  const [capabilities, setCapabilities] = useState<WebXRCapabilities | null>(null);
  const [loadingState, setLoadingState] = useState<ARLoadingState>({
    isLoading: true,
    progress: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [canPortal, setCanPortal] = useState(false);
  const [isPlaced, setIsPlaced] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    initializeAR();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Habilitar portal una vez montado en cliente
  useEffect(() => {
    setCanPortal(true);
  }, []);

  // Detener cámara al desmontar el componente
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const initializeAR = async () => {
    try {
      setLoadingState({ isLoading: true, progress: 20, currentAsset: 'Detectando capacidades...' });

      // Verificar capacidades WebXR
      const caps = await detectWebXRCapabilities();
      setCapabilities(caps);

      setLoadingState({ isLoading: true, progress: 50, currentAsset: 'Verificando requisitos...' });

      // Verificar requisitos mínimos
      const requirements = await meetsARRequirements();
      
      if (!requirements.meets) {
        throw new Error(
          `Requisitos no cumplidos: ${requirements.missing.join(', ')}`
        );
      }

      if (!caps.isSupported) {
        throw new Error(
          'WebXR no está soportado en este dispositivo. ' +
          'Asegúrate de estar usando un navegador moderno en HTTPS.'
        );
      }

      setLoadingState({ isLoading: true, progress: 70, currentAsset: 'Activando cámara...' });

      // Iniciar la cámara para usarla como fondo de la escena
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false,
          });
          streamRef.current = stream;

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            // playsInline es importante en iOS para que no abra el reproductor de video
            await videoRef.current.play().catch(() => {
              // Ignorar errores de autoplay bloqueado; el usuario verá la imagen cuando interactúe
            });
          }
        } catch (cameraError) {
          console.warn('No se pudo iniciar la cámara para AR:', cameraError);
          setCameraError('No se pudo acceder a la cámara. Revisa los permisos del navegador.');
          // No abortamos por completo: permitimos "AR en pantalla" sin fondo de cámara
        }
      }

      setLoadingState({ isLoading: true, progress: 90, currentAsset: 'Cargando escena AR...' });

      // Simular carga de recursos (modelos, texturas, etc.)
      await new Promise(resolve => setTimeout(resolve, 500));

      setLoadingState({ isLoading: false, progress: 100 });
    } catch (err) {
      console.error('Error al inicializar AR:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      
      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMessage));
      }
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!isFullscreen) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('Error al cambiar pantalla completa:', err);
    }
  };

  const handleClose = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (isFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    onClose();
  };

  // Primer toque en la escena: considerar que el usuario "pegó" la escena al entorno
  const handleScenePointerDown = () => {
    if (!isPlaced) {
      setIsPlaced(true);
    }
  };

  // Renderizar pantalla de carga
  if (loadingState.isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Iniciando Realidad Aumentada</h2>
          <p className="text-gray-300 mb-4">{loadingState.currentAsset}</p>
          <div className="w-64 h-2 bg-gray-700 rounded-full overflow-hidden mx-auto">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${loadingState.progress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Renderizar pantalla de error
  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center p-4">
        <div className="bg-red-500/20 border-2 border-red-500 rounded-lg p-6 max-w-md">
          <div className="flex items-start gap-3 text-white">
            <AlertTriangle className="h-6 w-6 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-xl font-bold mb-2">Error al iniciar AR</h2>
              <p className="text-gray-200 mb-4">{error}</p>
              <div className="space-y-2 text-sm text-gray-300">
                <p>Para usar Realidad Aumentada necesitas:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Conexión segura (HTTPS)</li>
                  <li>Navegador moderno (Chrome, Safari, Edge)</li>
                  <li>Permisos de cámara activados</li>
                  <li>Dispositivo con sensores de movimiento</li>
                </ul>
              </div>
              <button
                onClick={handleClose}
                className="mt-6 bg-white text-red-500 px-6 py-3 rounded-lg font-semibold w-full hover:bg-gray-100 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Contenido principal de la escena AR
  const content = (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-black overflow-hidden">
      {/* Fondo de cámara (si está disponible) */}
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
            <h2 className="text-lg font-bold">{attraction.name}</h2>
            <p className="text-sm text-gray-300">Modo Realidad Aumentada</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={toggleFullscreen}
              className="text-white hover:bg-white/20 rounded-full p-2 transition"
              aria-label="Pantalla completa"
            >
              <Maximize2 className="h-5 w-5" />
            </button>
            <button
              onClick={handleClose}
              className="text-white hover:bg-white/20 rounded-full p-2 transition"
              aria-label="Cerrar AR"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Escena 3D con Three.js */}
      <Canvas
        camera={{ position: [0, 1.6, 3], fov: 75 }}
        gl={{ alpha: true }}
        style={{ background: 'transparent' }}
        onPointerDown={handleScenePointerDown}
      >
        <ARScene 
          attraction={attraction}
          capabilities={capabilities!}
          showGrid={!isPlaced}
          disableOrbitControls={isPlaced && isMobileDevice()}
        />
      </Canvas>

      {/* Controles e información */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
        <div className="max-w-md mx-auto">
          {/* Indicador de modo AR */}
          <div className="flex items-center justify-center gap-2 text-white mb-3">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium">
              {capabilities?.arMode === 'immersive-ar' ? 'AR Inmersivo' : 'AR en pantalla'}
            </span>
          </div>

          {/* Instrucciones */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-3 text-white text-sm">
            <p className="font-medium mb-1">Instrucciones:</p>
            <ul className="space-y-1 text-xs text-gray-200">
              {!isPlaced && (
                <li>• Toca una vez la escena para colocarla y ocultar la grilla</li>
              )}
              <li>• Mueve tu dispositivo para explorar en 360°</li>
              <li>• Toca los elementos flotantes para ver más información</li>
              <li>• Usa pellizco para acercar/alejar modelos 3D</li>
            </ul>
          </div>

          {cameraError && (
            <div className="mt-3 bg-red-500/80 text-white text-xs rounded-md px-3 py-2">
              {cameraError}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Renderizar escena AR (en portal a <body> para asegurar overlay global)
  if (canPortal && typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }

  return content;
}
