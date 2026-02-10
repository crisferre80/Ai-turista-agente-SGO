'use client';

/**
 * Escena 3D de AR con Three.js
 * Renderiza modelos 3D, hotspots de información y videos
 */

import { useRef, useState, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { 
  OrbitControls, 
  PerspectiveCamera,
  Environment,
  Html,
  useGLTF
} from '@react-three/drei';
import * as THREE from 'three';
import type { AttractionWithAR, WebXRCapabilities, ARHotspot } from '@/types/ar';

interface ARSceneProps {
  attraction: AttractionWithAR;
  capabilities?: WebXRCapabilities;
  disableOrbitControls?: boolean;
  showGrid?: boolean;
}

export default function ARScene({ attraction, disableOrbitControls = false, showGrid = true }: ARSceneProps) {
  return (
    <>
      {/* Iluminación */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
      <pointLight position={[-5, 5, -5]} intensity={0.5} />

      {/* Cámara */}
      <PerspectiveCamera makeDefault position={[0, 1.6, 3]} fov={75} />

      {/* Controles de cámara (orbitar, zoom) - se pueden desactivar en modo AR pegado */}
      {!disableOrbitControls && (
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          maxDistance={10}
          minDistance={1}
        />
      )}

      {/* Entorno (iluminación ambiente realista) */}
      <Environment preset="city" />

      {/* Modelo 3D principal si está disponible */}
      {attraction.ar_model_url && (
        <Suspense fallback={<LoadingModel />}>
          <MainModel modelUrl={attraction.ar_model_url} />
        </Suspense>
      )}

      {/* Hotspots AR */}
      {attraction.ar_hotspots?.hotspots?.map((hotspot) => (
        <Suspense key={hotspot.id} fallback={null}>
          <ARHotspotComponent hotspot={hotspot} />
        </Suspense>
      ))}

      {/* Grid de referencia (opcional, solo antes de "pegar" la escena) */}
      {showGrid && (
        <gridHelper args={[10, 10, '#888888', '#444444']} position={[0, 0, 0]} />
      )}
    </>
  );
}

/**
 * Componente de modelo 3D principal
 */
function MainModel({ modelUrl }: { modelUrl: string }) {
  let gltfScene = null;
  
  // Intentar cargar modelo GLTF/GLB
  try {
    const gltf = useGLTF(modelUrl);
    gltfScene = gltf.scene;
  } catch (error) {
    console.error('Error al cargar modelo 3D:', error);
    return <PlaceholderModel />;
  }

  if (!gltfScene) {
    return <PlaceholderModel />;
  }

  return <AnimatedModel scene={gltfScene} />;
}

/**
 * Subcomponente para animar el modelo (evita uso condicional de hooks)
 */
function AnimatedModel({ scene }: { scene: THREE.Group | THREE.Object3D }) {
  const mesh = useRef<THREE.Mesh>(null);

  // Animar rotación suave
  useFrame((state, delta) => {
    if (mesh.current) {
      mesh.current.rotation.y += delta * 0.2;
    }
  });

  return (
    <primitive
      ref={mesh}
      object={scene.clone()}
      position={[0, 0, -5]}
      scale={1}
    />
  );
}

/**
 * Modelo placeholder si no se puede cargar el modelo real
 */
function PlaceholderModel() {
  return (
    <mesh position={[0, 1, -5]} castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#4A90E2" />
    </mesh>
  );
}

/**
 * Modelo de carga mientras se cargan los recursos
 */
function LoadingModel() {
  return (
    <mesh position={[0, 1, -5]}>
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshBasicMaterial color="#666" wireframe />
    </mesh>
  );
}

/**
 * Componente de hotspot AR interactivo
 */
function ARHotspotComponent({ hotspot }: { hotspot: ARHotspot }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const rawPosition = (hotspot as unknown as { position?: unknown }).position;
  const position: [number, number, number] = Array.isArray(rawPosition)
    ? (rawPosition as [number, number, number])
    : [
        (rawPosition as { x?: number })?.x ?? 0,
        (rawPosition as { y?: number })?.y ?? 0,
        (rawPosition as { z?: number })?.z ?? 0,
      ];

  switch (hotspot.type) {
    case 'info':
      return (
        <InfoHotspot
          position={position}
          title={hotspot.title}
          description={hotspot.description}
          imageUrl={hotspot.image_url}
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
        />
      );

    case 'video':
      return (
        <VideoHotspot
          position={position}
          title={hotspot.title}
          videoUrl={hotspot.video_url}
          thumbnailUrl={hotspot.thumbnail_url}
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
        />
      );

    case '3d_model':
      return (
        <ModelHotspot
          position={position}
          modelUrl={hotspot.model_url}
          scale={
            Array.isArray(hotspot.scale)
              ? hotspot.scale
              : hotspot.scale
              ? [
                  (hotspot.scale as { 0?: number; x?: number }).x ?? (hotspot.scale as unknown as number[])[0] ?? 1,
                  (hotspot.scale as { 1?: number; y?: number }).y ?? (hotspot.scale as unknown as number[])[1] ?? 1,
                  (hotspot.scale as { 2?: number; z?: number }).z ?? (hotspot.scale as unknown as number[])[2] ?? 1,
                ]
              : [1, 1, 1]
          }
          rotation={
            Array.isArray(hotspot.rotation)
              ? hotspot.rotation
              : hotspot.rotation
              ? [
                  (hotspot.rotation as { 0?: number; x?: number }).x ?? (hotspot.rotation as unknown as number[])[0] ?? 0,
                  (hotspot.rotation as { 1?: number; y?: number }).y ?? (hotspot.rotation as unknown as number[])[1] ?? 0,
                  (hotspot.rotation as { 2?: number; z?: number }).z ?? (hotspot.rotation as unknown as number[])[2] ?? 0,
                ]
              : [0, 0, 0]
          }
        />
      );

    case 'audio':
      return (
        <AudioHotspot
          position={position}
          title={hotspot.title}
          audioUrl={hotspot.audio_url}
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
        />
      );

    default:
      return null;
  }
}

/**
 * Hotspot de información
 */
function InfoHotspot({
  position,
  title,
  description,
  imageUrl, // eslint-disable-line @typescript-eslint/no-unused-vars
  isExpanded,
  onToggle,
}: {
  position: [number, number, number];
  title: string;
  description: string;
  imageUrl?: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <group position={position}>
      {/* Marcador 3D */}
      <mesh onClick={onToggle}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#4A90E2" emissive="#4A90E2" emissiveIntensity={0.5} />
      </mesh>

      {/* Etiqueta flotante */}
      <Html center distanceFactor={10}>
        <div
          className={`bg-white rounded-lg shadow-lg transition-all ${
            isExpanded ? 'w-64' : 'w-auto'
          }`}
          onClick={onToggle}
        >
          <div className="p-3 cursor-pointer">
            <h3 className="font-bold text-sm text-gray-900">{title}</h3>
            {isExpanded && (
              <>
                <p className="text-xs text-gray-600 mt-2">{description}</p>
                {/* Imagen deshabilitada por ahora para evitar warnings de Next.js */}
                {/*imageUrl && (
                  <img
                    src={imageUrl}
                    alt={title}
                    className="w-full h-32 object-cover rounded mt-2"
                  />
                )*/}
              </>
            )}
          </div>
        </div>
      </Html>

      {/* Animación flotante */}
      <FloatingAnimation />
    </group>
  );
}

/**
 * Hotspot de video
 */
function VideoHotspot({
  position,
  title,
  videoUrl,
  isExpanded,
  onToggle,
}: {
  position: [number, number, number];
  title: string;
  videoUrl: string;
  thumbnailUrl?: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  // Extraer ID de YouTube si es una URL de YouTube
  const getYouTubeId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return match ? match[1] : null;
  };

  const youtubeId = getYouTubeId(videoUrl);

  return (
    <group position={position}>
      {/* Marcador 3D con forma de play */}
      <mesh onClick={onToggle}>
        <cylinderGeometry args={[0.2, 0.2, 0.05, 32]} />
        <meshStandardMaterial color="#E74C3C" emissive="#E74C3C" emissiveIntensity={0.5} />
      </mesh>

      {/* Panel de video */}
      <Html center distanceFactor={10}>
        <div
          className={`bg-black rounded-lg shadow-lg transition-all ${
            isExpanded ? 'w-80' : 'w-auto'
          }`}
          onClick={!isExpanded ? onToggle : undefined}
        >
          <div className="p-3 cursor-pointer">
            <h3 className="font-bold text-sm text-white">{title}</h3>
            {isExpanded && youtubeId && (
              <div className="mt-2">
                <iframe
                  width="100%"
                  height="180"
                  src={`https://www.youtube.com/embed/${youtubeId}`}
                  title={title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="rounded"
                />
              </div>
            )}
          </div>
        </div>
      </Html>

      <FloatingAnimation />
    </group>
  );
}

/**
 * Hotspot de modelo 3D adicional
 */
function ModelHotspot({
  position,
  modelUrl,
  scale,
  rotation,
}: {
  position: [number, number, number];
  modelUrl: string;
  scale: [number, number, number];
  rotation: [number, number, number];
}) {
  let gltfScene = null;
  
  try {
    const gltf = useGLTF(modelUrl);
    gltfScene = gltf.scene;
  } catch (error) {
    console.error('Error al cargar modelo hotspot:', error);
    return null;
  }

  if (!gltfScene) {
    return null;
  }

  return (
    <primitive
      object={gltfScene.clone()}
      position={position}
      scale={scale}
      rotation={rotation}
    />
  );
}

/**
 * Hotspot de audio
 */
function AudioHotspot({
  position,
  title,
  audioUrl,
  isExpanded,
  onToggle,
}: {
  position: [number, number, number];
  title: string;
  audioUrl: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <group position={position}>
      {/* Marcador 3D con forma de altavoz */}
      <mesh onClick={onToggle}>
        <coneGeometry args={[0.2, 0.3, 8]} />
        <meshStandardMaterial color="#9B59B6" emissive="#9B59B6" emissiveIntensity={0.5} />
      </mesh>

      {/* Panel de audio */}
      <Html center distanceFactor={10}>
        <div
          className={`bg-purple-600 rounded-lg shadow-lg transition-all ${
            isExpanded ? 'w-64' : 'w-auto'
          }`}
          onClick={!isExpanded ? onToggle : undefined}
        >
          <div className="p-3">
            <h3 className="font-bold text-sm text-white">{title}</h3>
            {isExpanded && (
              <audio controls className="w-full mt-2">
                <source src={audioUrl} type="audio/mpeg" />
                Tu navegador no soporta audio.
              </audio>
            )}
          </div>
        </div>
      </Html>

      <FloatingAnimation />
    </group>
  );
}

/**
 * Componente de animación flotante para hotspots
 */
function FloatingAnimation() {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.1;
    }
  });

  return <group ref={ref} />;
}

// Exportación explícita para TypeScript
export { ARScene };
