'use client';

import { useEffect, useRef, useState } from 'react';
import { useXR } from '@react-three/xr';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Tipos locales para WebXR experimental (definidos a nivel de módulo)
type XRStateForFrame = { gl?: { xr?: { getFrame?: () => XRFrame; getReferenceSpace?: () => XRReferenceSpace } } };
interface XRImageTrackingResultLike {
  index: number;
  trackingState?: string;
  imageSpace?: XRSpace;
  measuredSize?: { width?: number; height?: number };
}
interface XRPoseLike {
  transform: {
    position: { x: number; y: number; z: number };
    orientation: { x: number; y: number; z: number; w: number };
    matrix?: number[];
  };
}

declare global {
  interface XRFrame {
    // Experimental extension used by some browsers for image tracking
    getImageTrackingResults?: () => XRImageTrackingResultLike[];
  }
}

/**
 * ARImageTracking - Componente para detectar imágenes y QR codes en el mundo real
 * 
 * Permite anclar objetos 3D a imágenes conocidas (marcadores, QR codes, logos, etc.)
 * usando la Image Tracking API de WebXR.
 * 
 * Casos de uso:
 * - Posicionar objetos desde códigos QR
 * - Detectar logos/marcadores y mostrar contenido AR
 * - Crear experiencias AR activadas por imágenes físicas
 * 
 * Compatibilidad:
 * - Android Chrome 88+ (experimental)
 * - iOS Safari 15+ (limitado)
 * - Requiere feature 'image-tracking' en sesión XR
 */

// Interfaz para una imagen rastreable
export interface TrackableImage {
  id: string;
  name: string;
  imageUrl: string; // URL de la imagen de referencia
  widthInMeters: number; // Ancho físico real de la imagen en metros
  bitmap?: ImageBitmap; // Bitmap cargado (generado internamente)
}

// Interfaz para resultado de tracking
export interface TrackedImageResult {
  id: string;
  name: string;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  matrix: THREE.Matrix4;
  measuredSize: { width: number; height: number }; // Tamaño medido en metros
  trackingState: 'tracking' | 'emulated' | 'limited';
  xrImageSpace?: XRSpace; // XRSpace de la imagen (para crear anchors)
}

interface ARImageTrackingProps {
  images: TrackableImage[]; // Imágenes a rastrear
  onImageDetected?: (result: TrackedImageResult) => void;
  onImageLost?: (imageId: string) => void;
  autoCreateAnchors?: boolean; // Crear anchors automáticamente
  showDebugMarkers?: boolean; // Mostrar marcadores de debug
  children?: React.ReactNode;
}

// API global para acceso imperativo
interface ARImageTrackingAPI {
  trackedImages: Map<string, TrackedImageResult>;
  getTrackedImage: (id: string) => TrackedImageResult | undefined;
  getAllTrackedImages: () => TrackedImageResult[];
  isImageTracked: (id: string) => boolean;
}

// Exponer API globalmente
declare global {
  interface Window {
    __arImageTrackingAPI?: ARImageTrackingAPI;
    __arAnchorsAPI?: {
      createAnchorFromPose: (position: THREE.Vector3, rotation: THREE.Euler) => Promise<string | null>;
    };
  }
}

export default function ARImageTracking({
  images,
  onImageDetected,
  onImageLost,
  autoCreateAnchors = false,
  showDebugMarkers = true,
  children
}: ARImageTrackingProps) {
  const { session } = useXR();
  
  const [trackedImages, setTrackedImages] = useState<Map<string, TrackedImageResult>>(new Map());
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [loadedImages, setLoadedImages] = useState<TrackableImage[]>([]);
  const trackedImagesRef = useRef<Map<string, TrackedImageResult>>(new Map());
  const previousTrackedIdsRef = useRef<Set<string>>(new Set());

  // Cargar imágenes como ImageBitmap
  useEffect(() => {
    let mounted = true;
    const loadedBitmaps: TrackableImage[] = [];

    const loadImages = async () => {
      const loaded: TrackableImage[] = [];

      for (const img of images) {
        try {
          const response = await fetch(img.imageUrl);
          const blob = await response.blob();
          const bitmap = await createImageBitmap(blob);
          
          if (mounted) {
            const imageWithBitmap = {
              ...img,
              bitmap
            };
            loaded.push(imageWithBitmap);
            loadedBitmaps.push(imageWithBitmap);
          }
        } catch (error) {
          console.error(`Error cargando imagen ${img.name}:`, error);
        }
      }

      if (mounted) {
        setLoadedImages(loaded);
        console.log(`✅ ${loaded.length} imágenes cargadas para tracking`);
      }
    };

    loadImages();

    return () => {
      mounted = false;
      // Cleanup bitmaps usando el array local
      loadedBitmaps.forEach(img => {
        if (img.bitmap) {
          img.bitmap.close();
        }
      });
    };
  }, [images]);

  // Verificar si Image Tracking está soportado
  useEffect(() => {
    if (!session) {
      // Defer state update to avoid synchronous setState
      const timer = setTimeout(() => setIsSupported(null), 0);
      return () => clearTimeout(timer);
    }

    // Evitar `any`: anotar session con posible propiedad experimental
    const xrSession = session as XRSession & { trackedImageScores?: unknown };
    // Verificar si la sesión soporta image-tracking (prop experimental)
    if (typeof (xrSession as unknown as Record<string, unknown>).trackedImageScores !== 'undefined') {
      const timer = setTimeout(() => setIsSupported(true), 0);
      console.log('✅ Image Tracking soportado');
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => setIsSupported(false), 0);
      console.warn('⚠️ Image Tracking NO soportado en este dispositivo');
      return () => clearTimeout(timer);
    }
  }, [session]);

  // Frame loop: Actualizar tracking de imágenes
  useFrame((state) => {
    if (!session || !isSupported || loadedImages.length === 0) return;

    const frame = (state as unknown as XRStateForFrame).gl?.xr?.getFrame?.() as XRFrame | undefined;
    if (!frame) return;

    try {
      // Obtener resultados de tracking de imágenes (tipo local)
      const trackedResults = frame.getImageTrackingResults?.() as XRImageTrackingResultLike[] | undefined;
      if (!trackedResults) return;

      const currentTrackedIds = new Set<string>();
      const updatedMap = new Map<string, TrackedImageResult>();

      trackedResults.forEach((result) => {
        const imageIndex = result.index as number;
        if (imageIndex >= loadedImages.length) return;

        const trackableImage = loadedImages[imageIndex];
        
        const trackingState = result.trackingState as string;
        
        // Solo procesar imágenes que están siendo rastreadas
        if (trackingState !== 'tracking' && trackingState !== 'emulated') return;

        // Obtener pose de la imagen
        const referenceSpace = (state as unknown as XRStateForFrame).gl?.xr?.getReferenceSpace?.();
        if (!referenceSpace) return;

        const imagePose = frame.getPose?.(result.imageSpace as XRSpace, referenceSpace as XRReferenceSpace) as XRPoseLike | undefined;
        if (!imagePose) return;

        // Extraer posición y rotación
        const transform = imagePose.transform;
        const position = new THREE.Vector3(
          transform.position.x,
          transform.position.y,
          transform.position.z
        );

        const quaternion = new THREE.Quaternion(
          transform.orientation.x,
          transform.orientation.y,
          transform.orientation.z,
          transform.orientation.w
        );

        const rotation = new THREE.Euler().setFromQuaternion(quaternion);
        
        const matrix = new THREE.Matrix4().compose(
          position,
          quaternion,
          new THREE.Vector3(1, 1, 1)
        );

        // Obtener tamaño medido (puede diferir del tamaño esperado)
        const measuredSize = result.measuredSize || { width: trackableImage.widthInMeters, height: trackableImage.widthInMeters };

        const trackedResult: TrackedImageResult = {
          id: trackableImage.id,
          name: trackableImage.name,
          position,
          rotation,
          matrix,
          measuredSize: {
            width: measuredSize.width || trackableImage.widthInMeters,
            height: measuredSize.height || trackableImage.widthInMeters
          },
          trackingState: trackingState as 'tracking' | 'emulated' | 'limited',
          xrImageSpace: result.imageSpace
        };

        updatedMap.set(trackableImage.id, trackedResult);
        currentTrackedIds.add(trackableImage.id);

        // Detectar nueva imagen (no estaba en el frame anterior)
        if (!previousTrackedIdsRef.current.has(trackableImage.id)) {
          console.log(`📷 Nueva imagen detectada: ${trackableImage.name}`);
          onImageDetected?.(trackedResult);

          // Crear anchor automáticamente si está habilitado
          if (autoCreateAnchors && window.__arAnchorsAPI) {
            window.__arAnchorsAPI.createAnchorFromPose(
              position,
              rotation
            ).then((anchorId) => {
              if (anchorId) {
                console.log(`🔗 Anchor creado automáticamente para imagen ${trackableImage.name}: ${anchorId}`);
              }
            }).catch((error) => {
              console.error('Error creando anchor:', error);
            });
          }
        }
      });

      // Detectar imágenes perdidas
      previousTrackedIdsRef.current.forEach((prevId) => {
        if (!currentTrackedIds.has(prevId)) {
          const lostImage = loadedImages.find(img => img.id === prevId);
          console.log(`📷 Imagen perdida: ${lostImage?.name || prevId}`);
          onImageLost?.(prevId);
        }
      });

      // Actualizar referencias
      trackedImagesRef.current = updatedMap;
      previousTrackedIdsRef.current = currentTrackedIds;
      setTrackedImages(new Map(updatedMap));

    } catch (error) {
      console.error('Error en image tracking frame:', error);
    }
  });

  // Exponer API global
  useEffect(() => {
    window.__arImageTrackingAPI = {
      trackedImages: trackedImagesRef.current,
      getTrackedImage: (id: string) => trackedImagesRef.current.get(id),
      getAllTrackedImages: () => Array.from(trackedImagesRef.current.values()),
      isImageTracked: (id: string) => trackedImagesRef.current.has(id)
    };

    return () => {
      delete window.__arImageTrackingAPI;
    };
  }, []);

  // Renderizar marcadores de debug
  if (!showDebugMarkers) return <>{children}</>;

  return (
    <>
      {Array.from(trackedImages.values()).map((tracked) => (
        <group key={tracked.id} position={tracked.position} rotation={tracked.rotation}>
          {/* Plano que muestra el área detectada */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[tracked.measuredSize.width, tracked.measuredSize.height]} />
            <meshBasicMaterial 
              color="#00ff00" 
              transparent 
              opacity={0.3} 
              side={THREE.DoubleSide}
              depthTest={false}
            />
          </mesh>

          {/* Borde del área */}
          <lineSegments rotation={[-Math.PI / 2, 0, 0]}>
            <edgesGeometry 
              args={[new THREE.PlaneGeometry(tracked.measuredSize.width, tracked.measuredSize.height)]} 
            />
            <lineBasicMaterial color="#00ff00" linewidth={2} />
          </lineSegments>

          {/* Nombre de la imagen */}
          <group position={[0, 0.1, 0]}>
            <mesh>
              <boxGeometry args={[0.02, 0.02, 0.02]} />
              <meshBasicMaterial color="#00ff00" />
            </mesh>
          </group>
        </group>
      ))}
      {children}
    </>
  );
}

// Hook personalizado para usar Image Tracking desde otros componentes
export function useARImageTracking(): ARImageTrackingAPI | null {
  return typeof window !== 'undefined' ? window.__arImageTrackingAPI || null : null;
}
