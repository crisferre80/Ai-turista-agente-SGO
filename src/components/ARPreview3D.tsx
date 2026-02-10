'use client';

import { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Box, Sphere, TransformControls, useTexture } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { Settings, Lightbulb, Camera, Trash2, Move } from 'lucide-react';

interface Hotspot {
  id: string;
  position: { x: number; y: number; z: number };
  title: string;
  description: string;
  type: 'info' | 'image' | 'video';
  content_url?: string;
}

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
  hotspots: Hotspot[];
  onHotspotPositionChange?: (id: string, position: { x: number; y: number; z: number }) => void;
  // Modo ligero: no cargar modelo 3D real, sólo grid + primitivas + hotspots
  lightMode?: boolean;
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
    import('three/examples/jsm/loaders/GLTFLoader.js').then(({ GLTFLoader }) => {
      const gltfLoader = new GLTFLoader();
      gltfLoader.load(
        url,
        (gltf) => {
          // Centrar y escalar el modelo
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          
          // Escalar si es muy grande
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = maxDim > 3 ? 3 / maxDim : 1;
          
          gltf.scene.scale.setScalar(scale);
          gltf.scene.position.sub(center.multiplyScalar(scale));
          
          setModel(gltf.scene);
          setLoading(false);
          setError(null);
        },
        (progress) => {
          console.log('Cargando modelo:', (progress.loaded / progress.total * 100).toFixed(0) + '%');
        },
        (err) => {
          console.error('Error cargando modelo:', err);
          setError('No se pudo cargar el modelo 3D');
          setLoading(false);
        }
      );
    }).catch(() => {
      setError('Error al inicializar el cargador');
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
  onSelect 
}: { 
  hotspot: Hotspot; 
  isSelected: boolean;
  onSelect: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Color según tipo
  const color = 
    hotspot.type === 'info' ? '#4CAF50' :
    hotspot.type === 'image' ? '#2196F3' :
    '#FF9800';

  return (
    <group position={[hotspot.position.x, hotspot.position.y, hotspot.position.z]}>
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
        {hotspot.title}
      </Text>

      {/* Línea hacia abajo */}
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.3, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

// Billboard 3D para mostrar imagen asociada a un hotspot con perspectiva real
function HotspotImageBillboard({ hotspot }: { hotspot: Hotspot }) {
  const texture = useTexture(hotspot.content_url || '');

  // Elevamos un poco el contenido sobre el marcador
  const yOffset = 0.8;

  return (
    <group position={[hotspot.position.x, hotspot.position.y + yOffset, hotspot.position.z]}>
      {/* Fondo ligeramente más grande para hacer de marco */}
      <mesh position={[0, 0, -0.001]}>
        <planeGeometry args={[1.7, 0.9]} />
        <meshBasicMaterial color="black" opacity={0.7} transparent />
      </mesh>
      <mesh>
        <planeGeometry args={[1.6, 0.8]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
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
        {hotspot.title}
      </Text>
    </group>
  );
}

// Billboard 3D simple para vídeos (placeholder)
function HotspotVideoBillboard({ hotspot }: { hotspot: Hotspot }) {
  const yOffset = 0.8;

  return (
    <group position={[hotspot.position.x, hotspot.position.y + yOffset, hotspot.position.z]}>
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
        {hotspot.title}
      </Text>
    </group>
  );
}

// Selector de billboard según tipo de hotspot
function HotspotMediaBillboard({ hotspot }: { hotspot: Hotspot }) {
  if (!hotspot.content_url) return null;

  if (hotspot.type === 'image') {
    return <HotspotImageBillboard hotspot={hotspot} />;
  }

  if (hotspot.type === 'video') {
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
  onClick 
}: { 
  primitive: Primitive; 
  isSelected: boolean;
  onClick: () => void;
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
  hotspots, 
  onHotspotPositionChange,
  lightMode = false
}: ARPreview3DProps) {
  const [selectedHotspot, setSelectedHotspot] = useState<string | null>(null);
  const [primitives, setPrimitives] = useState<Primitive[]>([]);
  const [lights, setLights] = useState<Light[]>([]);
  const [selectedPrimitive, setSelectedPrimitive] = useState<string | null>(null);
  const [modelSelected, setModelSelected] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [webglLost, setWebglLost] = useState(false);
  const orbitRef = useRef<OrbitControlsImpl | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
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

  const clearSelection = () => {
    setSelectedPrimitive(null);
    setSelectedHotspot(null);
    setModelSelected(false);
  };

  // Funciones para manejar primitivas
  const addPrimitive = (type: Primitive['type']) => {
    const newPrimitive: Primitive = {
      id: `primitive-${Date.now()}`,
      type,
      position: { x: 0, y: 1, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      color: '#667eea'
    };
    setPrimitives([...primitives, newPrimitive]);
  };

  const removePrimitive = (id: string) => {
    setPrimitives(primitives.filter(p => p.id !== id));
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
    setPrimitives(prev => prev.map(p => 
      p.id === selectedPrimitive
        ? { ...p, position: { ...p.position, [axis]: value } }
        : p
    ));
  };

  const updateSelectedPrimitiveScale = (axis: 'x' | 'y' | 'z', value: number) => {
    if (!selectedPrimitive) return;
    setPrimitives(prev => prev.map(p => 
      p.id === selectedPrimitive
        ? { ...p, scale: { ...p.scale, [axis]: value } }
        : p
    ));
  };

  const updateSelectedPrimitiveRotation = (axis: 'x' | 'y' | 'z', value: number) => {
    if (!selectedPrimitive) return;
    setPrimitives(prev => prev.map(p => 
      p.id === selectedPrimitive
        ? { ...p, rotation: { ...p.rotation, [axis]: value } }
        : p
    ));
  };

  const updateSelectedPrimitiveColor = (color: string) => {
    if (!selectedPrimitive) return;
    setPrimitives(prev => prev.map(p => 
      p.id === selectedPrimitive
        ? { ...p, color }
        : p
    ));
  };

  const updatePrimitivePosition = (id: string, position: { x: number; y: number; z: number }) => {
    setPrimitives(prev => prev.map(p => 
      p.id === id
        ? { ...p, position }
        : p
    ));
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Contenedor del visor 3D */}
      <div style={{ 
        width: '100%', 
        height: '500px', 
        background: '#1a1a1a',
        borderRadius: '10px',
        overflow: 'hidden',
        position: 'relative',
        border: '1px solid #333'
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
                mode="translate"
                size={1.3}
                space="world"
                onMouseDown={() => {
                  if (orbitRef.current) {
                    orbitRef.current.enabled = false;
                  }
                }}
                onMouseUp={() => {
                  if (orbitRef.current) {
                    orbitRef.current.enabled = true;
                  }
                }}
                onObjectChange={(event) => {
                  const target = (event as unknown as { target?: { object?: THREE.Object3D } }).target;
                  const obj = target?.object;
                  if (!obj) return;
                  const { x, y, z } = obj.position;
                  setModelPosition({ x, y, z });
                  setModelRotation({
                    x: obj.rotation.x,
                    y: obj.rotation.y,
                    z: obj.rotation.z,
                  });
                  setModelScale({
                    x: obj.scale.x,
                    y: obj.scale.y,
                    z: obj.scale.z,
                  });
                }}
              >
                <group
                  ref={modelGroupRef}
                  onClick={(e) => {
                    e.stopPropagation();
                    setModelSelected(true);
                  }}
                >
                  <Model url={modelUrl} />
                </group>
              </TransformControls>
            ) : (
              <group
                ref={modelGroupRef}
                onClick={(e) => {
                  e.stopPropagation();
                  setModelSelected(true);
                }}
              >
                <Model url={modelUrl} />
              </group>
            )}
          </Suspense>
        )}

        {/* Primitivas personalizadas con gizmo para la seleccionada */}
        {primitives.map((primitive) => {
          const isSelected = selectedPrimitive === primitive.id;

          if (isSelected) {
            return (
              <TransformControls
                key={primitive.id}
                mode="translate"
                size={1.2}
                onMouseDown={() => {
                  if (orbitRef.current) {
                    orbitRef.current.enabled = false;
                  }
                }}
                onMouseUp={() => {
                  if (orbitRef.current) {
                    orbitRef.current.enabled = true;
                  }
                }}
                onObjectChange={(event) => {
                  const target = (event as unknown as { target?: { object?: THREE.Object3D } }).target;
                  const obj = target?.object;
                  if (!obj) return;
                  const { x, y, z } = obj.position;
                  updatePrimitivePosition(primitive.id, { x, y, z });
                }}
              >
                <PrimitiveObject
                  primitive={primitive}
                  isSelected
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
                key={hotspot.id}
                mode="translate"
                size={1.0}
                onMouseDown={() => {
                  if (orbitRef.current) {
                    orbitRef.current.enabled = false;
                  }
                }}
                onMouseUp={() => {
                  if (orbitRef.current) {
                    orbitRef.current.enabled = true;
                  }
                }}
                onObjectChange={(event) => {
                  const target = (event as unknown as { target?: { object?: THREE.Object3D } }).target;
                  const obj = target?.object;
                  if (!obj) return;
                  const { x, y, z } = obj.position;
                  onHotspotPositionChange(hotspot.id, { x, y, z });
                }}
              >
                <HotspotMarker
                  hotspot={hotspot}
                  isSelected
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
              return (
                <>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    {hotspot.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', marginBottom: '6px', opacity: 0.8 }}>
                    {hotspot.description}
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
                    <span>X: {hotspot.position.x.toFixed(2)}</span>
                    <span>Y: {hotspot.position.y.toFixed(2)}</span>
                    <span>Z: {hotspot.position.z.toFixed(2)}</span>
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
                  {primitives.map((prim) => (
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
                const prim = primitives.find(p => p.id === selectedPrimitive);
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
                            step="1"
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
                            step="0.5"
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
                        step="1"
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
                          {hotspot.title || '(sin título)'}
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
                        <div style={{ opacity: 0.8, marginBottom: '2px' }}>Posición Hotspot (X, Y, Z)</div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {(['x','y','z'] as const).map(axis => (
                              <input
                              key={axis}
                              type="number"
                                step="1"
                              value={hs.position[axis].toFixed(2)}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value) || 0;
                                if (!onHotspotPositionChange) return;
                                const newPos = { ...hs.position, [axis]: v };
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
                          ))}
                        </div>
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
                fontSize: '0.85rem'
              }}>
                <Camera size={14} />
                Vista de Cámara
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
          </div>
        )}
      </div>
    </div>
  );
}
