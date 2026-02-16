'use client';

import React, { Suspense, useState, useMemo, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { XR, ARButton, createXRStore } from '@react-three/xr';
import { Environment, Html } from '@react-three/drei';
import * as THREE from 'three';
import { ARHitTest } from './ARHitTest';
import ARScene from './ARScene';
import type { ARData } from '@/types/ar';

// WebXR Advanced Features
import { ARAnchors, type ARAnchorData } from './ARAnchors';
import { ARLightEstimation } from './ARLightEstimation';
import { ARDepthSensing } from './ARDepthSensing';
import { ARCameraAccess } from './ARCameraAccess';
// Imagen Tracking
import ARImageTracking, { type TrackedImageResult, type TrackableImage } from './ARImageTracking';

// Icons for improved UI
import { X, Play, MapPin, Camera, CheckCircle, RotateCcw, Anchor, Lightbulb, Layers } from 'lucide-react';

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
  reference_image_url?: string;
  qr_physical_width?: number;
};

interface WebXRSceneProps {
  attraction: Attraction;
  onClose: () => void;
}

// Componente principal de la escena WebXR con características avanzadas
export function WebXRScene({ attraction, onClose }: WebXRSceneProps) {
  const [placedObject, setPlacedObject] = useState<{
    position: THREE.Vector3;
    rotation: THREE.Quaternion;
    anchorId?: string; // ID del anchor si está persistido
  } | null>(null);
  
  // Estado de características avanzadas
  const [features, setFeatures] = useState({
    anchors: false,
    lightEstimation: false,
    depthSensing: false,
    cameraAccess: false,
    imageTracking: false
  });
  
  // Estado para image tracking (preparado para uso futuro)
  // const [trackedImages, setTrackedImages] = useState<Map<string, TrackedImageResult>>(new Map());
  // Preparar imágenes rastreables si el atractivo tiene `reference_image_url`
  const trackableImages: TrackableImage[] = useMemo(() => {
    if (!attraction.reference_image_url) return [];
    return [{
      id: attraction.id,
      name: attraction.name,
      imageUrl: attraction.reference_image_url,
      widthInMeters: Number(attraction.qr_physical_width ?? 0.15)
    }];
  }, [attraction.reference_image_url, attraction.id, attraction.name, attraction.qr_physical_width]);
  
  // Crear XR Store - @react-three/xr v6
  // Las features de sesión se configuran automáticamente según el modo (AR/VR)
  // Para habilitar features opcionales, se pueden especificar al entrar en sesión
  const store = createXRStore();

  const handlePlace = (result: { position: THREE.Vector3; rotation: THREE.Quaternion }) => {
    // Solo permitir una colocación
    if (placedObject) return;
    
    console.log('📍 Colocando objeto en posición real:', result.position.toArray());
    
    setPlacedObject({
      position: result.position.clone(),
      rotation: result.rotation.clone()
    });
  };
  
  // Handler para cuando se crea un anchor
  const handleAnchorCreated = (anchor: ARAnchorData) => {
    console.log('🔗 Anchor creado:', anchor.id);
    setFeatures(prev => ({ ...prev, anchors: true }));
    
    // Actualizar objeto colocado con el anchor ID
    if (placedObject) {
      setPlacedObject(prev => prev ? { ...prev, anchorId: anchor.id } : null);
    }
  };
  
  // Handler para actualización de iluminación
  const handleLightUpdate = () => {
    // Light estimation se aplica automáticamente a la escena
    setFeatures(prev => ({ ...prev, lightEstimation: true }));
  };
  
  // Handler para depth sensing
  const handleDepthUpdate = () => {
    setFeatures(prev => ({ ...prev, depthSensing: true }));
  };
  
  // Handler para camera access
  const handleCameraFrame = () => {
    setFeatures(prev => ({ ...prev, cameraAccess: true }));
  };
  
  // Preparado para Image Tracking (activar cuando se configuren imágenes/QR)
  /*
  const handleImageDetected = (result: TrackedImageResult) => {
    console.log('📷 Imagen detectada:', result.name);
    setFeatures(prev => ({ ...prev, imageTracking: true }));
    // setTrackedImages(prev => new Map(prev).set(result.id, result));
    
    // Auto-colocar objeto en la posición de la imagen si no hay objeto ya colocado
    if (!placedObject) {
      setPlacedObject({
        position: result.position.clone(),
        rotation: new THREE.Quaternion().setFromEuler(result.rotation)
      });
    }
  };
  
  // Handler para cuando se pierde tracking de una imagen
  const handleImageLost = (imageId: string) => {
    console.log('📷 Imagen perdida:', imageId);
    // setTrackedImages(prev => {
    //   const next = new Map(prev);
    //   next.delete(imageId);
    //   return next;
    // });
  };
  */

  const handleReset = () => {
    setPlacedObject(null);
    // reset search state handled by UI when placedObject is null
  };

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      {/* Device camera preview before entering AR (uses getUserMedia) */}
      <DeviceCameraPreview />
      {/* Header — compacto y profesional */}
      <div className="absolute top-4 left-4 right-4 z-50 flex items-center justify-between">
        <div className="flex items-center gap-3 bg-black/40 backdrop-blur-sm border border-white/8 rounded-lg p-2 px-3 shadow-sm animate-header-in">
          <div className="flex items-center gap-3">
            {attraction.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={attraction.image_url} alt={attraction.name} className="w-10 h-10 rounded-md object-cover shadow" />
            ) : (
              <div className="w-10 h-10 rounded-md bg-gradient-to-br from-sky-600 to-indigo-600 flex items-center justify-center text-white font-semibold">AR</div>
            )}
            <div className="text-sm tracking-tight leading-5">
              <div className="text-white font-semibold text-base leading-5">{attraction.name}</div>
              <div className="text-[11px] text-sky-200 tracking-wide">Realidad aumentada · WebXR</div>
            </div>
          </div>

          <div className="ml-4 flex items-center gap-2">
            {placedObject ? (
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-2 bg-green-500/20 px-2 py-1 rounded-full text-xs text-green-300 tracking-wide">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span className="font-medium">Anclado</span>
                </div>
                {/* Indicadores de features avanzadas activas */}
                {placedObject.anchorId && (
                  <div className="inline-flex items-center gap-1 bg-purple-500/20 px-2 py-1 rounded-full text-xs text-purple-300" title="Anchor persistente">
                    <Anchor className="h-3 w-3" />
                  </div>
                )}
                {features.lightEstimation && (
                  <div className="inline-flex items-center gap-1 bg-amber-500/20 px-2 py-1 rounded-full text-xs text-amber-300" title="Light Estimation activa">
                    <Lightbulb className="h-3 w-3" />
                  </div>
                )}
                {features.depthSensing && (
                  <div className="inline-flex items-center gap-1 bg-blue-500/20 px-2 py-1 rounded-full text-xs text-blue-300" title="Depth Sensing activo">
                    <Layers className="h-3 w-3" />
                  </div>
                )}
                {features.imageTracking && (
                  <div className="inline-flex items-center gap-1 bg-pink-500/20 px-2 py-1 rounded-full text-xs text-pink-300" title="Image Tracking activo">
                    <Camera className="h-3 w-3" />
                  </div>
                )}
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 bg-yellow-500/20 px-2 py-1 rounded-full text-xs text-yellow-300 tracking-wide">
                <Camera className="h-4 w-4 text-yellow-400" />
                <span className="font-medium">Buscando superficie...</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="ml-2 bg-white/6 hover:bg-white/12 text-white p-2 rounded-lg transition-all duration-150 shadow-sm border border-white/6"
            aria-label="Cerrar AR"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      {/* AR action (primary) */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-3">
        <ARButton
          store={store}
          className="flex items-center gap-3 bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-semibold py-3 px-5 rounded-full shadow-xl transition-all duration-200 transform hover:scale-102 border border-white/10 animate-ar-button"
          onError={(error) => {
            console.error('❌ WebXR AR Error:', error);
            console.log('💡 Asegúrate de estar en HTTPS y tener un dispositivo compatible');
          }}
        >
          <Play className="h-4 w-4" />
          <span className="uppercase tracking-wide text-sm">Iniciar AR</span>
        </ARButton>

        {/* Reset button - solo visible si ya se colocó el objeto */}
        {placedObject && (
          <button
            onClick={handleReset}
            className="bg-black/50 text-white px-3 py-2 rounded-lg border border-white/6 shadow-sm text-sm hover:bg-black/60 transition"
            title="Reiniciar colocación"
          >
            <RotateCcw className="h-4 w-4 mr-2 inline-block" />Reiniciar
          </button>
        )}
      </div>

      {/* Canvas WebXR
          Nota: En WebXR real, la cámara sigue automáticamente al usuario.
          La posición inicial solo aplica antes de entrar en sesión AR.
          @react-three/xr maneja la configuración XR automáticamente.
      */}
      <Canvas
        camera={{ 
          position: [0, 1.6, 3], 
          fov: 75,
          near: 0.01,
          far: 20
        }}
        gl={{ 
          antialias: true,
          preserveDrawingBuffer: true,
          powerPreference: 'high-performance'
        }}
        style={{ 
          width: '100%',
          height: '100%'
        }}
      >
        {/* Envolvedor XR - habilita WebXR en el Canvas */}
        <XR store={store}>
          {/* ========================================
              WebXR Advanced Features Implementation
              ======================================== */}
          
          {/* Anchors API: Persistencia de objetos en posiciones del mundo real */}
          <ARAnchors 
            onAnchorCreated={handleAnchorCreated}
            debug={false}
          />
          
          {/* Light Estimation: Iluminación realista según el entorno */}
          <ARLightEstimation 
            autoApply={true}
            intensityScale={1.0}
            onLightUpdate={handleLightUpdate}
            debug={false}
          />
          
          {/* Depth Sensing: Oclusión realista de objetos */}
          <ARDepthSensing 
            format="luminance-alpha"
            usage="cpu-optimized"
            autoApplyOcclusion={false}
            visualizeDepth={false}
            onDepthUpdate={handleDepthUpdate}
            debug={false}
          />
          
          {/* Camera Access: Mezclar video real con contenido 3D */}
          <ARCameraAccess 
            showAsBackground={false}
            videoEffect="none"
            backgroundOpacity={1.0}
            onCameraFrame={handleCameraFrame}
            debug={false}
          />
          
          {/* Image Tracking: Detectar QR codes y marcadores para posicionar objetos */}
          {/* Activar ARImageTracking automáticamente si hay una imagen de referencia */}
          {trackableImages.length > 0 && (
            <ARImageTracking
              images={trackableImages}
              onImageDetected={(result: TrackedImageResult) => {
                console.log('📷 Imagen detectada (WebXRScene):', result);
                setFeatures(prev => ({ ...prev, imageTracking: true }));
                if (!placedObject) {
                  setPlacedObject({ position: result.position.clone(), rotation: new THREE.Quaternion().setFromEuler(result.rotation) });
                }
              }}
              onImageLost={(id: string) => { console.log('📷 Imagen perdida (WebXRScene):', id); }}
              autoCreateAnchors={true}
              showDebugMarkers={true}
            />
          )}
          
          {/* ========================================
              Standard AR Scene Setup
              ======================================== */}
          
          {/* Iluminación base (se complementa con Light Estimation) */}
          <ambientLight intensity={0.4} />
          <directionalLight 
            position={[5, 5, 5]} 
            intensity={0.8} 
            castShadow 
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <pointLight position={[-5, 5, -5]} intensity={0.4} />

          {/* Entorno */}
          <Environment preset="city" />

          {/* Hit Testing - permite colocar objetos en superficies reales */}
          <ARHitTest 
            onPlace={handlePlace} 
            showReticle={!placedObject}
            singlePlacement={true}
            autoPlace={false}
          >
            {!placedObject && (
              <Suspense fallback={<LoadingModel />}>
                <ARObjectModel 
                  attraction={attraction}
                  scale={0.3}
                />
              </Suspense>
            )}
          </ARHitTest>

          {/* Objeto ya colocado en el mundo - SOLO UNO */}
          {placedObject && (
            <group
              position={placedObject.position}
              quaternion={placedObject.rotation}
            >
              <Suspense fallback={null}>
                <ARObjectModel 
                  attraction={attraction}
                  scale={0.3}
                  isPlaced={true}
                />
              </Suspense>
            </group>
          )}

        </XR>
      </Canvas>



      <div className="absolute bottom-28 left-4 right-4 z-40 pointer-events-none">
        <div className="pointer-events-auto max-w-2xl mx-auto bg-black/50 backdrop-blur-sm border border-white/8 rounded-2xl p-4 shadow-md text-white animate-instructions">
          <div className="text-center">
            {!placedObject ? (
              <div>
                <div className="text-sm font-semibold mb-2">Buscando superficie...</div>
                <div className="text-[12px] text-slate-300">Apunta tu cámara a una superficie plana como el suelo o una mesa</div>
                <div className="flex items-center justify-center gap-4 mt-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Camera className="h-3 w-3 text-sky-300" />
                    <span>Apunta la cámara</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3 w-3 text-emerald-300" />
                    <span>Toca para colocar</span>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-sm font-semibold mb-2 flex items-center justify-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  Objeto anclado exitosamente
                </div>
                <div className="text-[12px] text-slate-300">
                  Muévete alrededor para explorar el objeto desde diferentes ángulos
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Animations & custom keyframes for this component */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes popIn { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
          @keyframes pulseCount { 0%{ transform: scale(1); } 50%{ transform: scale(1.12); } 100%{ transform: scale(1); } }
          @keyframes floatSubtle { 0%{ transform: translateY(0); } 50%{ transform: translateY(-3px); } 100%{ transform: translateY(0); } }

          .animate-header-in { animation: popIn 420ms cubic-bezier(.2,.9,.2,1) both; }
          .animate-ar-button { animation: popIn 380ms cubic-bezier(.2,.9,.2,1) both; }
          .animate-instructions { animation: fadeInUp 480ms cubic-bezier(.22,.9,.1,1) both; }
          .pulse-count { animation: pulseCount 420ms cubic-bezier(.2,.9,.2,1) both; }

          /* soft floating on large screens to add life (reduced motion respects user pref) */
          @media (prefers-reduced-motion: no-preference) {
            .animate-ar-button:hover { transform: translateY(-4px) scale(1.02); transition: transform 180ms ease; }
            .animate-ar-button { will-change: transform; }
            .float-subtle { animation: floatSubtle 4s ease-in-out infinite; }
          }
        `
      }} />
    </div>
  );
}

// Modelo AR del objeto principal
function ARObjectModel({ 
  attraction, 
  scale = 1,
  isPlaced = false 
}: { 
  attraction: Attraction;
  scale?: number;
  isPlaced?: boolean;
}) {
  // Extraer phonePreview de la BD si existe
  const arHotspots = attraction.ar_hotspots as Record<string, unknown> | undefined;
  const phonePreviewRaw = arHotspots?.phonePreview as Record<string, unknown> | undefined;
  const phonePreview = phonePreviewRaw
    ? {
        cameraDistance: Number(phonePreviewRaw.cameraDistance ?? 1.0),
        yOffset: Number(phonePreviewRaw.yOffset ?? 0),
        previewScale: Number(phonePreviewRaw.previewScale ?? 1.0)
      }
    : undefined;

  // Si hay modelo 3D, usar ARScene existente
  if (attraction.ar_model_url) {
    return (
      <group scale={[scale, scale, scale]}>
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
          showGrid={false}
          disableOrbitControls={true}
          anchorPosition={[0, 0, 0]}
          isAnchored={isPlaced}
          phonePreview={phonePreview}
        />
      </group>
    );
  }

  // Modelo placeholder con información del atractivo
  if (attraction.image_url && attraction.image_url.trim() !== '') {
    return (
      <group scale={[scale, scale, scale]}>
        <mesh position={[0, 0.75, 0]}>
          <planeGeometry args={[1.2, 1.6]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.2} />
        </mesh>
        <Html transform sprite position={[0, 0.75, 0]} distanceFactor={2}>
          <div
            style={{
              width: 220,
              height: 280,
              borderRadius: 16,
              border: '2px solid rgba(255,255,255,0.9)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
              backgroundImage: `url(${attraction.image_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              overflow: 'hidden'
            }}
          />
        </Html>
      </group>
    );
  }

  // Fallback mínimo si no hay imagen
  return (
    <group scale={[scale, scale, scale]}>
      {/* Modelo principal */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.35, 0.35, 0.35]} />
        <meshStandardMaterial 
          color="#1A3A6C"
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>
      
      {/* Etiqueta con nombre */}
      <mesh position={[0, 0.45, 0]}>
        <planeGeometry args={[1.5, 0.4]} />
        <meshBasicMaterial 
          color="#ffffff"
          alphaTest={0.1}
        />
      </mesh>
    </group>
  );
}

// Componente de loading
function LoadingModel() {
  return (
    <mesh>
      <sphereGeometry args={[0.2, 16, 16]} />
      <meshBasicMaterial color="#666" wireframe />
    </mesh>
  );
}

// Small helper component: show device camera preview using getUserMedia
function DeviceCameraPreview() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    let mounted = true;
    let stream: MediaStream | null = null;

    const start = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
          setActive(true);
        }
      } catch (err) {
        // permission denied or not available
        setActive(false);
        if (stream) stream.getTracks().forEach(t => t.stop());
      }
    };

    start();

    return () => {
      mounted = false;
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Renders a full-bleed video behind the canvas. Pointer events disabled so UI remains interactive.
  return (
    <video
      ref={videoRef}
      className={`absolute inset-0 w-full h-full object-cover ${active ? 'opacity-100' : 'opacity-0'}`}
      style={{ zIndex: 0, pointerEvents: 'none' }}
      playsInline
      muted
    />
  );
}

export default WebXRScene;