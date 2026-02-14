'use client';

import { useRef, useState, useEffect, Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Box, Sphere, TransformControls, useTexture } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl, TransformControls as TransformControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { Settings, Lightbulb, Camera, Trash2, Move, RotateCcw, Maximize2 } from 'lucide-react';

import type { ARHotspot } from '@/types/ar';
import { loadGLTF } from '@/lib/model-loader';

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
  modelUrl?: string;
  modelTransform?: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
  };
  hotspots: Hotspot[];
  onHotspotPositionChange?: (id: string, position: { x: number; y: number; z: number }) => void;
  onHotspotScaleChange?: (id: string, scale: { x: number; y: number; z: number }) => void;
  onHotspotRotationChange?: (id: string, rotation: { x: number; y: number; z: number }) => void;
  // Modo ligero: no cargar modelo 3D real, sólo grid + primitivas + hotspots
  lightMode?: boolean;
  primitives?: Primitive[];
  onPrimitivesChange?: (primitives: Primitive[]) => void;
  // Nuevo: callback para guardar posiciones de modelos
  onModelTransformChange?: (transform: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number }; scale: { x: number; y: number; z: number } }) => void;
}

function Model({ url }: { url: string }) {
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    
    // Cargar modelo GLTF/GLB
    loadGLTF(url).then((gltf: any) => {
      try {
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = maxDim > 3 ? 3 / maxDim : 1;

        gltf.scene.scale.setScalar(scale);
        gltf.scene.position.sub(center.multiplyScalar(scale));

        setModel(gltf.scene);
        setLoading(false);
        setError(null);
      } catch (err) {
        console.error('Error procesando glTF:', err);
        setError('Error procesando modelo 3D');
        setLoading(false);
      }
    }).catch((err) => {
      console.error('Error cargando modelo (loadGLTF):', err);
      setError('No se pudo cargar el modelo 3D');
      setLoading(false);
    });
  }, [url]);

  if (loading) {
    return (
      <Text position={[0, 0, 0]} fontSize={0.3} color="#667eea">
        Cargando modelo...
      </Text>
    );
  }

  if (error) {
    return (
      <group>
        <Text position={[0, 0.5, 0]} fontSize={0.3} color="red">
          {error}
        </Text>
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

// Phone-friendly model viewer: centra el modelo en frente de la cámara,
// ajusta escala para que quepa en pantalla y posiciona la base en Y=0.
type PhoneModelProps = {
  url: string;
  modelTransform?: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
  };
};

function PhoneModel({ url, modelTransform }: PhoneModelProps) {
  const [gltf, setGltf] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    let mounted = true;
    loadGLTF(url).then((res: any) => {
      if (!mounted) return;
      const scene = res.scene;

      try {
        // Calcular bounding box y escala de ajuste (similar a Model)
        const box = new THREE.Box3().setFromObject(scene);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const desired = 0.8;
        const fitScale = maxDim > 0 ? desired / maxDim : 1;
        const userScale = modelTransform?.scale?.x ?? 1;
        const finalScale = fitScale * userScale;

        scene.scale.setScalar(finalScale);

        // Recalcular bbox tras escalar
        const box2 = new THREE.Box3().setFromObject(scene);
        const center = box2.getCenter(new THREE.Vector3());

        // Ajustar para centrar en X/Z pero mantener la base en Y=0
        scene.position.x -= center.x;
        scene.position.z -= center.z;

        // Llevar la base del modelo a Y=0
        const minY = box2.min.y * finalScale;
        scene.position.y -= minY;
      } catch (err) {
        // si algo falla en centrar, seguir igualmente con el scene sin ajustes
        console.warn('PhoneModel centering failed', err);
      }

      setGltf(scene);
    }).catch((err) => {
      console.error('PhoneModel loadGLTF error', err);
      setError('No se pudo cargar modelo');
    });
    return () => { mounted = false; };
  }, [url]);

  if (error) return null;
  if (!gltf) return null;

  // Calcular bounding box y escala para la vista móvil
  const box = new THREE.Box3().setFromObject(gltf);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  // Queremos que el mayor lado ocupe ~0.8m en la vista móvil
  const desired = 0.8;
  const fitScale = maxDim > 0 ? desired / maxDim : 1;

  const userScale = modelTransform?.scale?.x ?? 1;
  const finalScale = fitScale * userScale;

  // Posicionar la base del modelo en y=0
  const bboxMin = box.min.clone().multiplyScalar(finalScale);
  const baseOffsetY = bboxMin.y;

  // Posicionar frente de la cámara a -1.0m
  const userPos = modelTransform?.position ?? { x: 0, y: 0, z: 0 };
  const userRot = modelTransform?.rotation ?? { x: 0, y: 0, z: 0 };

  return (
    <group ref={groupRef} position={[userPos.x, -baseOffsetY + userPos.y, -1.0 + userPos.z]} rotation={[userRot.x, userRot.y, userRot.z]} scale={[finalScale, finalScale, finalScale]}>
      <primitive object={gltf} />
    </group>
  );
}

// Billboard 3D para mostrar imagen asociada a un hotspot con perspectiva real
function HotspotImageBillboard({ hotspot }: { hotspot: Hotspot }) {
  // Prefer explicit typed fields (image_url). Support legacy content_url for safety.
  const imageUrl = ('image_url' in hotspot && hotspot.image_url) || ((hotspot as unknown as Record<string, unknown>).content_url as string) || '';
  const texture = imageUrl ? useTexture(imageUrl) : null;

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
          map={texture ? (Array.isArray(texture) ? texture[0] : (texture as THREE.Texture)) : undefined}
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

function Grid() {
  return (
    <>
      {/* Grid principal y ejes básicos */}
      <gridHelper args={[40, 40, '#00ff00', '#004400']} position={[0, 0, 0]} />
      <axesHelper args={[5]} />
    </>
  );
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
  const orbitRef = useRef<OrbitControlsImpl | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const isTransformingRef = useRef(false);
  const isApplyingExternalTransformRef = useRef(false);
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
    } catch (e) {
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
  }, [modelTransform]);

  // Guardar la referencia al callback externo para evitar re-ejecuciones
  // del efecto cuando la identidad del callback cambia en el padre.
  const onModelTransformChangeRef = useRef<typeof onModelTransformChange | null>(onModelTransformChange ?? null);
  useEffect(() => {
    onModelTransformChangeRef.current = onModelTransformChange ?? null;
  }, [onModelTransformChange]);

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
  }, [modelPosition, modelRotation, modelScale]);

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
  const updateSelectedPrimitivePosition = (axis: 'x' | 'y' | 'z', value: number) => {
    if (!selectedPrimitive) return;
    if (!onPrimitivesChange) return;
    const updated = primitives.map((p: Primitive) => 
      p.id === selectedPrimitive
        ? { ...p, position: { ...p.position, [axis]: value } }
        : p
    );
    onPrimitivesChange(updated);
  };

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

  const updateSelectedPrimitiveColor = (color: string) => {
    if (!selectedPrimitive) return;
    if (!onPrimitivesChange) return;
    const updated = primitives.map((p: Primitive) => 
      p.id === selectedPrimitive
        ? { ...p, color }
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
        camera={{ position: [4, 3, 4], fov: 60 }}
        style={{ width: '100%', height: '100%', display: 'block', background: '#000000' }}
        onCreated={(state) => {
          state.gl.setClearColor('#000000', 1);

          // Detectar pérdida de contexto WebGL y mostrar mensaje amigable
          const canvas = state.gl.domElement;
          const onLost = (event: Event) => {
            event.preventDefault();
            console.warn('Contexto WebGL perdido en ARPreview3D');
            setWebglLost(true);
          };
          canvas.addEventListener('webglcontextlost', onLost, { passive: false });

          setCanvasReady(true);
          console.log('Canvas 3D iniciado correctamente');
        }}
        onPointerMissed={clearSelection}
        >
        <OrbitControls 
          ref={orbitRef}
          enableDamping
          dampingFactor={0.05}
          minDistance={2}
          maxDistance={20}
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
        <Grid />

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
                  <Model url={modelUrl} />
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
                <Model url={modelUrl} />
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

        {/* Phone preview overlay (small phone simulator near the canvas) */}
        {showPhonePreview && modelUrl && (
          <div style={{ position: 'absolute', top: 14, right: 14, width: 220, height: 440, zIndex: 40, borderRadius: 18, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ width: '100%', height: '100%', background: '#000' }}>
              <Canvas camera={{ position: [0, 0, 0], fov: 50 }} style={{ width: '100%', height: '100%' }}>
                <ambientLight intensity={0.6} />
                <directionalLight position={[3, 5, 2]} intensity={0.8} />
                <Suspense fallback={null}>
                  <PhoneModel url={modelUrl as string} modelTransform={{ position: modelPosition, rotation: modelRotation, scale: modelScale }} />
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
          <div style={{ fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            🎮 Controles
            <span style={{ fontSize: '0.6rem', padding: '2px 6px', background: canvasReady ? '#00ff00' : '#ff9800', borderRadius: '4px', color: '#000' }}>
              {canvasReady ? '✓' : '...'}
            </span>
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
      </div>

      {/* Panel de Herramientas de Edición debajo del visor */}
      <div style={{
        marginTop: '12px',
        background: '#111',
        color: 'white',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #333'
      }}>
        <button
          onClick={() => setShowTools(!showTools)}
          style={{
            width: '100%',
            padding: '8px',
            background: '#667eea',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '0.85rem',
            fontWeight: 'bold'
          }}
        >
          <Settings size={16} />
          {showTools ? 'Ocultar Herramientas' : 'Mostrar Herramientas'}
        </button>

        {showTools && (
          <div style={{ marginTop: '12px' }}>
            {/* Primitivas */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ 
                fontWeight: 'bold', 
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem'
              }}>
                <Move size={14} />
                Primitivas
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                <button
                  onClick={() => addPrimitive('box')}
                  style={{
                    padding: '6px 10px',
                    background: '#4CAF50',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  Cubo
                </button>
                <button
                  onClick={() => addPrimitive('sphere')}
                  style={{
                    padding: '6px 10px',
                    background: '#4CAF50',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  Esfera
                </button>
                <button
                  onClick={() => addPrimitive('cylinder')}
                  style={{
                    padding: '6px 10px',
                    background: '#4CAF50',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  Cilindro
                </button>
                <button
                  onClick={() => addPrimitive('cone')}
                  style={{
                    padding: '6px 10px',
                    background: '#4CAF50',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  Cono
                </button>
                <button
                  onClick={() => addPrimitive('plane')}
                  style={{
                    padding: '6px 10px',
                    background: '#4CAF50',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  Plano
                </button>
              </div>
              {primitives.length > 0 && (
                <div style={{ fontSize: '0.7rem', marginTop: '6px' }}>
                  {primitives.map((prim: Primitive) => (
                    <div
                      key={prim.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '4px',
                        background: selectedPrimitive === prim.id ? 'rgba(102, 126, 234, 0.3)' : 'transparent',
                        borderRadius: '4px',
                        marginBottom: '2px'
                      }}
                    >
                      <span onClick={() => setSelectedPrimitive(prim.id)} style={{ cursor: 'pointer', flex: 1 }}>
                        {prim.type}
                      </span>
                      <button
                        onClick={() => removePrimitive(prim.id)}
                        style={{
                          background: '#f44336',
                          border: 'none',
                          borderRadius: '3px',
                          color: 'white',
                          cursor: 'pointer',
                          padding: '2px 6px',
                          fontSize: '0.7rem'
                        }}
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Propiedades de la primitiva seleccionada */}
              {selectedPrimitive && (() => {
                const prim = primitives.find((p: Primitive) => p.id === selectedPrimitive);
                if (!prim) return null;
                return (
                  <div style={{
                    marginTop: '10px',
                    paddingTop: '8px',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    fontSize: '0.7rem'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>Objeto seleccionado</div>

                    <div style={{ marginBottom: '6px' }}>
                      <div style={{ opacity: 0.8, marginBottom: '2px' }}>Posición (X, Y, Z)</div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {(['x','y','z'] as const).map(axis => (
                          <input
                            key={axis}
                            type="number"
                            step="0.1"
                            value={prim.position[axis].toFixed(2)}
                            onChange={(e) => updateSelectedPrimitivePosition(axis, parseFloat(e.target.value) || 0)}
                            style={{
                              width: '33%',
                              padding: '3px 4px',
                              borderRadius: '4px',
                              border: '1px solid #555',
                              background: '#111',
                              color: 'white'
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <div style={{ marginBottom: '6px' }}>
                      <div style={{ opacity: 0.8, marginBottom: '2px' }}>Escala (X, Y, Z)</div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {(['x','y','z'] as const).map(axis => (
                          <input
                            key={axis}
                            type="number"
                            step="0.1"
                            min={0.1}
                            value={prim.scale[axis].toFixed(2)}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value) || 0.1;
                              updateSelectedPrimitiveScale(axis, v);
                            }}
                            style={{
                              width: '33%',
                              padding: '3px 4px',
                              borderRadius: '4px',
                              border: '1px solid #555',
                              background: '#111',
                              color: 'white'
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <div style={{ marginBottom: '6px' }}>
                      <div style={{ opacity: 0.8, marginBottom: '2px' }}>Rotación (X, Y, Z)</div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {(['x','y','z'] as const).map(axis => (
                          <input
                            key={axis}
                            type="number"
                            step="0.1"
                            value={prim.rotation[axis].toFixed(2)}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value) || 0;
                              updateSelectedPrimitiveRotation(axis, v);
                            }}
                            style={{
                              width: '33%',
                              padding: '3px 4px',
                              borderRadius: '4px',
                              border: '1px solid #555',
                              background: '#111',
                              color: 'white'
                            }}
                          />
                        ))}
                      </div>
                      <div style={{ fontSize: '0.65rem', opacity: 0.7, marginTop: 2 }}>
                        Valores en radianes (π ≈ 3.14)
                      </div>
                    </div>

                    <div>
                      <div style={{ opacity: 0.8, marginBottom: '2px' }}>Color</div>
                      <input
                        type="color"
                        value={prim.color}
                        onChange={(e) => updateSelectedPrimitiveColor(e.target.value)}
                        style={{
                          width: '100%',
                          height: '24px',
                          padding: 0,
                          borderRadius: '4px',
                          border: '1px solid #555',
                          background: 'transparent',
                          cursor: 'pointer'
                        }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Luces */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ 
                fontWeight: 'bold', 
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem'
              }}>
                <Lightbulb size={14} />
                Luces
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                <button
                  onClick={() => addLight('ambient')}
                  style={{
                    padding: '6px 10px',
                    background: '#2196F3',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  Ambiente
                </button>
                <button
                  onClick={() => addLight('directional')}
                  style={{
                    padding: '6px 10px',
                    background: '#2196F3',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  Direccional
                </button>
                <button
                  onClick={() => addLight('point')}
                  style={{
                    padding: '6px 10px',
                    background: '#2196F3',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  Punto
                </button>
                <button
                  onClick={() => addLight('spot')}
                  style={{
                    padding: '6px 10px',
                    background: '#2196F3',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  Foco
                </button>
              </div>
              {lights.length > 0 && (
                <div style={{ fontSize: '0.7rem', marginTop: '6px' }}>
                  {lights.map((light) => (
                    <div
                      key={light.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '4px',
                        background: 'transparent',
                        borderRadius: '4px',
                        marginBottom: '2px'
                      }}
                    >
                      <span style={{ flex: 1 }}>{light.type}</span>
                      <button
                        onClick={() => removeLight(light.id)}
                        style={{
                          background: '#f44336',
                          border: 'none',
                          borderRadius: '3px',
                          color: 'white',
                          cursor: 'pointer',
                          padding: '2px 6px',
                          fontSize: '0.7rem'
                        }}
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modelo 3D */}
            {!lightMode && modelUrl && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  fontWeight: 'bold',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.85rem'
                }}>
                  Modelo 3D
                </div>
                <div style={{ fontSize: '0.7rem', marginBottom: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="checkbox"
                      checked={modelSelected}
                      onChange={(e) => setModelSelected(e.target.checked)}
                    />
                    Habilitar gizmo para mover el modelo
                  </label>
                </div>

                <div style={{ marginBottom: '6px' }}>
                  <div style={{ opacity: 0.8, marginBottom: '2px' }}>Posición modelo (X, Y, Z)</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {(['x','y','z'] as const).map(axis => (
                      <input
                        key={axis}
                        type="number"
                        step="0.1"
                        value={modelPosition[axis].toFixed(2)}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          setModelPosition(prev => ({ ...prev, [axis]: v }));
                          if (modelGroupRef.current) {
                            if (axis === 'x') modelGroupRef.current.position.x = v;
                            if (axis === 'y') modelGroupRef.current.position.y = v;
                            if (axis === 'z') modelGroupRef.current.position.z = v;
                          }
                        }}
                        style={{
                          width: '33%',
                          padding: '3px 4px',
                          borderRadius: '4px',
                          border: '1px solid #555',
                          background: '#111',
                          color: 'white'
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '6px' }}>
                  <div style={{ opacity: 0.8, marginBottom: '2px' }}>Escala modelo (X, Y, Z)</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {(['x','y','z'] as const).map(axis => (
                      <input
                        key={axis}
                        type="number"
                        step="0.1"
                        min={0.1}
                        value={modelScale[axis].toFixed(2)}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0.1;
                          setModelScale(prev => ({ ...prev, [axis]: v }));
                          if (modelGroupRef.current) {
                            if (axis === 'x') modelGroupRef.current.scale.x = v;
                            if (axis === 'y') modelGroupRef.current.scale.y = v;
                            if (axis === 'z') modelGroupRef.current.scale.z = v;
                          }
                        }}
                        style={{
                          width: '33%',
                          padding: '3px 4px',
                          borderRadius: '4px',
                          border: '1px solid #555',
                          background: '#111',
                          color: 'white'
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '6px' }}>
                  <div style={{ opacity: 0.8, marginBottom: '2px' }}>Rotación modelo (X, Y, Z)</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {(['x','y','z'] as const).map(axis => (
                      <input
                        key={axis}
                        type="number"
                        step="0.1"
                        value={modelRotation[axis].toFixed(2)}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          setModelRotation(prev => ({ ...prev, [axis]: v }));
                          if (modelGroupRef.current) {
                            if (axis === 'x') modelGroupRef.current.rotation.x = v;
                            if (axis === 'y') modelGroupRef.current.rotation.y = v;
                            if (axis === 'z') modelGroupRef.current.rotation.z = v;
                          }
                        }}
                        style={{
                          width: '33%',
                          padding: '3px 4px',
                          borderRadius: '4px',
                          border: '1px solid #555',
                          background: '#111',
                          color: 'white'
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ fontSize: '0.65rem', opacity: 0.7, marginTop: 2 }}>
                    Valores en radianes (π ≈ 3.14)
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setModelPosition({ x: 0, y: 0, z: 0 });
                    if (modelGroupRef.current) {
                      modelGroupRef.current.position.set(0, 0, 0);
                    }
                  }}
                  style={{
                    marginTop: '4px',
                    padding: '4px 8px',
                    background: '#374151',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.7rem'
                  }}
                >
                  Resetear al centro
                </button>
              </div>
            )}

            {/* Hotspots */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{
                fontWeight: 'bold',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem'
              }}>
                Hotspots
              </div>

              {hotspots.length === 0 ? (
                <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                  Aún no hay hotspots configurados.
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '0.7rem', marginTop: '6px' }}>
                    {hotspots.map((hotspot) => (
                      <div
                        key={hotspot.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '4px',
                          background: selectedHotspot === hotspot.id ? 'rgba(102, 126, 234, 0.3)' : 'transparent',
                          borderRadius: '4px',
                          marginBottom: '2px'
                        }}
                      >
                        <span
                          onClick={() => setSelectedHotspot(hotspot.id)}
                          style={{ cursor: 'pointer', flex: 1 }}
                        >
                          {('title' in hotspot && hotspot.title) ? hotspot.title : '(sin título)'}
                        </span>
                        <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>
                          {hotspot.type}
                        </span>
                      </div>
                    ))}
                  </div>

                  {selectedHotspot && (() => {
                    const hs = hotspots.find(h => h.id === selectedHotspot);
                    if (!hs) return null;

                    return (
                      <div style={{
                        marginTop: '10px',
                        paddingTop: '8px',
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                        fontSize: '0.7rem'
                      }}>
                        {/* Controles de Posición */}
                        <div style={{ opacity: 0.8, marginBottom: '2px' }}>Posición Hotspot (X, Y, Z)</div>
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                          {(() => {
                            const posObj = Array.isArray(hs.position)
                              ? { x: hs.position[0] ?? 0, y: hs.position[1] ?? 0, z: hs.position[2] ?? 0 }
                              : (hs.position as { x: number; y: number; z: number });

                            return (['x','y','z'] as const).map(axis => (
                              <input
                                key={axis}
                                type="number"
                                step="0.1"
                                value={posObj[axis].toFixed(2)}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value) || 0;
                                  if (!onHotspotPositionChange) return;
                                  const newPos = { ...posObj, [axis]: v };
                                  onHotspotPositionChange(hs.id, newPos);
                                }}
                                style={{
                                  width: '33%',
                                  padding: '3px 4px',
                                  borderRadius: '4px',
                                  border: '1px solid #555',
                                  background: '#111',
                                  color: 'white'
                                }}
                              />
                            ));
                          })()}
                        </div>

                        {/* Controles de Escala */}
                        {hs.scale && (
                          <>
                            <div style={{ opacity: 0.8, marginBottom: '2px' }}>Escala Hotspot (X, Y, Z)</div>
                            <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                              {(() => {
                                const sclObj = Array.isArray(hs.scale)
                                  ? { x: hs.scale[0] ?? 1, y: hs.scale[1] ?? 1, z: hs.scale[2] ?? 1 }
                                  : hs.scale as { x: number; y: number; z: number };

                                return (['x','y','z'] as const).map(axis => (
                                  <input
                                    key={axis}
                                    type="number"
                                    step="0.1"
                                    min="0.1"
                                    value={sclObj[axis].toFixed(2)}
                                    onChange={(e) => {
                                      const v = parseFloat(e.target.value) || 0.1;
                                      if (!onHotspotScaleChange) return;
                                      const newScl = { ...sclObj, [axis]: v };
                                      onHotspotScaleChange(hs.id, newScl);
                                    }}
                                    style={{
                                      width: '33%',
                                      padding: '3px 4px',
                                      borderRadius: '4px',
                                      border: '1px solid #555',
                                      background: '#111',
                                      color: 'white'
                                    }}
                                  />
                                ));
                              })()}
                            </div>
                          </>
                        )}

                        {/* Controles de Rotación */}
                        {hs.rotation && (
                          <>
                            <div style={{ opacity: 0.8, marginBottom: '2px' }}>Rotación Hotspot (X, Y, Z) [grados]</div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {(() => {
                                const rotObj = Array.isArray(hs.rotation)
                                  ? { x: hs.rotation[0] ?? 0, y: hs.rotation[1] ?? 0, z: hs.rotation[2] ?? 0 }
                                  : hs.rotation as { x: number; y: number; z: number };

                                return (['x','y','z'] as const).map(axis => 
                                  <input
                                    key={axis}
                                    type="number"
                                    step="5"
                                    value={((rotObj[axis] * 180) / Math.PI).toFixed(1)}
                                    onChange={(e) => {
                                      const degrees = parseFloat(e.target.value) || 0;
                                      const radians = (degrees * Math.PI) / 180;
                                      if (!onHotspotRotationChange) return;
                                      const newRotation = { ...rotObj, [axis]: radians };
                                      onHotspotRotationChange(hs.id, newRotation);
                                    }}
                                    style={{
                                      width: '33%',
                                      padding: '3px 4px',
                                      borderRadius: '4px',
                                      border: '1px solid #555',
                                      background: '#111',
                                      color: 'white'
                                    }}
                                  />
                                );
                              })()}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            {/* Cámara Presets */}
            <div>
              <div style={{ 
                fontWeight: 'bold', 
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Camera size={14} />
                  Vista de Cámara
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => setShowLightControls(!showLightControls)}
                    style={{
                      padding: '4px 8px',
                      background: showLightControls ? '#4CAF50' : '#607D8B',
                      border: 'none',
                      borderRadius: '4px',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '0.65rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px'
                    }}
                  >
                    <Lightbulb size={10} />
                    Luces
                  </button>
                  <button
                    onClick={() => setShowAdvancedControls(!showAdvancedControls)}
                    style={{
                      padding: '4px 8px',
                      background: showAdvancedControls ? '#4CAF50' : '#607D8B', 
                      border: 'none',
                      borderRadius: '4px',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '0.65rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px'
                    }}
                  >
                    <Settings size={10} />
                    Avanzado
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                <button
                  style={{
                    padding: '4px 8px',
                    background: '#FF9800',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.7rem'
                  }}
                >
                  Frontal
                </button>
                <button
                  style={{
                    padding: '4px 8px',
                    background: '#FF9800',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.7rem'
                  }}
                >
                  Trasera
                </button>
                <button
                  style={{
                    padding: '4px 8px',
                    background: '#FF9800',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.7rem'
                  }}
                >
                  Superior
                </button>
                <button
                  style={{
                    padding: '4px 8px',
                    background: '#FF9800',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.7rem'
                  }}
                >
                  Isométrica
                </button>
              </div>
            </div>

            {/* Panel de Controles de Luces */}
            {showLightControls && (
              <div style={{ 
                marginTop: '12px',
                padding: '12px',
                background: '#0a0a0a',
                borderRadius: '6px',
                border: '1px solid #444'
              }}>
                <div style={{ 
                  fontWeight: 'bold', 
                  marginBottom: '8px',
                  fontSize: '0.8rem',
                  color: '#FFC107'
                }}>
                  ⚡ Sistema de Iluminación
                </div>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  <button
                    onClick={() => {
                      const newLight: Light = {
                        id: `light-${Date.now()}`,
                        type: 'ambient',
                        position: { x: 0, y: 0, z: 0 },
                        intensity: 0.5,
                        color: '#ffffff'
                      };
                      setLights([...lights, newLight]);
                    }}
                    style={{
                      padding: '4px 8px',
                      background: '#673AB7',
                      border: 'none',
                      borderRadius: '4px',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '0.65rem'
                    }}
                  >
                    + Ambiental
                  </button>
                  <button
                    onClick={() => {
                      const newLight: Light = {
                        id: `light-${Date.now()}`,
                        type: 'directional',
                        position: { x: 5, y: 10, z: 5 },
                        intensity: 1.0,
                        color: '#ffffff'
                      };
                      setLights([...lights, newLight]);
                    }}
                    style={{
                      padding: '4px 8px',
                      background: '#FF5722',
                      border: 'none',
                      borderRadius: '4px',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '0.65rem'
                    }}
                  >
                    + Direccional
                  </button>
                  <button
                    onClick={() => {
                      const newLight: Light = {
                        id: `light-${Date.now()}`,
                        type: 'point',
                        position: { x: 0, y: 5, z: 0 },
                        intensity: 1.2,
                        color: '#ffffff'
                      };
                      setLights([...lights, newLight]);
                    }}
                    style={{
                      padding: '4px 8px',
                      background: '#009688',
                      border: 'none',
                      borderRadius: '4px',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '0.65rem'
                    }}
                  >
                    + Punto
                  </button>
                </div>

                {lights.length > 0 && (
                  <div style={{ fontSize: '0.65rem', maxHeight: '120px', overflowY: 'auto' }}>
                    {lights.map((light, index) => (
                      <div 
                        key={light.id}
                        style={{ 
                          padding: '4px',
                          marginBottom: '4px',
                          background: 'rgba(255,255,255,0.05)',
                          borderRadius: '3px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: '60px' }}>
                          {light.type.charAt(0).toUpperCase() + light.type.slice(1)}
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="3"
                          step="0.1"
                          value={light.intensity}
                          onChange={(e) => {
                            const newLights = [...lights];
                            newLights[index].intensity = parseFloat(e.target.value);
                            setLights(newLights);
                          }}
                          style={{ width: '40px' }}
                        />
                        <input
                          type="color"
                          value={light.color}
                          onChange={(e) => {
                            const newLights = [...lights];
                            newLights[index].color = e.target.value;
                            setLights(newLights);
                          }}
                          style={{ width: '20px', height: '16px', border: 'none' }}
                        />
                        <button
                          onClick={() => {
                            setLights(lights.filter(l => l.id !== light.id));
                          }}
                          style={{
                            padding: '2px 4px',
                            background: '#f44336',
                            border: 'none',
                            borderRadius: '2px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '0.6rem'
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Panel de Controles Avanzados */}
            {showAdvancedControls && (
              <div style={{ 
                marginTop: '12px',
                padding: '12px',
                background: '#0a0a0a',
                borderRadius: '6px',
                border: '1px solid #444'
              }}>
                <div style={{ 
                  fontWeight: 'bold', 
                  marginBottom: '8px',
                  fontSize: '0.8rem',
                  color: '#00BCD4'
                }}>
                  🔧 Controles Avanzados
                </div>
                
                <div style={{ fontSize: '0.65rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <button
                    onClick={() => {
                      // Reset de la cámara a posición inicial
                      if (orbitRef.current) {
                        orbitRef.current.reset();
                      }
                    }}
                    style={{
                      padding: '6px 12px',
                      background: '#FF9800',
                      border: 'none',
                      borderRadius: '4px',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '0.7rem'
                    }}
                  >
                    🎥 Resetear Cámara
                  </button>
                  
                  <button
                    onClick={() => {
                      if (confirm('¿Estás seguro de que quieres resetear la posición, rotación y escala del modelo?')) {
                        // Reset de todas las posiciones de modelo
                        setModelPosition({ x: 0, y: 0, z: 0 });
                        setModelRotation({ x: 0, y: 0, z: 0 });
                        setModelScale({ x: 1, y: 1, z: 1 });
                      }
                    }}
                    style={{
                      padding: '6px 12px',
                      background: '#E91E63',
                      border: 'none',
                      borderRadius: '4px',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '0.7rem'
                    }}
                  >
                    📦 Resetear Modelo
                  </button>
                  
                  <button
                    onClick={() => {
                      setLights([]);
                    }}
                    style={{
                      padding: '6px 12px',
                      background: '#9C27B0',
                      border: 'none',
                      borderRadius: '4px',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '0.7rem'
                    }}
                  >
                    💡 Limpiar Luces
                  </button>
                  
                  <div style={{ 
                    marginTop: '8px', 
                    paddingTop: '8px', 
                    borderTop: '1px solid #333',
                    opacity: 0.7 
                  }}>
                    <div>Canvas: {(showAdvancedControls || showLightControls) ? '350px' : '500px'}</div>
                    <div>WebGL: {webglLost ? 'Perdido' : 'Activo'}</div>
                    <div>Modelo: {modelUrl ? 'Cargado' : 'Sin modelo'}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
