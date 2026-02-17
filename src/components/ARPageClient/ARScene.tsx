'use client';

import { useRef, useState, Suspense, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  PerspectiveCamera,
  Environment,
  Html,
  OrbitControls,
  useTexture
} from '@react-three/drei';
import { useModel } from '@/lib/model-loader';
import { supabase } from '@/lib/supabase';
import { loadARModelFromScene } from '@/lib/ar-scene-persistence';
import * as THREE from 'three';
import type { ARData, ARHotspot } from '@/types/ar';

type AttractionAR = {
  id: string;
  name: string;
  description?: string;
  lat: number;
  lng: number;
  image_url?: string;
  ar_model_url?: string;
  ar_hotspots?: ARData;
  has_ar_content: boolean;
  qr_code?: string;
  category?: string;
};

type ARScenePageProps = {
  attraction: AttractionAR;
  showGrid?: boolean;
  disableOrbitControls?: boolean;
  anchorPosition?: [number, number, number];
  isAnchored?: boolean;
  phonePreview?: { cameraDistance: number; yOffset: number; previewScale: number };
};

export default function ARScene({ 
  attraction, 
  showGrid = true, 
  disableOrbitControls = false,
  anchorPosition = [0, 0, -3],
  isAnchored = false,
  phonePreview,
}: ARScenePageProps) {
  const [modelTransform, setModelTransform] = useState<{
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
  } | null>(
    (attraction.ar_hotspots?.modelTransform as { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number }; scale: { x: number; y: number; z: number } }) ?? null
  );

  // Aplicar phonePreview para ajustar la posición del ancla
  // En WebXR real: la cámara está fija en (0, 1.6, 0) - nivel de ojos
  // El modelo se ancla a una distancia delante del usuario
  const adjustedAnchorPosition: [number, number, number] = phonePreview
    ? [0, phonePreview.yOffset, -phonePreview.cameraDistance] // Usar los valores de calibración AR
    : anchorPosition; // O usar la posición por defecto

  // Sincronizar modelTransform desde props cuando cambia (para vista previa en tiempo real)
  useEffect(() => {
    const propTransform = attraction.ar_hotspots?.modelTransform as { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number }; scale: { x: number; y: number; z: number } } | undefined;
    if (propTransform) {
      setModelTransform(propTransform);
    }
  }, [attraction.ar_hotspots?.modelTransform]);

  // Preferir el esquema nuevo si existe (scenes/scene_entities)
  // Esto permite que el runtime aplique las transformaciones persistidas.
  // SOLO para IDs reales (no para vista previa)
  useEffect(() => {
    // Evitar carga DB para IDs de preview
    if (attraction.id === 'preview-phone' || attraction.id.startsWith('preview-')) return;
    
    let cancelled = false;
    (async () => {
      try {
        const { transform } = await loadARModelFromScene({ supabase, attractionId: attraction.id });
        if (!cancelled && transform) setModelTransform(transform);
      } catch {
        // noop
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attraction.id]);

  return (
    <>
      {/* Iluminación */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} castShadow />
      <pointLight position={[-5, 5, -5]} intensity={0.4} />

      {/* Cámara
          WebXR Spec: La cámara se maneja automáticamente en sesiones immersive-ar.
          Esta configuración solo se usa en preview/editor mode.
      */}
      <PerspectiveCamera 
        makeDefault 
        position={[0, 1.6, 3]} 
        fov={75}
        near={0.01}
        far={20}
      />

      {/* Controles de cámara (solo si no están desactivados) */}
      {!disableOrbitControls && (
        <OrbitControls
          enablePan={true}
          enableZoom={!isAnchored}
          enableRotate={true}
          maxDistance={10}
          minDistance={isAnchored ? 0.5 : 1}
          target={isAnchored ? adjustedAnchorPosition : [0, 0, 0]}
        />
      )}

      {/* Entorno */}
      <Environment preset="city" />

      {/* Modelo 3D principal (aplica transform guardado si existe) */}
      {attraction.ar_model_url && attraction.ar_model_url.trim() !== '' ? (
        <Suspense fallback={<LoadingModel position={adjustedAnchorPosition} isAnchored={isAnchored} />}>
          <MainModel
            modelUrl={attraction.ar_model_url}
            imageUrl={attraction.image_url}
            position={adjustedAnchorPosition}
            isAnchored={isAnchored}
            transform={modelTransform}
            phonePreview={phonePreview}
          />
        </Suspense>
      ) : (
        <FallbackVisual imageUrl={attraction.image_url} position={adjustedAnchorPosition} isAnchored={isAnchored} />
      )}

      {/* Hotspots AR */}
      {attraction.ar_hotspots?.hotspots?.map((hotspot) => {
        // Ajustar posición del hotspot relativa al ancla
        const hotspotPos = hotspot.position;
        const adjustedPos: [number, number, number] = Array.isArray(hotspotPos)
          ? [hotspotPos[0] + adjustedAnchorPosition[0], hotspotPos[1] + adjustedAnchorPosition[1], hotspotPos[2] + adjustedAnchorPosition[2]]
          : [
              (hotspotPos.x ?? 0) + adjustedAnchorPosition[0],
              (hotspotPos.y ?? 0) + adjustedAnchorPosition[1],
              (hotspotPos.z ?? 0) + adjustedAnchorPosition[2]
            ];
        
        return (
          <Suspense key={hotspot.id} fallback={null}>
            <ARHotspotComponent hotspot={{...hotspot, position: adjustedPos}} />
          </Suspense>
        );
      })}

      {/* Renderizar primitivas definidas en el editor AR (si existen) */}
      {attraction.ar_hotspots?.primitives?.map((prim) => {
        const pos = prim.position || { x: 0, y: 0, z: 0 };
        const rot = prim.rotation || { x: 0, y: 0, z: 0 };
        const scl = prim.scale || { x: 1, y: 1, z: 1 };
        const adjustedPos: [number, number, number] = [pos.x + adjustedAnchorPosition[0], pos.y + adjustedAnchorPosition[1], pos.z + adjustedAnchorPosition[2]];

        return (
          <group key={prim.id} position={adjustedPos} rotation={[rot.x, rot.y, rot.z]} scale={[scl.x, scl.y, scl.z]}>
            {prim.type === 'box' && (
              <mesh>
                <boxGeometry args={[1,1,1]} />
                <meshStandardMaterial color={prim.color || '#667eea'} metalness={0.2} roughness={0.6} />
              </mesh>
            )}
            {prim.type === 'sphere' && (
              <mesh>
                <sphereGeometry args={[0.5, 32, 32]} />
                <meshStandardMaterial color={prim.color || '#667eea'} metalness={0.2} roughness={0.6} />
              </mesh>
            )}
            {prim.type === 'cylinder' && (
              <mesh>
                <cylinderGeometry args={[0.5,0.5,1,32]} />
                <meshStandardMaterial color={prim.color || '#667eea'} metalness={0.2} roughness={0.6} />
              </mesh>
            )}
            {prim.type === 'cone' && (
              <mesh>
                <coneGeometry args={[0.5,1,32]} />
                <meshStandardMaterial color={prim.color || '#667eea'} metalness={0.2} roughness={0.6} />
              </mesh>
            )}
            {prim.type === 'plane' && (
              <mesh>
                <planeGeometry args={[1,1]} />
                <meshStandardMaterial color={prim.color || '#667eea'} metalness={0.2} roughness={0.6} side={THREE.DoubleSide} />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Grid de referencia (se oculta después de colocar) */}
      {showGrid && (
        <gridHelper args={[10, 10, '#00ff00', '#004400']} position={adjustedAnchorPosition} />
      )}
    </>
  );
}
function MainModel({ modelUrl, imageUrl, position, isAnchored, transform, phonePreview }: { 
  modelUrl: string; 
  imageUrl?: string;
  position: [number, number, number];
  isAnchored: boolean;
  transform?: { position: { x:number;y:number;z:number }; rotation: { x:number;y:number;z:number }; scale: { x:number;y:number;z:number } } | null;
  phonePreview?: { cameraDistance: number; yOffset: number; previewScale: number };
}) {
  let gltfScene = null;
  
  // useModel delega en useGLTF internamente y requiere Suspense en el árbol padre
  try {
    const gltf = useModel(modelUrl as string);
    gltfScene = gltf?.scene ?? null;
  } catch (err) {
    console.error('❌ Error al obtener modelo con useModel:', err);
  }

  if (!gltfScene) {
    return <FallbackVisual imageUrl={imageUrl} position={position} isAnchored={isAnchored} />;
  }

  return <StaticModel scene={gltfScene} position={position} isAnchored={isAnchored} transform={transform} phonePreview={phonePreview} />;
}

function StaticModel({ scene, position, isAnchored, transform, phonePreview }: { 
  scene: THREE.Group | THREE.Object3D; 
  position: [number, number, number];
  isAnchored: boolean;
  transform?: { position: { x:number;y:number;z:number }; rotation: { x:number;y:number;z:number }; scale: { x:number;y:number;z:number } } | null;
  phonePreview?: { cameraDistance: number; yOffset: number; previewScale: number };
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const [baseScale, setBaseScale] = useState<number>(1);

  // Solo rotar automáticamente si NO está anclado Y NO tiene transform personalizado
  useFrame((state, delta) => {
    if (mesh.current && !isAnchored && !transform?.rotation) {
      // Solo rotar si no está anclado y no tiene rotación personalizada
      mesh.current.rotation.y += delta * 0.15;
    }
    // NO modificar la rotación cuando está anclado o tiene transform personalizado
    // para respetar las transformaciones del usuario
  });

  // Aplicar transform si existe (transform es relativo al ancla)
  const appliedPosition: [number, number, number] = transform?.position
    ? [position[0] + transform.position.x, position[1] + transform.position.y, position[2] + transform.position.z]
    : position;

  // Aplicar escala: primero la escala del transform del usuario, luego el multiplicador AR si existe
  // NO usar baseScale arbitrario - respetar las transformaciones del usuario
  const arScaleMultiplier = phonePreview?.previewScale ?? 1.0;
  
  const appliedScale: [number, number, number] = transform?.scale 
    ? [transform.scale.x * arScaleMultiplier, transform.scale.y * arScaleMultiplier, transform.scale.z * arScaleMultiplier]
    : [arScaleMultiplier, arScaleMultiplier, arScaleMultiplier]; // Si no hay transform, solo aplicar el multiplicador AR
  
  const appliedRotation: [number, number, number] | undefined = transform?.rotation 
    ? [transform.rotation.x, transform.rotation.y, transform.rotation.z] 
    : undefined;

  // Auto-calcular escala base basada en el bounding box del modelo cuando NO hay transform guardado
  useEffect(() => {
    if (transform || !scene) return;
    let raf = 0 as number;
    try {
      const box = new THREE.Box3();
      // Calcular bounding box acumulando las geometrías de los meshes del scene
      (scene as THREE.Object3D).traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh && 'isMesh' in mesh && mesh.isMesh && mesh.geometry) {
          const geom = mesh.geometry as THREE.BufferGeometry;
          if (!geom.boundingBox) geom.computeBoundingBox();
          if (geom.boundingBox) {
            const geomBox = geom.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
            box.union(geomBox);
          }
        }
      });
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        const TARGET_MAX = 1.2; // metros - target max dimension for models
        const scaleFactor = TARGET_MAX / maxDim;
        // Limit excessive upscaling
        const finalScale = Math.min(Math.max(scaleFactor, 0.05), 5);
        // Defer setState to avoid synchronous state updates inside the effect
        raf = requestAnimationFrame(() => setBaseScale(finalScale));
      } else {
        raf = requestAnimationFrame(() => setBaseScale(1));
      }
    } catch (err) {
      console.warn('No se pudo calcular bounding box para auto-escala:', err);
      raf = requestAnimationFrame(() => setBaseScale(1));
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scene, transform]);

  return (
    <primitive
      ref={mesh}
      object={scene.clone()}
      position={appliedPosition}
      rotation={appliedRotation}
      scale={[appliedScale[0] * baseScale, appliedScale[1] * baseScale, appliedScale[2] * baseScale]}
    />
  );
}

function FallbackVisual({ imageUrl, position, isAnchored }: {
  imageUrl?: string;
  position: [number, number, number];
  isAnchored: boolean;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (mesh.current && isAnchored) {
      const time = Date.now() * 0.001;
      mesh.current.rotation.y = Math.sin(time * 0.2) * 0.1; 
      mesh.current.rotation.x = Math.cos(time * 0.15) * 0.05;
    }
  });

  if (!isAnchored) {
    return null;
  }

  if (imageUrl && imageUrl.trim() !== '') {
    return (
      <group position={position}>
        <mesh position={[0, 0.9, 0]}>
          <planeGeometry args={[1.2, 1.5]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.2} />
        </mesh>
        <Html transform sprite position={[0, 0.9, 0]} distanceFactor={2}>
          <div
            style={{
              width: 220,
              height: 280,
              borderRadius: 16,
              border: '2px solid rgba(255,255,255,0.9)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
              backgroundImage: `url(${imageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              overflow: 'hidden'
            }}
          />
        </Html>
      </group>
    );
  }
  
  return (
    <mesh ref={mesh} position={position} castShadow>
      <boxGeometry args={[0.26, 0.26, 0.26]} />
      <meshStandardMaterial 
        color="#1A3A6C"
        metalness={0.5} 
        roughness={0.2}
        emissive="#001122"
        emissiveIntensity={0.2}
      />
    </mesh>
  );
}

function LoadingModel({ position, isAnchored }: { position: [number, number, number]; isAnchored: boolean }) {
  if (!isAnchored) {
    return null;
  }

  return (
    <mesh position={position}>
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshBasicMaterial color="#666" wireframe />
    </mesh>
  );
}

function ARHotspotComponent({ hotspot }: { hotspot: ARHotspot }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const rawPosition = hotspot.position;
  const position: [number, number, number] = Array.isArray(rawPosition)
    ? (rawPosition as [number, number, number])
    : [
        (rawPosition as { x?: number })?.x ?? 0,
        (rawPosition as { y?: number })?.y ?? 0,
        (rawPosition as { z?: number })?.z ?? 0,
      ];

  if (hotspot.type === 'info') {
    return (
      <group position={position}>
        <mesh onClick={() => setIsExpanded(!isExpanded)}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshStandardMaterial color="#4CAF50" emissive="#4CAF50" emissiveIntensity={0.5} />
        </mesh>
        
        <Html center distanceFactor={10}>
          <div
            className={`bg-white rounded-lg shadow-lg transition-all ${
              isExpanded ? 'w-64' : 'w-auto'
            }`}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="p-3 cursor-pointer">
              <h3 className="font-bold text-sm text-gray-900">{hotspot.title}</h3>
              {isExpanded && hotspot.description && (
                <p className="text-xs text-gray-600 mt-2">{hotspot.description}</p>
              )}
            </div>
          </div>
        </Html>
      </group>
    );
  }

  // Image hotspot: render as textured plane (works in immersive AR)
  if ('image_url' in hotspot && hotspot.image_url) {
    const imageUrl = hotspot.image_url;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const tex = imageUrl ? useTexture(imageUrl) : null;
    return (
      <group position={position}>
        <mesh>
          <planeGeometry args={[1.6, 0.9]} />
          <meshBasicMaterial
            map={tex ? (Array.isArray(tex) ? tex[0] : (tex as THREE.Texture)) : undefined}
            toneMapped={false}
            transparent
          />
        </mesh>
        <mesh position={[0, -0.55, 0]}> 
          <planeGeometry args={[1.6, 0.18]} />
          <meshBasicMaterial color="#000000" opacity={0.5} transparent />
        </mesh>
      </group>
    );
  }

  // Video hotspot: create a video texture if url provided
  if (hotspot.type === 'video' && hotspot.video_url) {
    const video = document.createElement('video');
    video.src = hotspot.video_url;
    video.crossOrigin = 'anonymous';
    video.loop = true;
    video.muted = true;
    video.play().catch(() => {});
    const texture = new THREE.VideoTexture(video);

    return (
      <group position={position}>
        <mesh>
          <planeGeometry args={[1.6, 0.9]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
      </group>
    );
  }

  return null;
}
