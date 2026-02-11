'use client';

import { useRef, useState, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { 
  PerspectiveCamera,
  Environment,
  Html,
  useGLTF,
  OrbitControls
} from '@react-three/drei';
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
};

export default function ARScene({ 
  attraction, 
  showGrid = true, 
  disableOrbitControls = false,
  anchorPosition = [0, 0, -3]
}: ARScenePageProps) {
  return (
    <>
      {/* Iluminación */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} castShadow />
      <pointLight position={[-5, 5, -5]} intensity={0.4} />

      {/* Cámara */}
      <PerspectiveCamera makeDefault position={[0, 1.6, 3]} fov={75} />

      {/* Controles de cámara (solo si no están desactivados) */}
      {!disableOrbitControls && (
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          maxDistance={10}
          minDistance={1}
        />
      )}

      {/* Entorno */}
      <Environment preset="city" />

      {/* Modelo 3D principal */}
      {attraction.ar_model_url && attraction.ar_model_url.trim() !== '' ? (
        <Suspense fallback={<LoadingModel position={anchorPosition} />}>
          <MainModel modelUrl={attraction.ar_model_url} position={anchorPosition} />
        </Suspense>
      ) : (
        <PlaceholderModel position={anchorPosition} />
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

      {/* Grid de referencia (se oculta después de colocar) */}
      {showGrid && (
        <gridHelper args={[10, 10, '#00ff00', '#004400']} position={anchorPosition} />
      )}
    </>
  );
}

function MainModel({ modelUrl, position }: { modelUrl: string; position: [number, number, number] }) {
  let gltfScene = null;
  let error = null;
  
  try {
    const gltf = useGLTF(modelUrl);
    gltfScene = gltf.scene;
  } catch (err) {
    error = err;
    console.error('❌ Error al cargar modelo 3D desde:', modelUrl, err);
  }

  if (error || !gltfScene) {
    console.warn('⚠️ Usando modelo placeholder por fallo en la carga');
    return <PlaceholderModel position={position} />;
  }

  return <AnimatedModel scene={gltfScene} position={position} />;
}

function AnimatedModel({ scene, position }: { scene: THREE.Group | THREE.Object3D; position: [number, number, number] }) {
  const mesh = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (mesh.current) {
      mesh.current.rotation.y += delta * 0.15;
    }
  });

  return (
    <primitive
      ref={mesh}
      object={scene.clone()}
      position={position}
      scale={1}
    />
  );
}

function PlaceholderModel({ position }: { position: [number, number, number] }) {
  const mesh = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (mesh.current) {
      mesh.current.rotation.y += delta * 0.2;
      mesh.current.rotation.x += delta * 0.1;
    }
  });

  return (
    <mesh ref={mesh} position={position} castShadow>
      <boxGeometry args={[0.8, 0.8, 0.8]} />
      <meshStandardMaterial color="#4A90E2" metalness={0.5} roughness={0.2} />
    </mesh>
  );
}

function LoadingModel({ position }: { position: [number, number, number] }) {
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

  return null;
}
