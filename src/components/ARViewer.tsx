'use client';

/**
 * Componente principal de Realidad Aumentada con interfaz intuitiva y profesional
 * Incluye tutorial de introducción, diseño moderno y experiencia guiada para turistas
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Canvas } from '@react-three/fiber';
import { X, AlertTriangle, Maximize2, Camera, Eye, Hand, CheckCircle } from 'lucide-react';
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
  const [showTutorial, setShowTutorial] = useState(true);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
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
      setLoadingState({ isLoading: true, progress: 20, currentAsset: 'Preparando experiencia AR...' });

      // Verificar capacidades WebXR
      const caps = await detectWebXRCapabilities();
      setCapabilities(caps);

      setLoadingState({ isLoading: true, progress: 50, currentAsset: 'Verificando compatibilidad...' });

      // Verificar requisitos mínimos
      const requirements = await meetsARRequirements();

      if (!requirements.meets) {
        throw new Error(
          `Tu dispositivo no es compatible con Realidad Aumentada. ${requirements.missing.join(', ')}`
        );
      }

      if (!caps.isSupported) {
        throw new Error(
          'Realidad Aumentada no está disponible en este navegador. ' +
          'Te recomendamos usar Chrome, Safari o Edge en un dispositivo móvil.'
        );
      }

      setLoadingState({ isLoading: true, progress: 70, currentAsset: 'Configurando cámara...' });

      // Solicitar permisos de cámara de manera más amigable
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false,
          });
          streamRef.current = stream;
          setHasCameraPermission(true);

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(() => {
              // El usuario verá la imagen cuando interactúe
            });
          }
        } catch (cameraError) {
          console.warn('Permisos de cámara denegados:', cameraError);
          setCameraError('Para una mejor experiencia, permite el acceso a la cámara.');
          // Continuamos sin cámara - el usuario puede usar AR en pantalla
        }
      }

      setLoadingState({ isLoading: true, progress: 90, currentAsset: 'Cargando contenido...' });

      // Simular carga de recursos
      await new Promise(resolve => setTimeout(resolve, 500));

      setLoadingState({ isLoading: false, progress: 100 });
    } catch (err) {
      console.error('Error al inicializar AR:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al iniciar Realidad Aumentada';
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

  const startExperience = () => {
    setShowTutorial(false);
  };

  const nextTutorialStep = () => {
    if (tutorialStep < 2) {
      setTutorialStep(tutorialStep + 1);
    } else {
      startExperience();
    }
  };

  const prevTutorialStep = () => {
    if (tutorialStep > 0) {
      setTutorialStep(tutorialStep - 1);
    }
  };

  // Reinicia la colocación del contenido AR sin cerrar el visor
  const resetPlacement = () => {
    setIsPlaced(false);
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
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center text-white max-w-sm mx-4">
          <div className="relative mb-8">
            <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Eye className="h-10 w-10 text-blue-300" />
            </div>
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-400 rounded-full animate-pulse" />
          </div>

          <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent">
            Descubriendo {attraction.name}
          </h2>
          <p className="text-blue-200 mb-6 text-sm">{loadingState.currentAsset}</p>

          <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-purple-400 transition-all duration-500 ease-out rounded-full"
              style={{ width: `${loadingState.progress}%` }}
            />
          </div>

          <p className="text-xs text-blue-300">
            Preparando experiencia de Realidad Aumentada...
          </p>
        </div>
      </div>
    );
  }

  // Renderizar pantalla de error
  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-red-900 via-pink-900 to-purple-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8 max-w-md w-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-red-300" />
            </div>

            <h2 className="text-xl font-bold text-white mb-3">No se pudo iniciar AR</h2>
            <p className="text-gray-200 mb-6 text-sm leading-relaxed">{error}</p>

            <div className="bg-white/5 rounded-xl p-4 mb-6">
              <h3 className="text-white font-semibold mb-3 text-sm">Para usar Realidad Aumentada:</h3>
              <div className="space-y-2 text-xs text-gray-300">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span>Usa Chrome, Safari o Edge</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span>Activa permisos de cámara</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span>Dispositivo con sensores de movimiento</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="w-full bg-white text-red-600 px-6 py-3 rounded-xl font-semibold hover:bg-gray-100 transition-all duration-200 transform hover:scale-105"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Renderizar tutorial de introducción
  if (showTutorial) {
    const tutorialSteps = [
      {
        icon: <Camera className="h-10 w-10 text-blue-400" />,
        title: "Bienvenido a AR",
        description: "Descubre " + attraction.name + " con Realidad Aumentada.",
        detail: "Modelos 3D, multimedia y datos superpuestos en el mundo real."
      },
      {
        icon: <Hand className="h-10 w-10 text-purple-400" />,
        title: "Toca para interactuar",
        description: "Toca, pellizca y mueve tu dispositivo para explorar.",
        detail: "Coloca contenido y descubre información sobre los elementos." 
      },
      {
        icon: <Eye className="h-10 w-10 text-green-400" />,
        title: "Mira y explora",
        description: "Apunta tu cámara para ver el contenido AR.",
        detail: hasCameraPermission
          ? "Cámara lista — busca una superficie plana para colocar el objeto."
          : "Permite acceso a la cámara para una experiencia completa."
      }
    ];

    const currentStep = tutorialSteps[tutorialStep];

    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-blue-700 via-purple-700 to-indigo-800 flex items-center justify-center p-4">
        <div className="bg-white/6 backdrop-blur-sm border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-4">
          <div className="flex justify-center gap-3">
            {tutorialSteps.map((_, index) => (
              <div
                key={index}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === tutorialStep ? 'bg-white scale-110' : 'bg-white/30'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/8 rounded-2xl flex items-center justify-center">
              {currentStep.icon}
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-white">{currentStep.title}</h3>
              <p className="text-xs text-blue-100 mt-1">{currentStep.description}</p>
              <p className="text-[11px] text-blue-200 mt-1">{currentStep.detail}</p>
            </div>
          </div>

          <div className="flex gap-2">
            {tutorialStep > 0 && (
              <button
                onClick={prevTutorialStep}
                className="flex-1 bg-white/8 text-white px-4 py-2 rounded-lg text-sm hover:bg-white/12 transition"
              >
                Anterior
              </button>
            )}

            <button
              onClick={nextTutorialStep}
              className="flex-1 bg-white text-sky-600 px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-95 transition"
            >
              {tutorialStep === tutorialSteps.length - 1 ? 'Comenzar' : 'Siguiente'}
            </button>
          </div>

          <div className="flex justify-center">
            <button
              onClick={startExperience}
              className="text-blue-200 text-xs hover:text-white transition-colors"
            >
              Saltar tutorial
            </button>
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

      {/* Header compacto */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/50 via-black/30 to-transparent">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3 text-white">
            {attraction.image_url && (
              <Image src={attraction.image_url} alt={attraction.name} width={40} height={40} className="w-10 h-10 rounded-lg object-cover shadow-md" />
            )}
            <div>
              <h2 className="text-sm font-semibold">{attraction.name}</h2>
              <p className="text-[11px] text-blue-200">Realidad Aumentada</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={toggleFullscreen}
              className="text-white bg-white/6 hover:bg-white/12 rounded-lg p-2 transition-all duration-150"
              aria-label="Pantalla completa"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              onClick={handleClose}
              className="text-white bg-red-600/10 hover:bg-red-600/20 rounded-lg p-2 transition-all duration-150"
              aria-label="Cerrar AR"
            >
              <X className="h-4 w-4" />
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

      {/* Controles compactos (tarjeta flotante) */}
      <div className="absolute bottom-6 left-1/2 z-20 transform -translate-x-1/2 w-[94%] max-w-lg">
        <div className="bg-black/60 backdrop-blur-md border border-white/6 rounded-2xl p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-white">
            <div className={`w-3 h-3 rounded-full ${hasCameraPermission ? 'bg-green-400' : 'bg-yellow-400'} animate-pulse`} />
            <div className="text-xs">
              <div className="font-semibold">{hasCameraPermission ? 'AR con cámara' : 'AR en pantalla'}</div>
              {capabilities?.arMode === 'immersive-ar' && (
                <div className="text-[11px] text-purple-200 bg-purple-500/10 px-2 py-0.5 rounded-full inline-block mt-1">Inmersivo</div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaced(prev => !prev)}
              title={isPlaced ? 'Anclar/Desanclar' : 'Anclar objeto'}
              className="bg-white/6 text-white px-3 py-2 rounded-lg text-sm hover:bg-white/10 transition"
            >
              {isPlaced ? 'Anclado' : 'Colocar'}
            </button>

            <button
              onClick={resetPlacement}
              title="Reiniciar AR"
              className="bg-sky-500/90 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:opacity-95 transition"
            >
              Reiniciar AR
            </button>

            <button
              onClick={handleClose}
              title="Cerrar"
              className="bg-white/6 text-white px-3 py-2 rounded-lg text-sm hover:bg-white/10 transition"
            >
              Cerrar
            </button>
          </div>
        </div>

        {cameraError && (
          <div className="mt-3 text-center text-xs text-yellow-200">{cameraError}</div>
        )}
      </div>
    </div>
  );

  // Renderizar escena AR (en portal a <body> para asegurar overlay global)
  if (canPortal && typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }

  return content;
}
