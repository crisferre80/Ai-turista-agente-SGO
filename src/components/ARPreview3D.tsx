 'use client';
/* eslint-disable react-hooks/exhaustive-deps */

import { useRef, useState, useEffect, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Box, Sphere, TransformControls, useTexture } from '@react-three/drei';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { OrbitControls as OrbitControlsImpl, TransformControls as TransformControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { Settings, Lightbulb, Camera, Move, RotateCcw, Maximize2 } from 'lucide-react';

import type { ARHotspot } from '@/types/ar';
import { loadGLTF } from '@/lib/model-loader';
import ARScene from '@/components/ARPageClient/ARScene';
import ARGrid from '@/components/ARGrid';

// Reuse shared ARHotspot type from global types to avoid mismatches across app
type Hotspot = ARHotspot;

interface Primitive {
  id: string;
  type: 'box' | 'sphere' | 'cylinder' | 'cone' | 'plane';
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  color: string;
}

interface Light {
  id: string;
  type: 'ambient' | 'directional' | 'point' | 'spot';
  position: { x: number; y: number; z: number };
  intensity: number;
  color: string;
}

interface ARPreview3DProps {
  modelUrl?: string | undefined;
  modelTransform?: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
  } | null;
  hotspots: Hotspot[];
  onHotspotPositionChange: (id: string, position: { x: number; y: number; z: number }) => void;
  onHotspotScaleChange: (id: string, scale: { x: number; y: number; z: number }) => void;
  onHotspotRotationChange: (id: string, rotation: { x: number; y: number; z: number }) => void;
  onModelTransformChange: (transform: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number }; scale: { x: number; y: number; z: number } }) => void;
  lightMode?: boolean;
  primitives?: Primitive[];
  onPrimitivesChange?: (p: Primitive[]) => void;
  phonePreview?: {
    cameraDistance?: number;
    yOffset?: number;
    previewScale?: number;
  };
  onPhonePreviewChange?: (p: { cameraDistance: number; yOffset: number; previewScale: number }) => void;
}

/**
 * Componente para cargar y mostrar modelos 3D en el editor
 * Normaliza el tamaño del modelo y lo centra siguiendo patrones Three.js
 */
function Model({
  url,
  activeAnimationName,
  playing = true,
  speed = 1,
  loop = true,
  onLoadedAnimations,
}: {
  url: string;
  activeAnimationName?: string | null;
  playing?: boolean;
  speed?: number;
  loop?: boolean;
  onLoadedAnimations?: (clips: THREE.AnimationClip[]) => void;
}) {
  const [model, setModel] = useState<THREE.Object3D | null>(null);
  const [error, setError] = useState<string | null>(null);
  const groupRef = useRef<THREE.Group>(null);

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});
  const prevClipRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const _t = setTimeout(() => setError(null), 0);

    loadGLTF(url).then((gltf: GLTF) => {
      if (!mounted) return;
      try {
        const clonedScene = gltf.scene.clone();

        const box = new THREE.Box3().setFromObject(clonedScene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = maxDim > 3 ? 3 / maxDim : 1;

        clonedScene.scale.setScalar(scale);
        const scaledCenter = center.multiplyScalar(scale);
        clonedScene.position.sub(scaledCenter);
        clonedScene.position.y += box.min.y * scale;
        clonedScene.updateMatrix();

        // Animations: create mixer/actions when clips exist
        if (gltf.animations && gltf.animations.length > 0) {
          mixerRef.current = new THREE.AnimationMixer(clonedScene);
          const acts: Record<string, THREE.AnimationAction> = {};
          gltf.animations.forEach((clip, idx) => {
            if (!clip.name) clip.name = `clip-${idx}`;
            const action = mixerRef.current!.clipAction(clip);
            // set initial loop mode based on prop
            action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 0);
            acts[clip.name] = action;
          });
          actionsRef.current = acts;
          onLoadedAnimations?.(gltf.animations);
        }

        setModel(clonedScene);
      } catch (err) {
        console.error('Error procesando glTF:', err);
        setError('Error procesando modelo 3D');
      }
    }).catch(() => {
      setError('No se pudo cargar el modelo 3D');
    });

    return () => {
      mounted = false;
      clearTimeout(_t);
      // cleanup mixer/actions
      if (mixerRef.current) {
        try { mixerRef.current.stopAllAction(); } catch { /* noop */ }
        mixerRef.current = null;
      }
      actionsRef.current = {};
    };
  }, [url, onLoadedAnimations, loop]);

  // advance mixer on each frame
  useFrame((_, delta) => {
    if (mixerRef.current) mixerRef.current.update(delta);
  });

  // react to animation selection changes
  useEffect(() => {
    const mixer = mixerRef.current;
    if (!mixer) return;

    const prev = prevClipRef.current;
    if (prev && actionsRef.current[prev]) {
      actionsRef.current[prev].fadeOut(0.25);
    }

    if (activeAnimationName && actionsRef.current[activeAnimationName]) {
      const act = actionsRef.current[activeAnimationName];
      act.reset().fadeIn(0.25).play();
      act.timeScale = playing ? speed : 0;
      prevClipRef.current = activeAnimationName;
    }
  }, [activeAnimationName]);

  // play/pause & speed
  useEffect(() => {
    const name = prevClipRef.current;
    if (!name) return;
    const act = actionsRef.current[name];
    if (!act) return;
    act.timeScale = playing ? speed : 0;
  }, [playing, speed]);

  // update loop mode when prop changes
  useEffect(() => {
    const name = prevClipRef.current;
    if (!name) return;
    const act = actionsRef.current[name];
    if (!act) return;
    act.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 0);
  }, [loop]);

  const loading = model === null && error === null;

  if (loading) {
    return (
      <Text position={[0, 0, 0]} fontSize={0.3} color="#667eea">Cargando modelo...</Text>
    );
  }

  if (error) {
    return (
      <group>
        <Text position={[0, 0.5, 0]} fontSize={0.3} color="red">{error}</Text>
        <Box args={[1, 1, 1]} position={[0, 0, 0]}>
          <meshStandardMaterial color="#ff6b6b" wireframe />
        </Box>
      </group>
    );
  }

  if (!model) {
    return (
      <Box args={[1, 1, 1]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#667eea" wireframe />
      </Box>
    );
  }

  return <primitive ref={groupRef} object={model} />;
}

function HotspotMarker({ 
  hotspot, 
  isSelected, 
  onSelect,
  meshRef
}: { 
  hotspot: Hotspot; 
  isSelected: boolean;
  onSelect: () => void;
  meshRef?: React.Ref<THREE.Mesh>;
}) {
  // Normalizar posición (aceptar array o objeto)
  const pos: { x: number; y: number; z: number } = Array.isArray(hotspot.position)
    ? { x: hotspot.position[0] ?? 0, y: hotspot.position[1] ?? 0, z: hotspot.position[2] ?? 0 }
    : hotspot.position as { x: number; y: number; z: number };

  // Color según tipo
  const color = (() => {
    switch (hotspot.type) {
      case 'info': return '#4CAF50';
      case 'image': return '#2196F3';
      default: return '#FF9800';
    }
  })();

  return (
    <group position={[pos.x, pos.y, pos.z]}>
      <Sphere 
        ref={meshRef}
        args={[isSelected ? 0.15 : 0.1, 16, 16]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <meshStandardMaterial 
          color={color} 
          emissive={color}
          emissiveIntensity={isSelected ? 0.5 : 0.2}
        />
      </Sphere>
      
      <Text
        position={[0, 0.3, 0]}
        fontSize={0.15}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {('title' in hotspot && hotspot.title) || ''}
      </Text>

      {/* Línea hacia abajo */}
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.3, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

// Componente que pinta un pequeño marcador amarillo en el target actual de OrbitControls
function CameraTargetMarker({ orbitRef }: { orbitRef: React.RefObject<OrbitControlsImpl | null> }) {
  const ref = useRef<THREE.Mesh | null>(null);
  useFrame(() => {
    if (!ref.current) return;
    const target = orbitRef.current?.target;
    if (target) ref.current.position.set(target.x, target.y, target.z);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.06, 8, 8]} />
      <meshBasicMaterial color="#ffd54f" />
    </mesh>
  );
}

 // Helper visual para mostrar el frustum de la cámara del teléfono en AR
// En WebXR: la cámara está fija en la posición del usuario (0, 1.6, 0)
// El modelo se ancla a una distancia delante del usuario
function PhoneCameraFrustumHelper({ 
  distance, 
  yOffset, 
  fov = 75 
}: { 
  distance: number; 
  yOffset: number; 
  fov?: number; 
}) {
  const helperRef = useRef<THREE.CameraHelper | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const lineRef = useRef<THREE.Line | null>(null);

  useEffect(() => {
    // Crear una cámara virtual que representa la cámara del teléfono en AR
    // En AR real, la cámara está siempre en nivel de ojos del usuario
    const virtualCamera = new THREE.PerspectiveCamera(fov, 9 / 16, 0.1, 100);
    virtualCamera.position.set(0, 1.6, 0); // Nivel de ojos del usuario
    virtualCamera.lookAt(0, yOffset, -distance); // Mirar hacia el ancla del modelo
    virtualCamera.updateProjectionMatrix();
    cameraRef.current = virtualCamera;

    // Crear el helper
    const helper = new THREE.CameraHelper(virtualCamera);
    helper.name = 'phoneCameraHelper';
    helperRef.current = helper;

    // Crear una línea desde la cámara hasta el ancla
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 1.6, 0), // Cámara del usuario
      new THREE.Vector3(0, yOffset, -distance) // Ancla del modelo
    ]);
    const lineMaterial = new THREE.LineBasicMaterial({ 
      color: 0x00ff00, 
      linewidth: 2,
      transparent: true,
      opacity: 0.6,
      depthTest: false
    });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    line.name = 'phoneCameraLine';
    line.renderOrder = 999; // Renderizar encima de todo
    lineRef.current = line;

    return () => {
      helper.geometry?.dispose();
      if (helper.material) (helper.material as THREE.Material).dispose();
      lineGeometry?.dispose();
      lineMaterial?.dispose();
    };
  }, []);

  useFrame(() => {
    if (cameraRef.current && helperRef.current) {
      // La cámara siempre está en nivel de ojos
      cameraRef.current.position.set(0, 1.6, 0);
      // Mirar hacia el ancla del modelo
      cameraRef.current.lookAt(0, yOffset, -distance);
      cameraRef.current.fov = fov;
      cameraRef.current.updateProjectionMatrix();
      helperRef.current.update();
    }

    // Actualizar la línea
    if (lineRef.current) {
      const points = [
        new THREE.Vector3(0, 1.6, 0), // Cámara
        new THREE.Vector3(0, yOffset, -distance) // Ancla
      ];
      lineRef.current.geometry.setFromPoints(points);
    }
  });

  return (
    <>
      {helperRef.current && <primitive object={helperRef.current} />}
      {lineRef.current && <primitive object={lineRef.current} />}
    </>
  );
}

// Billboard 3D para mostrar imagen asociada a un hotspot con perspectiva real
function HotspotImageBillboard({ hotspot }: { hotspot: Hotspot }) {
  // Prefer explicit typed fields (image_url). Support legacy content_url for safety.
  const imageUrl = ('image_url' in hotspot && hotspot.image_url) || ((hotspot as unknown as Record<string, unknown>).content_url as string) || '';
  const texture = useTexture(imageUrl || '') as unknown as THREE.Texture | THREE.Texture[];

  // Elevamos un poco el contenido sobre el marcador
  const yOffset = 0.8;
  const pos = Array.isArray(hotspot.position)
    ? { x: hotspot.position[0] ?? 0, y: hotspot.position[1] ?? 0, z: hotspot.position[2] ?? 0 }
    : (hotspot.position as { x: number; y: number; z: number });

  return (
    <group position={[pos.x, pos.y + yOffset, pos.z]}>
      {/* Fondo ligeramente más grande para hacer de marco */}
      <mesh position={[0, 0, -0.001]}>
        <planeGeometry args={[1.7, 0.9]} />
        <meshBasicMaterial color="black" opacity={0.7} transparent />
      </mesh>
      <mesh>
        <planeGeometry args={[1.6, 0.8]} />
        <meshBasicMaterial
          map={imageUrl ? (Array.isArray(texture) ? texture[0] : (texture as THREE.Texture)) : undefined}
          toneMapped={false}
        />
      </mesh>
      <Text
        position={[0, -0.55, 0]}
        fontSize={0.12}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {('title' in hotspot && hotspot.title) || ''}
      </Text>
    </group>
  );
}

// Billboard 3D simple para vídeos (placeholder)
function HotspotVideoBillboard({ hotspot }: { hotspot: Hotspot }) {
  const yOffset = 0.8;
  const pos = Array.isArray(hotspot.position)
    ? { x: hotspot.position[0] ?? 0, y: hotspot.position[1] ?? 0, z: hotspot.position[2] ?? 0 }
    : hotspot.position as { x: number; y: number; z: number };

  return (
    <group position={[pos.x, pos.y + yOffset, pos.z]}>
      <mesh>
        <planeGeometry args={[1.6, 0.8]} />
        <meshBasicMaterial color="#7c3aed" opacity={0.9} transparent />
      </mesh>
      <Text
        position={[0, 0, 0.01]}
        fontSize={0.4}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#000000"
      >
        🎬
      </Text>
      <Text
        position={[0, -0.55, 0]}
        fontSize={0.12}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {('title' in hotspot && hotspot.title) || ''}
      </Text>
    </group>
  );
}

// Selector de billboard según tipo de hotspot
function HotspotMediaBillboard({ hotspot }: { hotspot: Hotspot }) {
  // Select correct field per hotspot type (image_url/video_url). If no media, skip.
  if (hotspot.type === 'image' && ('image_url' in hotspot) && hotspot.image_url) {
    return <HotspotImageBillboard hotspot={hotspot} />;
  }

  if (hotspot.type === 'video' && ('video_url' in hotspot) && hotspot.video_url) {
    return <HotspotVideoBillboard hotspot={hotspot} />;
  }

  return null;
}

// Componente para renderizar primitivas
function PrimitiveObject({ 
  primitive, 
  isSelected, 
  onClick,
  meshRef
}: { 
  primitive: Primitive; 
  isSelected: boolean;
  onClick: () => void;
  meshRef?: React.Ref<THREE.Mesh>;
}) {
  const renderGeometry = () => {
    switch (primitive.type) {
      case 'box':
        return <boxGeometry args={[primitive.scale.x, primitive.scale.y, primitive.scale.z]} />;
      case 'sphere':
        return <sphereGeometry args={[primitive.scale.x, 32, 32]} />;
      case 'cylinder':
        return <cylinderGeometry args={[primitive.scale.x, primitive.scale.x, primitive.scale.y, 32]} />;
      case 'cone':
        return <coneGeometry args={[primitive.scale.x, primitive.scale.y, 32]} />;
      case 'plane':
        return <planeGeometry args={[primitive.scale.x, primitive.scale.z]} />;
      default:
        return <boxGeometry args={[1, 1, 1]} />;
    }
  };

  return (
    <mesh
      ref={meshRef}
      position={[primitive.position.x, primitive.position.y, primitive.position.z]}
      rotation={[primitive.rotation.x, primitive.rotation.y, primitive.rotation.z]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {renderGeometry()}
      <meshStandardMaterial 
        color={isSelected ? '#ffd54f' : primitive.color}
        metalness={0.2}
        roughness={0.6}
      />
    </mesh>
  );
}

// Componente para renderizar luces personalizadas
function CustomLight({ light }: { light: Light }) {
  switch (light.type) {
    case 'ambient':
      return <ambientLight intensity={light.intensity} color={light.color} />;
    case 'directional':
      return (
        <directionalLight
          position={[light.position.x, light.position.y, light.position.z]}
          intensity={light.intensity}
          color={light.color}
          castShadow
        />
      );
    case 'point':
      return (
        <pointLight
          position={[light.position.x, light.position.y, light.position.z]}
          intensity={light.intensity}
          color={light.color}
        />
      );
    case 'spot':
      return (
        <spotLight
          position={[light.position.x, light.position.y, light.position.z]}
          intensity={light.intensity}
          color={light.color}
          angle={0.6}
          penumbra={0.5}
          castShadow
        />
      );
  }
}

export default function ARPreview3D({ 
  modelUrl, 
  modelTransform,
  hotspots, 
  onHotspotPositionChange,
  onHotspotScaleChange,
  onHotspotRotationChange,
  onModelTransformChange,
  phonePreview,
  onPhonePreviewChange,
  lightMode = false,
  primitives: externalPrimitives,
  onPrimitivesChange,
}: ARPreview3DProps) {
  const [selectedHotspot, setSelectedHotspot] = useState<string | null>(null);
  const primitives = useMemo(() => externalPrimitives || [], [externalPrimitives]);
  const [lights, setLights] = useState<Light[]>([]);
  const [selectedPrimitive, setSelectedPrimitive] = useState<string | null>(null);
  const [modelSelected, setModelSelected] = useState(false);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
  const [showTools, setShowTools] = useState(false);
  const [showLightControls, setShowLightControls] = useState(false);
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [webglLost, setWebglLost] = useState(false);
  const [showPhonePreview, setShowPhonePreview] = useState(false);
  const [showCameraGizmo, setShowCameraGizmo] = useState(false);
  const [selectedCameraGizmo, setSelectedCameraGizmo] = useState(false);
  const orbitRef = useRef<OrbitControlsImpl | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const isTransformingRef = useRef(false);
  const isApplyingExternalTransformRef = useRef(false);
  const isApplyingExternalPhonePreviewRef = useRef(false);
  const lastEmittedModelTransformRef = useRef<{
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
  } | null>(null);
  const primitiveIdRef = useRef(0);
  // Inicializar contador de IDs de primitivas basado en las primitivas externas
  useEffect(() => {
    try {
      const maxId = primitives.reduce((acc, p) => {
        const m = String(p.id).match(/^primitive-(\d+)$/);
        const n = m ? parseInt(m[1], 10) : 0;
        return Math.max(acc, n);
      }, 0);
      primitiveIdRef.current = Math.max(primitiveIdRef.current, maxId);
      } catch {
      // noop
    }
  }, [primitives]);
  // Refs para TransformControls / selección
  const transformRefs = useRef<Record<string, TransformControlsImpl | null>>({}); // refs por instancia de TransformControls
  const selectedPrimitiveMeshRef = useRef<THREE.Mesh | null>(null);
  const selectedHotspotMeshRef = useRef<THREE.Mesh | null>(null);

  const [modelPosition, setModelPosition] = useState<{ x: number; y: number; z: number }>({
    x: 0,
    y: 0,
    z: 0,
  });
  const [modelRotation, setModelRotation] = useState<{ x: number; y: number; z: number }>({
    x: 0,
    y: 0,
    z: 0,
  });
  const [modelScale, setModelScale] = useState<{ x: number; y: number; z: number }>({
    x: 1,
    y: 1,
    z: 1,
  });

  // Animaciones (si el glTF incluye clips)
  const [availableAnimations, setAvailableAnimations] = useState<THREE.AnimationClip[]>([]);
  const [selectedAnimation, setSelectedAnimation] = useState<string | null>(null);
  const [animPlaying, setAnimPlaying] = useState(true);
  const [animSpeed, setAnimSpeed] = useState<number>(1);
  const [animLoop, setAnimLoop] = useState<boolean>(true);

  // Reset animation list cuando cambia el modelo
  useEffect(() => {
    setAvailableAnimations([]);
    setSelectedAnimation(null);
    setAnimPlaying(true);
    setAnimSpeed(1);
    setAnimLoop(true);
  }, [modelUrl]);

  // Opciones de calibración para la vista móvil (Phone Preview)
  // En WebXR real: la cámara está fija en (0, 1.6, 0) - nivel de ojos
  // El modelo se ancla a una distancia delante del usuario
  const [anchorDistance, setAnchorDistance] = useState<number>(3.0); // qué tan lejos del usuario aparece el modelo
  const [anchorYOffset, setAnchorYOffset] = useState<number>(0); // ajuste de altura del ancla (0 = nivel del suelo)
  const [arModelScale, setArModelScale] = useState<number>(1.0); // escala del modelo en AR

  // Normalizar phonePreview entrante para asegurar valores numéricos
  const phonePreviewForScene = phonePreview
    ? {
        cameraDistance: typeof phonePreview.cameraDistance === 'number' ? phonePreview.cameraDistance : anchorDistance,
        yOffset: typeof phonePreview.yOffset === 'number' ? phonePreview.yOffset : anchorYOffset,
        previewScale: typeof phonePreview.previewScale === 'number' ? phonePreview.previewScale : arModelScale,
      }
    : { cameraDistance: anchorDistance, yOffset: anchorYOffset, previewScale: arModelScale };

  const syncModelStateFromGroup = () => {
    const obj = modelGroupRef.current;
    if (!obj) return;

    const eps = 1e-6;
    const nextPos = { x: obj.position.x, y: obj.position.y, z: obj.position.z };
    const nextRot = { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z };
    const nextScl = { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z };

    const posChanged =
      Math.abs(modelPosition.x - nextPos.x) > eps ||
      Math.abs(modelPosition.y - nextPos.y) > eps ||
      Math.abs(modelPosition.z - nextPos.z) > eps;
    const rotChanged =
      Math.abs(modelRotation.x - nextRot.x) > eps ||
      Math.abs(modelRotation.y - nextRot.y) > eps ||
      Math.abs(modelRotation.z - nextRot.z) > eps;
    const sclChanged =
      Math.abs(modelScale.x - nextScl.x) > eps ||
      Math.abs(modelScale.y - nextScl.y) > eps ||
      Math.abs(modelScale.z - nextScl.z) > eps;

    if (posChanged) setModelPosition(nextPos);
    if (rotChanged) setModelRotation(nextRot);
    if (sclChanged) setModelScale(nextScl);
  };

  // Sincronizar transform guardado (desde el padre) hacia el canvas.
  // Esto permite que, al recargar o al cambiar de atractivo, el modelo
  // aparezca con la transformación persistida.
  useEffect(() => {
    if (!modelTransform) return;
    if (isTransformingRef.current) return;

    const eps = 1e-6;
    const needsUpdate =
      Math.abs(modelPosition.x - modelTransform.position.x) > eps ||
      Math.abs(modelPosition.y - modelTransform.position.y) > eps ||
      Math.abs(modelPosition.z - modelTransform.position.z) > eps ||
      Math.abs(modelRotation.x - modelTransform.rotation.x) > eps ||
      Math.abs(modelRotation.y - modelTransform.rotation.y) > eps ||
      Math.abs(modelRotation.z - modelTransform.rotation.z) > eps ||
      Math.abs(modelScale.x - modelTransform.scale.x) > eps ||
      Math.abs(modelScale.y - modelTransform.scale.y) > eps ||
      Math.abs(modelScale.z - modelTransform.scale.z) > eps;

    if (!needsUpdate) return;

    // Marcar que este cambio viene de afuera para no re-emitirlo al padre.
    isApplyingExternalTransformRef.current = true;

    // Aplicar cambios directamente sin setTimeout para evitar condiciones de carrera
    setModelPosition({ ...modelTransform.position });
    setModelRotation({ ...modelTransform.rotation });
    setModelScale({ ...modelTransform.scale });

    if (modelGroupRef.current) {
      modelGroupRef.current.position.set(
        modelTransform.position.x,
        modelTransform.position.y,
        modelTransform.position.z
      );
      modelGroupRef.current.rotation.set(
        modelTransform.rotation.x,
        modelTransform.rotation.y,
        modelTransform.rotation.z
      );
      modelGroupRef.current.scale.set(
        modelTransform.scale.x,
        modelTransform.scale.y,
        modelTransform.scale.z
      );
    }

    // Resetear flag después de aplicar
    requestAnimationFrame(() => {
      isApplyingExternalTransformRef.current = false;
    });
  }, [modelTransform]);

  // Guardar la referencia al callback externo para evitar re-ejecuciones
  // del efecto cuando la identidad del callback cambia en el padre.
  const onModelTransformChangeRef = useRef<typeof onModelTransformChange | null>(onModelTransformChange ?? null);
  useEffect(() => {
    onModelTransformChangeRef.current = onModelTransformChange ?? null;
  }, [onModelTransformChange]);

  // Phone preview change callback ref
  const onPhonePreviewChangeRef = useRef<typeof onPhonePreviewChange | null>(onPhonePreviewChange ?? null);
  useEffect(() => {
    onPhonePreviewChangeRef.current = onPhonePreviewChange ?? null;
  }, [onPhonePreviewChange]);

  // Ref para rastrear último valor emitido y último recibido del padre
  const lastEmittedPhonePreviewRef = useRef<{ cameraDistance: number; yOffset: number; previewScale: number } | null>(null);
  const lastReceivedPhonePreviewRef = useRef<typeof phonePreview>(phonePreview);
  
  // Refs para rastrear valores locales actuales sin agregarlos como dependencias
  const anchorDistanceRef = useRef(anchorDistance);
  const anchorYOffsetRef = useRef(anchorYOffset);
  const arModelScaleRef = useRef(arModelScale);
  
  // Mantener refs sincronizados con estados
  anchorDistanceRef.current = anchorDistance;
  anchorYOffsetRef.current = anchorYOffset;
  arModelScaleRef.current = arModelScale;

  // Inicializar valores de calibración desde props si vienen del padre
  useEffect(() => {
    if (!phonePreview) return;
    lastReceivedPhonePreviewRef.current = phonePreview;
    
    const eps = 1e-6;
    const needsUpdate =
      (typeof phonePreview.cameraDistance === 'number' && 
       Math.abs(anchorDistanceRef.current - phonePreview.cameraDistance) > eps) ||
      (typeof phonePreview.yOffset === 'number' && 
       Math.abs(anchorYOffsetRef.current - phonePreview.yOffset) > eps) ||
      (typeof phonePreview.previewScale === 'number' && 
       Math.abs(arModelScaleRef.current - phonePreview.previewScale) > eps);
    
    if (!needsUpdate) return;
    
    // Marcar que estamos aplicando cambios externos para no re-emitirlos
    isApplyingExternalPhonePreviewRef.current = true;
    
    // Solo actualizar si los valores realmente cambiaron
    if (typeof phonePreview.cameraDistance === 'number' && 
        Math.abs(anchorDistanceRef.current - phonePreview.cameraDistance) > eps) {
      setAnchorDistance(phonePreview.cameraDistance);
    }
    if (typeof phonePreview.yOffset === 'number' && 
        Math.abs(anchorYOffsetRef.current - phonePreview.yOffset) > eps) {
      setAnchorYOffset(phonePreview.yOffset);
    }
    if (typeof phonePreview.previewScale === 'number' && 
        Math.abs(arModelScaleRef.current - phonePreview.previewScale) > eps) {
      setArModelScale(phonePreview.previewScale);
    }
  }, [phonePreview]);

  // Persistir transform del modelo hacia el padre cuando cambien las transformaciones.
  // No incluimos la referencia al callback en las dependencias para evitar
  // bucles por cambios de identidad del handler en el componente padre.
   
  useEffect(() => {
    const fn = onModelTransformChangeRef.current;
    if (typeof fn === 'function') {
      if (isApplyingExternalTransformRef.current) {
        isApplyingExternalTransformRef.current = false;
        return;
      }

      const eps = 1e-6;
      const next = {
        position: modelPosition,
        rotation: modelRotation,
        scale: modelScale,
      };

      const prev = lastEmittedModelTransformRef.current;
      const sameAsPrev =
        !!prev &&
        Math.abs(prev.position.x - next.position.x) <= eps &&
        Math.abs(prev.position.y - next.position.y) <= eps &&
        Math.abs(prev.position.z - next.position.z) <= eps &&
        Math.abs(prev.rotation.x - next.rotation.x) <= eps &&
        Math.abs(prev.rotation.y - next.rotation.y) <= eps &&
        Math.abs(prev.rotation.z - next.rotation.z) <= eps &&
        Math.abs(prev.scale.x - next.scale.x) <= eps &&
        Math.abs(prev.scale.y - next.scale.y) <= eps &&
        Math.abs(prev.scale.z - next.scale.z) <= eps;

      if (sameAsPrev) return;
      lastEmittedModelTransformRef.current = {
        position: { ...next.position },
        rotation: { ...next.rotation },
        scale: { ...next.scale },
      };
      fn(next);
    }
  }, [
    modelPosition.x, modelPosition.y, modelPosition.z,
    modelRotation.x, modelRotation.y, modelRotation.z,
    modelScale.x, modelScale.y, modelScale.z
  ]);

  // Emitir cambios de calibración al padre cuando cambian
  useEffect(() => {
    const fn = onPhonePreviewChangeRef.current;
    if (typeof fn === 'function') {
      // Si estamos aplicando valores del padre, no re-emitir
      if (isApplyingExternalPhonePreviewRef.current) {
        isApplyingExternalPhonePreviewRef.current = false;
        return;
      }
      
      const eps = 1e-6;
      const next = { cameraDistance: anchorDistance, yOffset: anchorYOffset, previewScale: arModelScale };
      const prev = lastEmittedPhonePreviewRef.current;
      
      // No emitir si ya emitimos este mismo valor antes
      if (prev &&
          Math.abs(prev.cameraDistance - next.cameraDistance) <= eps &&
          Math.abs(prev.yOffset - next.yOffset) <= eps &&
          Math.abs(prev.previewScale - next.previewScale) <= eps) {
        return;
      }
      
      lastEmittedPhonePreviewRef.current = { ...next };
      fn(next);
    }
  }, [anchorDistance, anchorYOffset, arModelScale]);

  // Ahora cada TransformControls se instancia con su propio ref (transformRefs.current[id])
  // y se monta directamente alrededor del objeto seleccionado, por lo que no necesitamos
  // re-adjuntar manualmente en efectos. Esto evita condiciones de carrera donde un
  // único control era re-adjuntado a múltiples objetos.

  const clearSelection = () => {
    // Antes de limpiar selección (por ejemplo, click en la grilla),
    // asegurar que el estado se queda con el último transform real.
    syncModelStateFromGroup();
    setSelectedPrimitive(null);
    setSelectedHotspot(null);
    setModelSelected(false);
  };

  // Funciones para manejar primitivas
  const addPrimitive = (type: Primitive['type']) => {
    if (!onPrimitivesChange) return;
    primitiveIdRef.current += 1;
    const newPrimitive: Primitive = {
      id: `primitive-${primitiveIdRef.current}`,
      type,
      position: { x: 0, y: 1, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      color: '#667eea'
    };
    const updated = [...primitives, newPrimitive];
    onPrimitivesChange(updated);
  };

  const removePrimitive = (id: string) => {
    if (!onPrimitivesChange) return;
    const updated = primitives.filter((p: Primitive) => p.id !== id);
    onPrimitivesChange(updated);
    if (selectedPrimitive === id) setSelectedPrimitive(null);
  };

  // Funciones para manejar luces
  const addLight = (type: Light['type']) => {
    const newLight: Light = {
      id: `light-${Date.now()}`,
      type,
      position: { x: 5, y: 5, z: 5 },
      intensity: type === 'ambient' ? 0.5 : 1,
      color: '#ffffff'
    };
    setLights([...lights, newLight]);
  };

  const removeLight = (id: string) => {
    setLights(lights.filter(l => l.id !== id));
  };

  // Helpers para editar la primitiva seleccionada
  const updateSelectedPrimitiveScale = (axis: 'x' | 'y' | 'z', value: number) => {
    if (!selectedPrimitive) return;
    if (!onPrimitivesChange) return;
    const updated = primitives.map((p: Primitive) => 
      p.id === selectedPrimitive
        ? { ...p, scale: { ...p.scale, [axis]: value } }
        : p
    );
    onPrimitivesChange(updated);
  };

  const updateSelectedPrimitiveRotation = (axis: 'x' | 'y' | 'z', value: number) => {
    if (!selectedPrimitive) return;
    if (!onPrimitivesChange) return;
    const updated = primitives.map((p: Primitive) => 
      p.id === selectedPrimitive
        ? { ...p, rotation: { ...p.rotation, [axis]: value } }
        : p
    );
    onPrimitivesChange(updated);
  };

  

  const updatePrimitivePosition = (id: string, position: { x: number; y: number; z: number }) => {
    if (!onPrimitivesChange) return;
    const updated = primitives.map((p: Primitive) => 
      p.id === id
        ? { ...p, position }
        : p
    );
    onPrimitivesChange(updated);
  };

  // Efecto para monitorear y re-habilitar OrbitControls si se quedan deshabilitados
  useEffect(() => {
    const checkInterval = setInterval(() => {
      if (orbitRef.current && !isTransformingRef.current) {
        // Si no estamos transformando y los controles están deshabilitados, re-habilitarlos
        if (!orbitRef.current.enabled) {
          console.log('OrbitControls deshabilitados detectados, re-habilitando...');
          orbitRef.current.enabled = true;
        }
      }
    }, 1000); // Verificar cada segundo

    return () => clearInterval(checkInterval);
  }, []);

  // Función para sincronizar la vista del editor con la cámara del teléfono
  // En WebXR: la cámara está en (0, 1.6, 0) y el modelo anclado delante
  const syncToPhoneCamera = () => {
    const controls = orbitRef.current;
    if (!controls) return;
    
    const cam = controls.object;
    
    // Posicionar la cámara del editor donde estaría en AR real (nivel de ojos)
    cam.position.set(0, 1.6, 0);
    
    // Apuntar hacia el ancla del modelo
    controls.target.set(0, anchorYOffset, -anchorDistance);
    
    // Actualizar el FOV si es una cámara perspectiva
    if (cam instanceof THREE.PerspectiveCamera) {
      cam.fov = 75; // FOV típico de cámaras de teléfono
      cam.updateProjectionMatrix();
    }
    
    controls.update();
  };

  // Función para encuadrar automáticamente el modelo en la vista
  const frameModel = () => {
    const controls = orbitRef.current;
    if (!controls || !modelUrl) return;
    
    const cam = controls.object;
    
    // Calcular el bounding box del modelo
    let box = new THREE.Box3();
    
    if (modelGroupRef.current) {
      box.setFromObject(modelGroupRef.current);
    } else {
      // Si no hay modelo, usar un box por defecto
      box = new THREE.Box3(
        new THREE.Vector3(-1, -1, -1),
        new THREE.Vector3(1, 1, 1)
      );
    }
    
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // Calcular la distancia ideal de la cámara
    const fov = cam instanceof THREE.PerspectiveCamera ? cam.fov : 60;
    const distance = maxDim / (2 * Math.tan((fov * Math.PI) / 360));
    const padding = 1.5; // Factor de padding para que no esté tan ajustado
    
    // Posicionar la cámara en una vista isométrica agradable
    const finalDistance = distance * padding;
    cam.position.set(
      center.x + finalDistance * 0.7,
      center.y + finalDistance * 0.5,
      center.z + finalDistance * 0.7
    );
    
    controls.target.copy(center);
    controls.update();
  };

  // Presets de cámara para facilitar la vista
  const setCameraPreset = (preset: 'front' | 'back' | 'top' | 'iso') => {
    const controls = orbitRef.current;
    if (!controls) return;
    const cam = controls.object;
    const targetVec = modelGroupRef.current ? modelGroupRef.current.position.clone() : new THREE.Vector3(0, 0, 0);
    const distance = Math.max(4, cam.position.distanceTo(targetVec) || 6);

    switch (preset) {
      case 'front':
        cam.position.set(targetVec.x, targetVec.y + distance * 0.12, targetVec.z + distance);
        break;
      case 'back':
        cam.position.set(targetVec.x, targetVec.y + distance * 0.12, targetVec.z - distance);
        break;
      case 'top':
        cam.position.set(targetVec.x, targetVec.y + distance, targetVec.z);
        break;
      case 'iso':
        cam.position.set(targetVec.x + distance * 0.7, targetVec.y + distance * 0.5, targetVec.z + distance * 0.7);
        break;
    }

    controls.target.copy(targetVec);
    controls.update();
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Contenedor del visor 3D - Adaptativo */}
      <div style={{ 
        width: '100%', 
        height: showAdvancedControls || showLightControls ? '350px' : '500px', // Canvas más pequeño cuando se edita
        background: '#1a1a1a',
        borderRadius: '10px',
        overflow: 'hidden',
        position: 'relative',
        border: '1px solid #333',
        transition: 'height 0.3s ease'
      }}>
        <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: [3, 2, 3], fov: 60 }}
        style={{ width: '100%', height: '100%', display: 'block', background: '#000000' }}
        onCreated={(state) => {
          state.gl.setClearColor('#000000', 1);

          // Detectar pérdida de contexto WebGL y mostrar mensaje amigable
          const canvas = state.gl.domElement;
          const onLost = (event: Event) => {
            event.preventDefault();
            setWebglLost(true);
          };
          canvas.addEventListener('webglcontextlost', onLost, { passive: false });

          setCanvasReady(true);
          cameraRef.current = state.camera as THREE.Camera;
        }}
        onPointerMissed={clearSelection}
        >
        <OrbitControls 
          ref={orbitRef}
          enableDamping
          dampingFactor={0.05}
          minDistance={0.5}
          maxDistance={50}
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          maxPolarAngle={Math.PI}
          minPolarAngle={0}
          makeDefault
        />

        {/* Gizmo mode toolbar (translate / rotate / scale) */}
        <group position={[0, 0, 0]} />

        {/* Iluminación base muy ligera para evitar forzar la GPU */}
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 5, 5]} intensity={1} />

        {/* Luces personalizadas (sin sombras para que sea más liviano) */}
        {lights.map((light) => (
          <CustomLight key={light.id} light={light} />
        ))}

        {/* Grid */}
        <ARGrid />

        {/* Gizmo del ancla AR (donde se posiciona el modelo) */}
        {showCameraGizmo && (
          selectedCameraGizmo ? (
            <TransformControls
              mode={transformMode}
              size={1.2}
              onMouseDown={() => { if (orbitRef.current) orbitRef.current.enabled = false; }}
              onMouseUp={() => { if (orbitRef.current) orbitRef.current.enabled = true; }}
              onObjectChange={(event) => {
                const target = (event as unknown as { target?: { object?: THREE.Object3D } }).target;
                const obj = target?.object;
                if (!obj) return;

                const pos = { x: obj.position.x, y: obj.position.y, z: obj.position.z };
                // En AR real, la cámara está en (0, 1.6, 0), el gizmo muestra la posición del ancla
                // Este gizmo ya no representa la "cámara" sino el punto donde se ancla el modelo
                setAnchorDistance(Math.abs(pos.z)); // distancia desde el usuario
                setAnchorYOffset(pos.y); // altura del ancla
              }}
            >
              <group position={[0, anchorYOffset, -anchorDistance]}>
                <Box args={[0.5, 0.3, 0.2]} position={[0, 0, 0]}>
                  <meshStandardMaterial color="#00ff00" wireframe />
                </Box>
                <Text position={[0, 0.5, 0]} fontSize={0.2} color="#00ff00">
                  ⚓ Ancla AR
                </Text>
              </group>
            </TransformControls>
          ) : (
            <group position={[0, anchorYOffset, -anchorDistance]} onClick={() => setSelectedCameraGizmo(true)}>
              <Box args={[0.5, 0.3, 0.2]} position={[0, 0, 0]}>
                <meshStandardMaterial color="#00ff00" wireframe />
              </Box>
              <Text position={[0, 0.5, 0]} fontSize={0.2} color="#00ff00">
                ⚓ Ancla AR
              </Text>
            </group>
          )
        )}

        {/* Marcador del target de la cámara (pequeña esfera) */}
        <CameraTargetMarker orbitRef={orbitRef} />

        {/* Helper visual del frustum de la cámara del teléfono */}
        {showCameraGizmo && (
          <PhoneCameraFrustumHelper 
            distance={anchorDistance} 
            yOffset={anchorYOffset} 
            fov={75} 
          />
        )}

        {/* Modelo 3D (solo si hay URL definida).
            Ahora puede seleccionarse y moverse con gizmo igual que las primitivas.
            El TransformControls actúa directamente sobre el grupo del modelo
            y modelPosition solo refleja esa posición en la UI. */}
        {!lightMode && modelUrl && (
          <Suspense
            fallback={
              <mesh position={[0, 0.5, 0]}>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial color="#888888" wireframe />
              </mesh>
            }
          >
            {modelSelected ? (
              <TransformControls
                ref={(el) => { transformRefs.current['model'] = el; }}
                mode={transformMode}
                size={1.6}
                space="world"
                onMouseDown={() => {
                  isTransformingRef.current = true;
                  if (orbitRef.current) orbitRef.current.enabled = false;
                }}
                onMouseUp={() => {
                  if (orbitRef.current) orbitRef.current.enabled = true;
                  isTransformingRef.current = false;
                  syncModelStateFromGroup();
                }}
                onObjectChange={(event) => {
                  const target = (event as unknown as { target?: { object?: THREE.Object3D } }).target;
                  const obj = target?.object;
                  if (!obj) return;

                  const { x, y, z } = obj.position;
                  setModelPosition({ x, y, z });
                  setModelRotation({ x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z });
                  setModelScale({ x: obj.scale.x, y: obj.scale.y, z: obj.scale.z });
                }}
              >
                <group
                  ref={modelGroupRef}
                  position={[modelPosition.x, modelPosition.y, modelPosition.z]}
                  rotation={[modelRotation.x, modelRotation.y, modelRotation.z]}
                  scale={[modelScale.x, modelScale.y, modelScale.z]}
                  onClick={(e) => { e.stopPropagation(); setModelSelected(true); }}
                >
                  <Model
                    url={modelUrl}
                    activeAnimationName={selectedAnimation}
                    playing={animPlaying}
                    speed={animSpeed}
                    loop={animLoop}
                    onLoadedAnimations={(clips) => {
                      const normalized = clips.map((c, i) => { if (!c.name) c.name = `clip-${i}`; return c; });
                      setAvailableAnimations(normalized);
                      if (!selectedAnimation && normalized.length > 0) setSelectedAnimation(normalized[0].name || null);
                    }}
                  />
                </group>
              </TransformControls>
            ) : (
              <group
                ref={modelGroupRef}
                position={[modelPosition.x, modelPosition.y, modelPosition.z]}
                rotation={[modelRotation.x, modelRotation.y, modelRotation.z]}
                scale={[modelScale.x, modelScale.y, modelScale.z]}
                onClick={(e) => { e.stopPropagation(); setModelSelected(true); }}
              >
                <Model
                  url={modelUrl}
                  activeAnimationName={selectedAnimation}
                  playing={animPlaying}
                  speed={animSpeed}
                  loop={animLoop}
                  onLoadedAnimations={(clips) => {
                    const normalized = clips.map((c, i) => { if (!c.name) c.name = `clip-${i}`; return c; });
                    setAvailableAnimations(normalized);
                    if (!selectedAnimation && normalized.length > 0) setSelectedAnimation(normalized[0].name || null);
                  }}
                />
              </group>
            )}
          </Suspense>
        )}

        {/* Primitivas personalizadas con gizmo para la seleccionada */}
        {primitives.map((primitive: Primitive) => {
          const isSelected = selectedPrimitive === primitive.id;

            if (isSelected) {
            return (
              <TransformControls
                ref={(el) => { transformRefs.current[primitive.id] = el; }}
                key={primitive.id}
                mode={transformMode}
                size={1.2}
                onMouseDown={() => { if (orbitRef.current) orbitRef.current.enabled = false; }}
                onMouseUp={() => { if (orbitRef.current) orbitRef.current.enabled = true; }}
                onObjectChange={(event) => {
                  const target = (event as unknown as { target?: { object?: THREE.Object3D } }).target;
                  const obj = target?.object;
                  if (!obj) return;

                  const pos = { x: obj.position.x, y: obj.position.y, z: obj.position.z };
                  const rot = { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z };
                  const scl = { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z };

                  if (transformMode === 'translate') updatePrimitivePosition(primitive.id, pos);
                  if (transformMode === 'rotate') {
                    updateSelectedPrimitiveRotation('x', rot.x);
                    updateSelectedPrimitiveRotation('y', rot.y);
                    updateSelectedPrimitiveRotation('z', rot.z);
                  }
                  if (transformMode === 'scale') {
                    updateSelectedPrimitiveScale('x', scl.x);
                    updateSelectedPrimitiveScale('y', scl.y);
                    updateSelectedPrimitiveScale('z', scl.z);
                  }
                }}
              >
                <PrimitiveObject
                  primitive={primitive}
                  isSelected
                  meshRef={selectedPrimitiveMeshRef}
                  onClick={() => setSelectedPrimitive(primitive.id)}
                />
              </TransformControls>
            );
          }

          return (
            <PrimitiveObject
              key={primitive.id}
              primitive={primitive}
              isSelected={false}
              onClick={() => setSelectedPrimitive(primitive.id)}
            />
          );
        })}

        {/* Hotspots con gizmo cuando están seleccionados */}
        {hotspots.map((hotspot) => {
          const isSelected = selectedHotspot === hotspot.id;

            if (isSelected && onHotspotPositionChange) {
            return (
              <TransformControls
                ref={(el) => { transformRefs.current[hotspot.id] = el; }}
                key={hotspot.id}
                mode={transformMode}
                size={1.0}
                onMouseDown={() => { if (orbitRef.current) orbitRef.current.enabled = false; }}
                onMouseUp={() => { if (orbitRef.current) orbitRef.current.enabled = true; }}
                onObjectChange={(event) => {
                  const target = (event as unknown as { target?: { object?: THREE.Object3D } }).target;
                  const obj = target?.object;
                  if (!obj) return;

                  const pos = { x: obj.position.x, y: obj.position.y, z: obj.position.z };
                  const rot = { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z };
                  const scl = { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z };

                  if (transformMode === 'translate' && onHotspotPositionChange) onHotspotPositionChange(hotspot.id, pos);
                  if (transformMode === 'rotate' && onHotspotRotationChange) onHotspotRotationChange(hotspot.id, rot);
                  if (transformMode === 'scale' && onHotspotScaleChange) onHotspotScaleChange(hotspot.id, scl);
                }}
              >
                <HotspotMarker
                  hotspot={hotspot}
                  isSelected
                  meshRef={selectedHotspotMeshRef}
                  onSelect={() => setSelectedHotspot(hotspot.id)}
                />
              </TransformControls>
            );
          }

          return (
            <HotspotMarker
              key={hotspot.id}
              hotspot={hotspot}
              isSelected={isSelected}
              onSelect={() => setSelectedHotspot(hotspot.id)}
            />
          );
        })}

        {/* Contenido multimedia (imagen / video) anclado en el espacio 3D */}
        {hotspots.map((hotspot) => (
          <HotspotMediaBillboard key={`${hotspot.id}-media`} hotspot={hotspot} />
        ))}
        </Canvas>

        {/* Indicador de carga del Canvas */}
        {!canvasReady && !webglLost && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '20px',
            borderRadius: '10px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '10px' }}>🔄</div>
            <div>Iniciando visor 3D...</div>
          </div>
        )}

        {/* Mensaje si se pierde el contexto WebGL */}
        {webglLost && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0,0,0,0.9)',
            color: 'white',
            padding: '20px',
            borderRadius: '10px',
            textAlign: 'center',
            maxWidth: '280px'
          }}>
            <div style={{ fontSize: '1.6rem', marginBottom: '10px' }}>⚠️</div>
            <div style={{ fontSize: '0.9rem', marginBottom: '6px' }}>
              El navegador perdió el contexto 3D (WebGL).
            </div>
            <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
              Cierra otras pestañas con gráficos 3D y recarga esta página.
            </div>
          </div>
        )}

        {/* Controles e información */}

        {/* Phone preview overlay usando ARScene para mostrar exactamente lo mismo que en el dispositivo */}
        {showPhonePreview && modelUrl && (
          <div style={{ position: 'absolute', top: 14, right: 14, width: 220, height: 440, zIndex: 40, borderRadius: 18, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ width: '100%', height: '100%', background: '#000' }}>
              <Canvas 
                style={{ width: '100%', height: '100%' }}
              >
                <Suspense fallback={null}>
                  <ARScene
                    attraction={{
                      id: 'preview-phone',
                      name: 'Vista Móvil',
                      lat: 0,
                      lng: 0,
                      ar_model_url: modelUrl,
                      ar_hotspots: {
                          hotspots,
                          primitives,
                          modelTransform: modelTransform ? modelTransform : {
                            position: modelPosition,
                            rotation: modelRotation,
                            scale: modelScale
                          },
                          phonePreview: phonePreviewForScene
                        },
                      has_ar_content: true
                    }}
                    showGrid={true}
                    disableOrbitControls={true}
                    anchorPosition={[0, phonePreviewForScene.yOffset, -phonePreviewForScene.cameraDistance]}
                    isAnchored={true}
                    phonePreview={phonePreviewForScene}
                  />
                </Suspense>
              </Canvas>
            </div>
          </div>
        )}
        <div style={{
          position: 'absolute',
          top: 10,
          left: 10,
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '10px',
          borderRadius: '8px',
          fontSize: '0.8rem',
          maxWidth: '250px',
          border: '1px solid rgba(0, 255, 0, 0.3)'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              🎮 Controles
              <span style={{ fontSize: '0.6rem', padding: '2px 6px', background: canvasReady ? '#00ff00' : '#ff9800', borderRadius: '4px', color: '#000' }}>
                {canvasReady ? '✓' : '...'}
              </span>
            </div>
            <button
              onClick={() => {
                if (orbitRef.current) {
                  orbitRef.current.enabled = true;
                }
              }}
              style={{
                padding: '2px 6px',
                background: '#2563eb',
                border: 'none',
                borderRadius: 4,
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.7rem'
              }}
              title="Habilitar controles de cámara"
            >
              🔓 Activar
            </button>
          </div>
          <div style={{ fontSize: '0.7rem', lineHeight: '1.5' }}>
            • <strong>Rotar:</strong> Click izq + arrastrar<br/>
            • <strong>Zoom:</strong> Rueda del mouse<br/>
            • <strong>Mover:</strong> Click der + arrastrar<br/>
            • <strong>Seleccionar:</strong> Click en objeto
          </div>

          {/* Gizmo mode buttons */}
          <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
            <button
              onClick={() => setTransformMode('translate')}
              style={{
                padding: '4px 8px',
                background: transformMode === 'translate' ? '#2563eb' : 'transparent',
                color: transformMode === 'translate' ? 'white' : '#ddd',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: '0.75rem'
              }}
              title="Mover (Translate)"
            >
              <Move size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Mover
            </button>

            <button
              onClick={() => setTransformMode('rotate')}
              style={{
                padding: '4px 8px',
                background: transformMode === 'rotate' ? '#2563eb' : 'transparent',
                color: transformMode === 'rotate' ? 'white' : '#ddd',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: '0.75rem'
              }}
              title="Rotar (Rotate)"
            >
              <RotateCcw size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Rotar
            </button>

            <button
              onClick={() => setTransformMode('scale')}
              style={{
                padding: '4px 8px',
                background: transformMode === 'scale' ? '#2563eb' : 'transparent',
                color: transformMode === 'scale' ? 'white' : '#ddd',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: '0.75rem'
              }}
              title="Escalar (Scale)"
            >
              <Maximize2 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Escalar
            </button>

            {/* Mobile-preview quick toggle */}
            <button
              onClick={() => setShowPhonePreview(prev => !prev)}
              title="Vista previa móvil"
              style={{
                marginLeft: 6,
                padding: '4px 8px',
                background: showPhonePreview ? '#10B981' : 'transparent',
                color: showPhonePreview ? '#012' : '#ddd',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: '0.75rem'
              }}
            >
              📱 Preview
            </button>

            {/* Camera gizmo toggle */}
            <button
              onClick={() => setShowCameraGizmo(prev => !prev)}
              title="Mostrar gizmo del ancla AR"
              style={{
                marginLeft: 6,
                padding: '4px 8px',
                background: showCameraGizmo ? '#10B981' : 'transparent',
                color: showCameraGizmo ? 'white' : '#ddd',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: '0.75rem'
              }}
            >
              ⚓ Ancla AR
            </button>
          </div>
        </div>

        {/* Leyenda de colores */}
        <div style={{
          position: 'absolute',
          top: 10,
          right: 10,
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '10px',
          borderRadius: '8px',
          fontSize: '0.75rem'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
            Tipos de Hotspot
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#4CAF50' }} />
            <span>Información</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#2196F3' }} />
            <span>Imagen</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF9800' }} />
            <span>Video</span>
          </div>
        </div>

        {/* Info del hotspot seleccionado */}
        {selectedHotspot && (
          <div style={{
            position: 'absolute',
            bottom: 10,
            left: 10,
            right: 10,
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '0.85rem'
          }}>
            {(() => {
              const hotspot = hotspots.find(h => h.id === selectedHotspot);
              if (!hotspot) return null;

              const pos = Array.isArray(hotspot.position)
                ? { x: hotspot.position[0] ?? 0, y: hotspot.position[1] ?? 0, z: hotspot.position[2] ?? 0 }
                : hotspot.position;

              return (
                <>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    {('title' in hotspot && hotspot.title) ? hotspot.title : '(sin título)'}
                  </div>
                  <div style={{ fontSize: '0.75rem', marginBottom: '6px', opacity: 0.8 }}>
                    {('description' in hotspot && hotspot.description) ? hotspot.description : ''}
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    gap: '12px', 
                    fontSize: '0.7rem',
                    fontFamily: 'monospace',
                    background: 'rgba(255,255,255,0.1)',
                    padding: '6px',
                    borderRadius: '4px'
                  }}>
                    <span>X: {pos.x.toFixed(2)}</span>
                    <span>Y: {pos.y.toFixed(2)}</span>
                    <span>Z: {pos.z.toFixed(2)}</span>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {!modelUrl && !lightMode && primitives.length === 0 && hotspots.length === 0 && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '20px',
            borderRadius: '10px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '10px' }}>📦</div>
            <div>Agrega un modelo 3D para ver la vista previa</div>
          </div>
        )}

        {/* Controles de cámara */}
        <div style={{
          position: 'absolute',
          bottom: 10,
          right: 10,
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '0.75rem',
          lineHeight: '1.4'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>🖱️ Controles:</div>
          <div>• Click izquierdo: Rotar vista</div>
          <div>• Click derecho: Mover vista</div>
          <div>• Scroll: Zoom</div>
        </div>
      </div>

      {/* Panel debajo del canvas: Transformaciones del modelo + Hotspots */}
      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Transformaciones del modelo (debajo del canvas) */}
        {!lightMode && modelUrl && (
          <div style={{ background: '#111', color: 'white', padding: '8px', borderRadius: '8px', border: '1px solid #333' }}>
            <div style={{ fontWeight: 'bold', marginBottom: 6 }}>Modelo (Transform)</div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {/* Left: compact grid for Pos/Rot/Scale */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '110px 60px 60px 60px 34px', gap: 8, alignItems: 'center' }}>
                  {/* header */}
                  <div />
                  <div style={{ fontSize: '0.65rem', color: '#9ca3af', textAlign: 'center' }}>X</div>
                  <div style={{ fontSize: '0.65rem', color: '#9ca3af', textAlign: 'center' }}>Y</div>
                  <div style={{ fontSize: '0.65rem', color: '#9ca3af', textAlign: 'center' }}>Z</div>
                  <div />

                  {/* Posición */}
                  <div style={{ fontSize: '0.75rem', color: '#e5e7eb' }}>Posición</div>
                  <input
                    aria-label="Posición X"
                    type="number"
                    step="0.1"
                    value={modelPosition.x.toFixed(2)}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      isTransformingRef.current = true;
                      setModelPosition(prev => ({ ...prev, x: v }));
                      if (modelGroupRef.current) modelGroupRef.current.position.x = v;
                      requestAnimationFrame(() => { isTransformingRef.current = false; });
                    }}
                    style={{ width: 58, padding: '3px 6px', borderRadius: 4, border: '1px solid #444', background: '#0b0b0b', color: 'white', fontSize: '0.75rem', textAlign: 'right' }}
                  />
                  <input
                    aria-label="Posición Y"
                    type="number"
                    step="0.1"
                    value={modelPosition.y.toFixed(2)}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      isTransformingRef.current = true;
                      setModelPosition(prev => ({ ...prev, y: v }));
                      if (modelGroupRef.current) modelGroupRef.current.position.y = v;
                      requestAnimationFrame(() => { isTransformingRef.current = false; });
                    }}
                    style={{ width: 58, padding: '3px 6px', borderRadius: 4, border: '1px solid #444', background: '#0b0b0b', color: 'white', fontSize: '0.75rem', textAlign: 'right' }}
                  />
                  <input
                    aria-label="Posición Z"
                    type="number"
                    step="0.1"
                    value={modelPosition.z.toFixed(2)}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      isTransformingRef.current = true;
                      setModelPosition(prev => ({ ...prev, z: v }));
                      if (modelGroupRef.current) modelGroupRef.current.position.z = v;
                      requestAnimationFrame(() => { isTransformingRef.current = false; });
                    }}
                    style={{ width: 58, padding: '3px 6px', borderRadius: 4, border: '1px solid #444', background: '#0b0b0b', color: 'white', fontSize: '0.75rem', textAlign: 'right' }}
                  />
                  <button
                    title="Reset posición"
                    aria-label="Reset posición"
                    onClick={() => {
                      isTransformingRef.current = true;
                      setModelPosition({ x: 0, y: 0, z: 0 });
                      if (modelGroupRef.current) modelGroupRef.current.position.set(0,0,0);
                      requestAnimationFrame(() => { isTransformingRef.current = false; });
                    }}
                    style={{ width: 28, height: 28, padding: 0, background: '#374151', border: 'none', borderRadius: 6, color: 'white', fontSize: '0.95rem' }}
                  >⟲</button>

                  {/* Rotación */}
                  <div style={{ fontSize: '0.75rem', color: '#e5e7eb' }}>Rotación</div>
                  <input
                    aria-label="Rotación X"
                    type="number"
                    step="0.1"
                    value={modelRotation.x.toFixed(2)}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      isTransformingRef.current = true;
                      setModelRotation(prev => ({ ...prev, x: v }));
                      if (modelGroupRef.current) modelGroupRef.current.rotation.x = v;
                      requestAnimationFrame(() => { isTransformingRef.current = false; });
                    }}
                    style={{ width: 58, padding: '3px 6px', borderRadius: 4, border: '1px solid #444', background: '#0b0b0b', color: 'white', fontSize: '0.75rem', textAlign: 'right' }}
                  />
                  <input
                    aria-label="Rotación Y"
                    type="number"
                    step="0.1"
                    value={modelRotation.y.toFixed(2)}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      isTransformingRef.current = true;
                      setModelRotation(prev => ({ ...prev, y: v }));
                      if (modelGroupRef.current) modelGroupRef.current.rotation.y = v;
                      requestAnimationFrame(() => { isTransformingRef.current = false; });
                    }}
                    style={{ width: 58, padding: '3px 6px', borderRadius: 4, border: '1px solid #444', background: '#0b0b0b', color: 'white', fontSize: '0.75rem', textAlign: 'right' }}
                  />
                  <input
                    aria-label="Rotación Z"
                    type="number"
                    step="0.1"
                    value={modelRotation.z.toFixed(2)}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      isTransformingRef.current = true;
                      setModelRotation(prev => ({ ...prev, z: v }));
                      if (modelGroupRef.current) modelGroupRef.current.rotation.z = v;
                      requestAnimationFrame(() => { isTransformingRef.current = false; });
                    }}
                    style={{ width: 58, padding: '3px 6px', borderRadius: 4, border: '1px solid #444', background: '#0b0b0b', color: 'white', fontSize: '0.75rem', textAlign: 'right' }}
                  />
                  <button
                    title="Reset rotación"
                    aria-label="Reset rotación"
                    onClick={() => {
                      isTransformingRef.current = true;
                      setModelRotation({ x:0,y:0,z:0 });
                      if (modelGroupRef.current) modelGroupRef.current.rotation.set(0,0,0);
                      requestAnimationFrame(() => { isTransformingRef.current = false; });
                    }}
                    style={{ width: 28, height: 28, padding: 0, background: '#6b21a8', border: 'none', borderRadius: 6, color: 'white', fontSize: '0.95rem' }}
                  >⟲</button>

                  {/* Escala */}
                  <div style={{ fontSize: '0.75rem', color: '#e5e7eb' }}>Escala</div>
                  <input
                    aria-label="Escala X"
                    type="number"
                    step="0.1"
                    min={0.1}
                    value={modelScale.x.toFixed(2)}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0.1;
                      isTransformingRef.current = true;
                      setModelScale(prev => ({ ...prev, x: v }));
                      if (modelGroupRef.current) modelGroupRef.current.scale.x = v;
                      requestAnimationFrame(() => { isTransformingRef.current = false; });
                    }}
                    style={{ width: 58, padding: '3px 6px', borderRadius: 4, border: '1px solid #444', background: '#0b0b0b', color: 'white', fontSize: '0.75rem', textAlign: 'right' }}
                  />
                  <input
                    aria-label="Escala Y"
                    type="number"
                    step="0.1"
                    min={0.1}
                    value={modelScale.y.toFixed(2)}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0.1;
                      isTransformingRef.current = true;
                      setModelScale(prev => ({ ...prev, y: v }));
                      if (modelGroupRef.current) modelGroupRef.current.scale.y = v;
                      requestAnimationFrame(() => { isTransformingRef.current = false; });
                    }}
                    style={{ width: 58, padding: '3px 6px', borderRadius: 4, border: '1px solid #444', background: '#0b0b0b', color: 'white', fontSize: '0.75rem', textAlign: 'right' }}
                  />
                  <input
                    aria-label="Escala Z"
                    type="number"
                    step="0.1"
                    min={0.1}
                    value={modelScale.z.toFixed(2)}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0.1;
                      isTransformingRef.current = true;
                      setModelScale(prev => ({ ...prev, z: v }));
                      if (modelGroupRef.current) modelGroupRef.current.scale.z = v;
                      requestAnimationFrame(() => { isTransformingRef.current = false; });
                    }}
                    style={{ width: 58, padding: '3px 6px', borderRadius: 4, border: '1px solid #444', background: '#0b0b0b', color: 'white', fontSize: '0.75rem', textAlign: 'right' }}
                  />
                  <button
                    title="Reset escala"
                    aria-label="Reset escala"
                    onClick={() => {
                      isTransformingRef.current = true;
                      setModelScale({ x:1,y:1,z:1 });
                      if (modelGroupRef.current) modelGroupRef.current.scale.set(1,1,1);
                      requestAnimationFrame(() => { isTransformingRef.current = false; });
                    }}
                    style={{ width: 28, height: 28, padding: 0, background: '#0ea5a0', border: 'none', borderRadius: 6, color: 'white', fontSize: '0.95rem' }}
                  >⟲</button>
                </div>
              </div>

              {/* Right: animation controls moved here */}
              <div style={{ width: 240, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontWeight: 'bold' }}>Animaciones</div>

                {availableAnimations.length === 0 ? (
                  <div style={{ opacity: 0.7, fontSize: '0.85rem' }}>Sin animaciones en este modelo</div>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <select
                        value={selectedAnimation ?? ''}
                        onChange={(e) => setSelectedAnimation(e.target.value || null)}
                        style={{ flex: 1, padding: '6px', borderRadius: 6, background: '#111', color: 'white', border: '1px solid #333' }}
                      >
                        {availableAnimations.map((clip) => (
                          <option key={clip.name} value={clip.name}>{clip.name}</option>
                        ))}
                      </select>

                      <button
                        onClick={() => setAnimPlaying(p => !p)}
                        title={animPlaying ? 'Pausar' : 'Reproducir'}
                        style={{ padding: '6px 8px', borderRadius: 6, border: 'none', background: animPlaying ? '#f97316' : '#6b7280', color: 'white' }}
                      >
                        {animPlaying ? '⏸' : '▶'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        onClick={() => setAnimLoop(l => !l)}
                        title="Loop"
                        style={{ padding: '6px 8px', borderRadius: 6, border: 'none', background: animLoop ? '#10b981' : '#374151', color: 'white' }}
                      >
                        {animLoop ? 'Loop' : 'No'}
                      </button>

                      <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'white', flex: 1 }}>
                        <span style={{ fontSize: '0.75rem' }}>Vel</span>
                        <input type="range" min={0.1} max={2} step={0.1} value={animSpeed} onChange={(e) => setAnimSpeed(parseFloat(e.target.value))} style={{ flex: 1 }} />
                        <span style={{ width: 40, textAlign: 'right' }}>{animSpeed.toFixed(1)}x</span>
                      </label>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Hotspots (debajo del canvas) */}
        <div style={{ background: '#111', color: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #333' }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Hotspots</div>
          {hotspots.length === 0 ? (
            <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Aún no hay hotspots configurados.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {hotspots.map(h => (
                <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px', background: selectedHotspot === h.id ? 'rgba(102,126,234,0.2)' : 'transparent', borderRadius: 6 }}>
                  <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => setSelectedHotspot(h.id)}>{('title' in h && h.title) ? h.title : '(sin título)'}</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{h.type}</div>
                </div>
              ))}

              {selectedHotspot && (() => {
                const hs = hotspots.find(h => h.id === selectedHotspot);
                if (!hs) return null;
                const posObj = Array.isArray(hs.position) ? { x: hs.position[0] ?? 0, y: hs.position[1] ?? 0, z: hs.position[2] ?? 0 } : hs.position as { x:number;y:number;z:number };
                return (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ opacity: 0.8, marginBottom: 6 }}>Posición (X,Y,Z)</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['x','y','z'] as const).map(axis => (
                        <input key={axis} type="number" step="0.1" value={posObj[axis].toFixed(2)} onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          if (!onHotspotPositionChange) return;
                          const newPos = { ...posObj, [axis]: v };
                          onHotspotPositionChange(hs.id, newPos);
                        }} style={{ width: '33%', padding: '6px', borderRadius: 4, border: '1px solid #555', background: '#111', color: 'white' }} />
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Botón flotante para abrir/cerrar el sidebar de herramientas */}
      <div style={{ position: 'fixed', right: 20, top: 80, zIndex: 80 }}>
        <button onClick={() => setShowTools(prev => !prev)} style={{ padding: '8px 10px', background: '#667eea', border: 'none', borderRadius: 8, color: 'white', cursor: 'pointer' }}>
          <Settings size={14} /> {showTools ? 'Ocultar Herramientas' : 'Mostrar Herramientas'}
        </button>
      </div>

      {/* Sidebar fijo a la derecha con las herramientas (primitivas, luces, camera presets, avanzadas) */}
      {showTools && (
        <div style={{ position: 'fixed', right: 20, top: 120, width: 360, maxHeight: '70vh', overflowY: 'auto', background: '#111', color: 'white', padding: 12, borderRadius: 8, border: '1px solid #333', zIndex: 79 }}>
          {/* Primitivas */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}><Move size={14} /> Primitivas</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              <button onClick={() => addPrimitive('box')} style={{ padding: '6px 10px', background: '#4CAF50', border: 'none', borderRadius: 4, color: 'white' }}>Cubo</button>
              <button onClick={() => addPrimitive('sphere')} style={{ padding: '6px 10px', background: '#4CAF50', border: 'none', borderRadius: 4, color: 'white' }}>Esfera</button>
              <button onClick={() => addPrimitive('cylinder')} style={{ padding: '6px 10px', background: '#4CAF50', border: 'none', borderRadius: 4, color: 'white' }}>Cilindro</button>
              <button onClick={() => addPrimitive('cone')} style={{ padding: '6px 10px', background: '#4CAF50', border: 'none', borderRadius: 4, color: 'white' }}>Cono</button>
              <button onClick={() => addPrimitive('plane')} style={{ padding: '6px 10px', background: '#4CAF50', border: 'none', borderRadius: 4, color: 'white' }}>Plano</button>
            </div>
            {primitives.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: 6 }}>Primitivas existentes</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {primitives.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px', background: selectedPrimitive === p.id ? 'rgba(255,255,255,0.03)' : 'transparent', borderRadius: 6 }}>
                      <div style={{ fontSize: '0.85rem' }}>{p.type} <span style={{ opacity: 0.7, fontSize: '0.75rem' }}>{p.id}</span></div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setSelectedPrimitive(p.id)} style={{ padding: '4px 8px', background: '#2563eb', border: 'none', borderRadius: 4, color: 'white' }}>Seleccionar</button>
                        <button onClick={() => removePrimitive(p.id)} style={{ padding: '4px 8px', background: '#ef4444', border: 'none', borderRadius: 4, color: 'white' }}>Eliminar</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Luces */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}><Lightbulb size={14} /> Luces</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              <button onClick={() => addLight('ambient')} style={{ padding: '6px 10px', background: '#2196F3', border: 'none', borderRadius: 4, color: 'white' }}>Ambiental</button>
              <button onClick={() => addLight('directional')} style={{ padding: '6px 10px', background: '#2196F3', border: 'none', borderRadius: 4, color: 'white' }}>Direccional</button>
              <button onClick={() => addLight('point')} style={{ padding: '6px 10px', background: '#2196F3', border: 'none', borderRadius: 4, color: 'white' }}>Punto</button>
              <button onClick={() => addLight('spot')} style={{ padding: '6px 10px', background: '#2196F3', border: 'none', borderRadius: 4, color: 'white' }}>Foco</button>
            </div>
            {lights.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: 6 }}>Luces añadidas</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {lights.map(l => (
                    <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px', background: 'transparent', borderRadius: 6 }}>
                      <div style={{ fontSize: '0.85rem' }}>{l.type} <span style={{ opacity: 0.7, fontSize: '0.75rem' }}>{l.id}</span></div>
                      <div>
                        <button onClick={() => removeLight(l.id)} style={{ padding: '4px 8px', background: '#ef4444', border: 'none', borderRadius: 4, color: 'white' }}>Eliminar</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Camera presets */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8 }}><Camera size={14} /> Vista de Cámara</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setShowLightControls(!showLightControls)} style={{ padding: '4px 8px', background: showLightControls ? '#4CAF50' : '#607D8B', border: 'none', borderRadius: 4, color: 'white' }}>Luces</button>
                <button onClick={() => setShowAdvancedControls(!showAdvancedControls)} style={{ padding: '4px 8px', background: showAdvancedControls ? '#4CAF50' : '#607D8B', border: 'none', borderRadius: 4, color: 'white' }}>Avanzado</button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={frameModel} style={{ padding: '6px 10px', background: '#00C853', border: 'none', borderRadius: 4, color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Maximize2 size={14} /> Encuadrar
              </button>
              <button onClick={syncToPhoneCamera} style={{ padding: '6px 10px', background: '#9C27B0', border: 'none', borderRadius: 4, color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 4 }} title="Ver desde la perspectiva del teléfono">
                📱 Vista Móvil
              </button>
              <button onClick={() => setCameraPreset('front')} style={{ padding: '6px 10px', background: '#FF9800', border: 'none', borderRadius: 4, color: 'white' }}>Frontal</button>
              <button onClick={() => setCameraPreset('back')} style={{ padding: '6px 10px', background: '#FF9800', border: 'none', borderRadius: 4, color: 'white' }}>Trasera</button>
              <button onClick={() => setCameraPreset('top')} style={{ padding: '6px 10px', background: '#FF9800', border: 'none', borderRadius: 4, color: 'white' }}>Superior</button>
              <button onClick={() => setCameraPreset('iso')} style={{ padding: '6px 10px', background: '#FF9800', border: 'none', borderRadius: 4, color: 'white' }}>Isométrica</button>
            </div>
          </div>

          {/* Light controls */}
          {showLightControls && (
            <div style={{ marginBottom: 12, padding: 8, background: '#0a0a0a', borderRadius: 6, border: '1px solid #444' }}>
              <div style={{ fontWeight: 'bold', marginBottom: 6 }}>⚡ Sistema de Iluminación</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => { setLights([...lights, { id: `light-${Date.now()}`, type: 'ambient', position: { x:0,y:0,z:0 }, intensity:0.5, color:'#ffffff' }]); }} style={{ padding: '6px 8px', background: '#673AB7', border: 'none', borderRadius: 4, color: 'white' }}>+ Ambiental</button>
                <button onClick={() => { setLights([...lights, { id: `light-${Date.now()}`, type: 'directional', position: { x:5,y:10,z:5 }, intensity:1, color:'#ffffff' }]); }} style={{ padding: '6px 8px', background: '#FF5722', border: 'none', borderRadius: 4, color: 'white' }}>+ Direccional</button>
                <button onClick={() => { setLights([...lights, { id: `light-${Date.now()}`, type: 'point', position: { x:0,y:5,z:0 }, intensity:1.2, color:'#ffffff' }]); }} style={{ padding: '6px 8px', background: '#009688', border: 'none', borderRadius: 4, color: 'white' }}>+ Punto</button>
              </div>
            </div>
          )}

          {/* Advanced controls */}
          {showAdvancedControls && (
            <div style={{ padding: 8, background: '#0a0a0a', borderRadius: 6, border: '1px solid #444' }}>
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>🔧 Controles Avanzados</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={() => { if (orbitRef.current) orbitRef.current.reset(); }} style={{ padding: '4px 8px', background: '#FF9800', border: 'none', borderRadius: 4, color: 'white', fontSize: '0.72rem' }}>Resetear Cámara</button>
                <button onClick={() => { 
                  if (confirm('¿Resetear posición/rot/escala?')) { 
                    isTransformingRef.current = true;
                    setModelPosition({ x:0,y:0,z:0 }); 
                    setModelRotation({ x:0,y:0,z:0 }); 
                    setModelScale({ x:1,y:1,z:1 });
                    if (modelGroupRef.current) {
                      modelGroupRef.current.position.set(0,0,0);
                      modelGroupRef.current.rotation.set(0,0,0);
                      modelGroupRef.current.scale.set(1,1,1);
                    }
                    requestAnimationFrame(() => { isTransformingRef.current = false; });
                  } 
                }} style={{ padding: '4px 8px', background: '#E91E63', border: 'none', borderRadius: 4, color: 'white', fontSize: '0.72rem' }}>Resetear Modelo</button>
                <button onClick={() => setLights([])} style={{ padding: '6px 10px', background: '#9C27B0', border: 'none', borderRadius: 4, color: 'white' }}>Limpiar Luces</button>

                {/* Calibración AR - Conceptos WebXR */}
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #333' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 6 }}>📱 Calibración AR (WebXR)</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.7, marginBottom: 8 }}>En AR real, la cámara está fija en la posición del usuario. Ajusta dónde se ancla el modelo:</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Distancia del ancla (m)</div>
                      <input type="range" min="0.5" max="10" step="0.1" value={anchorDistance} onChange={(e) => setAnchorDistance(parseFloat(e.target.value))} />
                    </div>
                    <div style={{ width: '76px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                      <input
                        type="number"
                        min={0.5}
                        max={10}
                        step={0.1}
                        value={Number(anchorDistance.toFixed(1))}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (Number.isNaN(v)) return;
                          setAnchorDistance(v);
                        }}
                        style={{ width: 72, padding: '4px', borderRadius: 4, border: '1px solid #555', background: '#111', color: 'white', textAlign: 'right' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Altura del ancla (m)</div>
                      <input type="range" min="-2" max="3" step="0.05" value={anchorYOffset} onChange={(e) => setAnchorYOffset(parseFloat(e.target.value))} />
                    </div>
                    <div style={{ width: '76px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                      <input
                        type="number"
                        min={-2}
                        max={3}
                        step={0.05}
                        value={Number(anchorYOffset.toFixed(2))}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (Number.isNaN(v)) return;
                          setAnchorYOffset(v);
                        }}
                        style={{ width: 72, padding: '4px', borderRadius: 4, border: '1px solid #555', background: '#111', color: 'white', textAlign: 'right' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Escala del modelo</div>
                      <input type="range" min="0.2" max="3" step="0.05" value={arModelScale} onChange={(e) => setArModelScale(parseFloat(e.target.value))} />
                    </div>
                    <div style={{ width: '92px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                      <span style={{ opacity: 0.9 }}>x</span>
                      <input
                        type="number"
                        min={0.2}
                        max={3}
                        step={0.05}
                        value={Number(arModelScale.toFixed(2))}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (Number.isNaN(v)) return;
                          setArModelScale(v);
                        }}
                        style={{ width: 68, padding: '4px', borderRadius: 4, border: '1px solid #555', background: '#111', color: 'white', textAlign: 'right' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
