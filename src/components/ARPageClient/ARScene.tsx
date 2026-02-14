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
};

export default function ARScene({ 
  attraction, 
  showGrid = true, 
  disableOrbitControls = false,
  anchorPosition = [0, 0, -3],
  isAnchored = false
}: ARScenePageProps) {
  const [modelTransform, setModelTransform] = useState(
    (attraction.ar_hotspots?.modelTransform as any) ?? null
  );

  // Preferir el esquema nuevo si existe (scenes/scene_entities)
  // Esto permite que el runtime aplique las transformaciones persistidas.
  useEffect(() => {
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

      {/* Cámara con simulación AR */}
      {isAnchored ? (
        <ARCamera anchorTarget={anchorPosition} />
      ) : (
        <PerspectiveCamera makeDefault position={[0, 1.6, 3]} fov={75} />
      )}

      {/* Controles de cámara (solo si no están desactivados) */}
      {!disableOrbitControls && (
        <OrbitControls
          enablePan={true}
          enableZoom={!isAnchored}
          enableRotate={true}
          maxDistance={10}
          minDistance={isAnchored ? 0.5 : 1}
          target={isAnchored ? anchorPosition : [0, 0, 0]}
        />
      )}

      {/* Entorno */}
      <Environment preset="city" />

      {/* Modelo 3D principal (aplica transform guardado si existe) */}
      {attraction.ar_model_url && attraction.ar_model_url.trim() !== '' ? (
        <Suspense fallback={<LoadingModel position={anchorPosition} isAnchored={isAnchored} />}>
          <MainModel
            modelUrl={attraction.ar_model_url}
            imageUrl={attraction.image_url}
            position={anchorPosition}
            isAnchored={isAnchored}
            transform={modelTransform}
          />
        </Suspense>
      ) : (
        <FallbackVisual imageUrl={attraction.image_url} position={anchorPosition} isAnchored={isAnchored} />
      )}

      {/* Hotspots AR */}
      {attraction.ar_hotspots?.hotspots?.map((hotspot) => {
        // Ajustar posición del hotspot relativa al ancla
        const hotspotPos = hotspot.position;
        const adjustedPos: [number, number, number] = Array.isArray(hotspotPos)
          ? [hotspotPos[0] + anchorPosition[0], hotspotPos[1] + anchorPosition[1], hotspotPos[2] + anchorPosition[2]]
          : [
              (hotspotPos.x ?? 0) + anchorPosition[0],
              (hotspotPos.y ?? 0) + anchorPosition[1],
              (hotspotPos.z ?? 0) + anchorPosition[2]
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
        const adjustedPos: [number, number, number] = [pos.x + anchorPosition[0], pos.y + anchorPosition[1], pos.z + anchorPosition[2]];

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
        <gridHelper args={[10, 10, '#00ff00', '#004400']} position={anchorPosition} />
      )}
    </>
  );
}

// Cámara con simulación de movimiento AR
function ARCamera({ anchorTarget }: { anchorTarget: [number, number, number] }) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const basePosition = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.6, 3));

  useFrame((state) => {
    if (!cameraRef.current) return;

    const time = state.clock.getElapsedTime();
    
    // Simular pequeños movimientos como si fuera movimiento natural del usuario
    const sway = Math.sin(time * 0.5) * 0.02;
    const bob = Math.cos(time * 0.7) * 0.01;
    const drift = Math.sin(time * 0.3) * 0.015;
    
    // Aplicar movimientos sutiles a la cámara
    cameraRef.current.position.set(
      basePosition.current.x + sway,
      basePosition.current.y + bob,
      basePosition.current.z + drift
    );
    
    // Hacer que la cámara mire hacia el objeto anclado
    cameraRef.current.lookAt(anchorTarget[0], anchorTarget[1], anchorTarget[2]);
  });

  return <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 1.6, 3]} fov={75} />;
}

function MainModel({ modelUrl, imageUrl, position, isAnchored, transform }: { 
  modelUrl: string; 
  imageUrl?: string;
  position: [number, number, number];
  isAnchored: boolean;
  transform?: { position: { x:number;y:number;z:number }; rotation: { x:number;y:number;z:number }; scale: { x:number;y:number;z:number } } | null;
}) {
  let gltfScene = null;
  let error = null;
  
  // useModel delega en useGLTF internamente y requiere Suspense en el árbol padre
  try {
    const gltf = useModel(modelUrl as string) as any;
    gltfScene = gltf?.scene ?? null;
  } catch (err) {
    console.error('❌ Error al obtener modelo con useModel:', err);
  }

  if (!gltfScene) {
    return <FallbackVisual imageUrl={imageUrl} position={position} isAnchored={isAnchored} />;
  }

  return <StaticModel scene={gltfScene} position={position} isAnchored={isAnchored} transform={transform} />;
}

function StaticModel({ scene, position, isAnchored, transform }: { 
  scene: THREE.Group | THREE.Object3D; 
  position: [number, number, number];
  isAnchored: boolean;
  transform?: { position: { x:number;y:number;z:number }; rotation: { x:number;y:number;z:number }; scale: { x:number;y:number;z:number } } | null;
}) {
  const mesh = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (mesh.current && !isAnchored) {
      // Solo rotar si no está anclado
      mesh.current.rotation.y += delta * 0.15;
    } else if (mesh.current && isAnchored) {
      // Cuando está anclado, agregar un pequeño movimiento sutil
      const time = state.clock.getElapsedTime();
      mesh.current.rotation.y = Math.sin(time * 0.1) * 0.05; // Oscilación muy sutil
    }
  });

  // Aplicar transform si existe (transform es relativo al ancla)
  const appliedPosition: [number, number, number] = transform?.position
    ? [position[0] + transform.position.x, position[1] + transform.position.y, position[2] + transform.position.z]
    : position;

  const appliedScale = transform?.scale ? [transform.scale.x, transform.scale.y, transform.scale.z] : (isAnchored ? [0.3,0.3,0.3] : [0.8,0.8,0.8]);
  const appliedRotation = transform?.rotation ? [transform.rotation.x, transform.rotation.y, transform.rotation.z] : undefined;

  return (
    <primitive
      ref={mesh}
      object={scene.clone()}
      position={appliedPosition}
      rotation={appliedRotation as any}
      scale={appliedScale as any}
    />
  );
}

function FallbackVisual({ imageUrl, position, isAnchored }: {
  imageUrl?: string;
  position: [number, number, number];
  isAnchored: boolean;
}) {
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

  const mesh = useRef<THREE.Mesh>(null);
  useFrame((state, delta) => {
    if (mesh.current) {
      const time = state.clock.getElapsedTime();
      mesh.current.rotation.y = Math.sin(time * 0.2) * 0.1; 
      mesh.current.rotation.x = Math.cos(time * 0.15) * 0.05;
    }
  });
  
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
  if ((hotspot as any).image_url) {
    const imageUrl = (hotspot as any).image_url as string;
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
