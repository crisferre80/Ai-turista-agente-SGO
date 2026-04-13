"use client";

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { supabase } from '@/lib/supabase';
import { normalizeARData, canonicalizeARDataForSave } from '@/lib/ar-utils';
import { loadARModelFromScene, saveARModelToScene } from '@/lib/ar-scene-persistence';
import type { ARHotspot, ARHotspotType } from '@/types/ar';
import { Upload, Plus, Trash2, Image as ImageIcon, Box, ArrowUp, ArrowDown, Maximize2, Minimize2 } from 'lucide-react';
import * as THREE from 'three';
import ARScene from '@/components/ARPageClient/ARScene';

// Componente de vista previa del modelo 3D
function ModelPreview({ url }: { url?: string }) {
  if (!url) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#666',
        fontSize: '0.8rem'
      }}>
        Selecciona un modelo para ver la vista previa
      </div>
    );
  }

  return (
    <Canvas style={{ width: '100%', height: '100%' }}>
      <PerspectiveCamera makeDefault position={[0, 0, 2]} fov={50} />
      <OrbitControls 
        enablePan={false} 
        enableZoom={true} 
        enableRotate={true}
        minDistance={1}
        maxDistance={5}
      />
      
      {/* Iluminación básica */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      
      {/* Modelo con Suspense */}
      <Suspense fallback={
        <mesh>
          <boxGeometry args={[0.3, 0.3, 0.3]} />
          <meshStandardMaterial color="#cccccc" />
        </mesh>
      }>
        <Model url={url} />
      </Suspense>
    </Canvas>
  );
}

// Componente simple del modelo para vista previa
function Model({ url }: { url: string }) {
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) return;

    const loadModel = async () => {
      try {
        const { loadGLTF } = await import('@/lib/model-loader');
        const gltf = await loadGLTF(url);
        
        // Centrar y escalar el modelo
        const scene = gltf.scene;
        const box = new (await import('three')).Box3().setFromObject(scene);
        const center = box.getCenter(new (await import('three')).Vector3());
        const size = box.getSize(new (await import('three')).Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = maxDim > 0 ? 1 / maxDim : 1;
        
        scene.position.sub(center);
        scene.scale.setScalar(scale);
        
        setModel(scene);
        setError(false);
      } catch (err) {
        console.error('Error loading model preview:', err);
        setError(true);
      }
    };

    loadModel();
  }, [url]);

  if (error) {
    return (
      <mesh>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#ff6b6b" />
      </mesh>
    );
  }

  if (!model) {
    return (
      <mesh>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>
    );
  }

  return <primitive object={model} />;
}

// Importar vista previa AR dinámicamente
const ARPreview3D = dynamic(() => import('@/components/ARPreview3D'), { ssr: false });

interface Attraction {
  id: string;
  name: string;
  description?: string;
  lat: number;
  lng: number;
  image_url?: string;
  category?: string;
  has_ar_content?: boolean;
  ar_model_url?: string;
  ar_hotspots?: { hotspots: ARHotspot[] };
  qr_code?: string;
}

interface Hotspot {
  id: string;
  type: ARHotspotType;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
  title?: string;
  description?: string;
  content_url?: string; // para imagen/video/audio/3d
}

interface Primitive {
  id: string;
  type: 'box' | 'sphere' | 'cylinder' | 'cone' | 'plane';
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  color: string;
}

export default function ARConfigPage() {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [selectedAttraction, setSelectedAttraction] = useState<Attraction | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingModel, setUploadingModel] = useState(false);
  
  // Estados del formulario AR
  const [arEnabled, setArEnabled] = useState(false);
  const [modelFileName, setModelFileName] = useState('');
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [primitives, setPrimitives] = useState<Primitive[]>([]);
  const [lightMode, setLightMode] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [generatingQr, setGeneratingQr] = useState(false);
  
  // Estado para transformaciones del modelo 3D
  const [modelTransform, setModelTransform] = useState<{
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
  }>({
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  });

  // Calibración de la vista móvil (persistible)
  const [phonePreview, setPhonePreview] = useState<{ cameraDistance: number; yOffset: number; previewScale: number }>({ cameraDistance: 1.0, yOffset: 0, previewScale: 1.0 });

  // Estado para ordenamiento personalizado de paneles
  const [panelOrder, setPanelOrder] = useState<string[]>(['config', 'hotspots', 'canvas', 'mobile']);

  // Estado para tamaños de paneles (1-4 columnas)
  const [panelSizes, setPanelSizes] = useState<Record<string, number>>({
    config: 1,
    hotspots: 1,
    canvas: 2,
    mobile: 1
  });

  // Estado para layout preset
  const [layoutPreset, setLayoutPreset] = useState<string>('auto');

  // Lista de modelos disponibles en el bucket
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // Refs para garantizar que el guardado usa el último transform/primitives inmediatamente
  const latestModelTransformRef = React.useRef(modelTransform);
  const latestPrimitivesRef = React.useRef<Primitive[]>([]);
  const phonePreviewRef = React.useRef(phonePreview);

  // Memorizar la función de callback para evitar recrearla en cada render
  const handlePhonePreviewChange = useCallback((p: { cameraDistance: number; yOffset: number; previewScale: number }) => {
    const eps = 1e-6;
    const prev = phonePreviewRef.current;
    // Solo actualizar si hay cambio real
    if (Math.abs(prev.cameraDistance - p.cameraDistance) > eps ||
        Math.abs(prev.yOffset - p.yOffset) > eps ||
        Math.abs(prev.previewScale - p.previewScale) > eps) {
      setPhonePreview(p);
      phonePreviewRef.current = p;
    }
  }, []);

  // Mantener refs sincronizadas con el estado actual para que el guardado use valores recientes
  useEffect(() => {
    latestModelTransformRef.current = modelTransform;
  }, [modelTransform]);

  useEffect(() => {
    latestPrimitivesRef.current = primitives;
  }, [primitives]);

  useEffect(() => {
    loadAttractions();
  }, []);

  // Detectar mobile para cambiar comportamiento de la caja de herramientas
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);

    type MQWithListeners = MediaQueryList & {
      addEventListener?: (type: 'change', listener: (e: MediaQueryListEvent) => void) => void;
      removeEventListener?: (type: 'change', listener: (e: MediaQueryListEvent) => void) => void;
      addListener?: (listener: (e: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (e: MediaQueryListEvent) => void) => void;
    };

    const mqTyped = mq as MQWithListeners;

    if (typeof mqTyped.addEventListener === 'function') {
      mqTyped.addEventListener('change', handler);
      return () => { mqTyped.removeEventListener?.('change', handler); };
    }

    if (typeof mqTyped.addListener === 'function') {
      mqTyped.addListener(handler);
      return () => { mqTyped.removeListener?.(handler); };
    }

    return undefined;
  }, []);

  // Cargar orden de paneles guardado desde localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ar-config-panel-order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 4) {
          setPanelOrder(parsed);
        }
      }
      
      // Cargar tamaños guardados
      const savedSizes = localStorage.getItem('ar-config-panel-sizes');
      if (savedSizes) {
        const parsed = JSON.parse(savedSizes);
        setPanelSizes(parsed);
      }
      
      // Cargar preset guardado
      const savedPreset = localStorage.getItem('ar-config-layout-preset');
      if (savedPreset) {
        setLayoutPreset(savedPreset);
      }
    } catch (error) {
      console.error('Error cargando configuración de paneles:', error);
    }
  }, []);

  // Guardar orden de paneles en localStorage cuando cambie
  useEffect(() => {
    try {
      localStorage.setItem('ar-config-panel-order', JSON.stringify(panelOrder));
    } catch (error) {
      console.error('Error guardando orden de paneles:', error);
    }
  }, [panelOrder]);

  // Guardar tamaños de paneles
  useEffect(() => {
    try {
      localStorage.setItem('ar-config-panel-sizes', JSON.stringify(panelSizes));
    } catch (error) {
      console.error('Error guardando tamaños de paneles:', error);
    }
  }, [panelSizes]);

  // Guardar preset de layout
  useEffect(() => {
    try {
      localStorage.setItem('ar-config-layout-preset', layoutPreset);
    } catch (error) {
      console.error('Error guardando preset de layout:', error);
    }
  }, [layoutPreset]);

  // Función para mover un panel arriba en el orden
  const movePanelUp = (panelId: string) => {
    const index = panelOrder.indexOf(panelId);
    if (index > 0) {
      const newOrder = [...panelOrder];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      setPanelOrder(newOrder);
    }
  };

  // Función para mover un panel abajo en el orden
  const movePanelDown = (panelId: string) => {
    const index = panelOrder.indexOf(panelId);
    if (index < panelOrder.length - 1) {
      const newOrder = [...panelOrder];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      setPanelOrder(newOrder);
    }
  };

  // Función para cambiar tamaño de panel (1-4 columnas)
  const changePanelSize = (panelId: string, delta: number) => {
    setPanelSizes(prev => {
      const current = prev[panelId] || 1;
      const newSize = Math.max(1, Math.min(4, current + delta));
      return { ...prev, [panelId]: newSize };
    });
  };

  // Aplicar preset de layout
  const applyLayoutPreset = (preset: string) => {
    setLayoutPreset(preset);
    
    switch (preset) {
      case 'large-top':
        // 1 grande arriba + 3 pequeños abajo
        setPanelSizes({
          canvas: 4,
          config: 1,
          hotspots: 1,
          mobile: 2
        });
        setPanelOrder(['canvas', 'config', 'hotspots', 'mobile']);
        break;
        
      case 'large-left':
        // 1 grande izquierda + 3 a la derecha
        setPanelSizes({
          canvas: 2,
          config: 1,
          hotspots: 1,
          mobile: 2
        });
        setPanelOrder(['canvas', 'mobile', 'config', 'hotspots']);
        break;
        
      case 'two-large':
        // 2 grandes arriba + 2 pequeños abajo
        setPanelSizes({
          canvas: 2,
          mobile: 2,
          config: 1,
          hotspots: 1
        });
        setPanelOrder(['canvas', 'mobile', 'config', 'hotspots']);
        break;
        
      case 'equal':
        // Todos iguales 2x2
        setPanelSizes({
          config: 1,
          hotspots: 1,
          canvas: 1,
          mobile: 1
        });
        setPanelOrder(['config', 'hotspots', 'canvas', 'mobile']);
        break;
        
      default:
        // Auto - mantener configuración actual
        break;
    }
  };

  // Cargar lista de modelos disponibles del bucket
  useEffect(() => {
    const loadAvailableModels = async () => {
      try {
        const { data, error } = await supabase.storage.from('ar-content').list('ar-models', {
          limit: 100,
          offset: 0
        });
        
        if (error) {
          console.error('Error loading models:', error);
          return;
        }
        
        // Filtrar solo archivos .glb y .gltf
        const modelFiles = data
          ?.filter(file => file.name.endsWith('.glb') || file.name.endsWith('.gltf'))
          ?.map(file => file.name) || [];
        
        setAvailableModels(modelFiles);
      } catch (error) {
        console.error('Error loading available models:', error);
      }
    };
    
    loadAvailableModels();
  }, []);

  useEffect(() => {
    if (selectedAttraction) {
      setArEnabled(selectedAttraction.has_ar_content || false);
      setModelFileName(selectedAttraction.ar_model_url ? selectedAttraction.ar_model_url.split('/').pop() || '' : '');
      setQrCode(selectedAttraction.qr_code || `AR_${selectedAttraction.id}`);
      
      // Normalizar formatos legacy/array/object y garantizar campos
      const arDataRaw = selectedAttraction.ar_hotspots;
      const arData = normalizeARData(arDataRaw);
      const savedHotspots = arData.hotspots || [];
      const savedPrimitives = (arData.primitives || []).map(p => ({
        ...p,
        position: { x: Number(p.position.x), y: Number(p.position.y), z: Number(p.position.z) },
        rotation: { x: Number(p.rotation.x), y: Number(p.rotation.y), z: Number(p.rotation.z) },
        scale: { x: Number(p.scale.x), y: Number(p.scale.y), z: Number(p.scale.z) },
        color: p.color || '#667eea'
      }));
      const savedModelTransform = arData.modelTransform;

      // Asegurar que el estado local usa el formato {x,y,z}
      const hotspotsForState = savedHotspots.map((h) => ({
        id: h.id,
        type: h.type,
        position: Array.isArray(h.position) ? { x: h.position[0] ?? 0, y: h.position[1] ?? 0, z: h.position[2] ?? 0 } : h.position,
        rotation: h.rotation ? (Array.isArray(h.rotation) ? { x: h.rotation[0] ?? 0, y: h.rotation[1] ?? 0, z: h.rotation[2] ?? 0 } : h.rotation) : undefined,
        scale: h.scale ? (Array.isArray(h.scale) ? { x: h.scale[0] ?? 1, y: h.scale[1] ?? 1, z: h.scale[2] ?? 1 } : h.scale) : undefined,
        title: 'title' in h ? h.title : undefined,
        description: 'description' in h ? h.description : undefined,
        content_url: ('image_url' in h && h.image_url) || ('video_url' in h && h.video_url) || ('audio_url' in h && h.audio_url) || ('model_url' in h && h.model_url) || undefined
      }));

      setHotspots(hotspotsForState);
      setPrimitives(savedPrimitives);
      latestPrimitivesRef.current = savedPrimitives;

      // Cargar transformaciones del modelo si existen
      if (savedModelTransform) {
        setModelTransform(savedModelTransform);
        latestModelTransformRef.current = savedModelTransform;
      } else {
        const defaultTransform = {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        };
        setModelTransform(defaultTransform);
        latestModelTransformRef.current = defaultTransform;
      }

      // Cargar calibración de preview móvil si existe, sino resetear a defaults
      // Convertir a `unknown` primero para evitar error de TS al castear directamente
      const savedPhoneRaw = arData && ((arData as unknown) as Record<string, unknown>)['phonePreview'];
      const defaultPhonePreview = { cameraDistance: 1.0, yOffset: 0, previewScale: 1.0 };
      let newPhonePreview = defaultPhonePreview;
      
      if (savedPhoneRaw && typeof savedPhoneRaw === 'object') {
        const sp = savedPhoneRaw as Record<string, unknown>;
        newPhonePreview = {
          cameraDistance: Number(sp['cameraDistance'] ?? 1.0),
          yOffset: Number(sp['yOffset'] ?? 0),
          previewScale: Number(sp['previewScale'] ?? 1.0)
        };
      }
      
      // Solo actualizar si los valores son diferentes
      const eps = 1e-6;
      const prev = phonePreviewRef.current;
      if (Math.abs(prev.cameraDistance - newPhonePreview.cameraDistance) > eps ||
          Math.abs(prev.yOffset - newPhonePreview.yOffset) > eps ||
          Math.abs(prev.previewScale - newPhonePreview.previewScale) > eps) {
        setPhonePreview(newPhonePreview);
        phonePreviewRef.current = newPhonePreview;
      }

      // Preferir el transform/model guardado en el esquema normalizado (scenes/scene_entities)
      // para que el editor y la vista previa reflejen lo que quedó en la BD nueva.
      (async () => {
        try {
          const { transform, modelUrl: modelUrlFromScene } = await loadARModelFromScene({
            supabase,
            attractionId: selectedAttraction.id,
          });

          if (transform) {
            setModelTransform(transform);
            latestModelTransformRef.current = transform;
          }

          // Si por alguna razón el legacy está vacío pero existe en scenes, lo usamos.
          if ((!selectedAttraction.ar_model_url || selectedAttraction.ar_model_url.trim() === '') && modelUrlFromScene) {
            setModelFileName(modelUrlFromScene.split('/').pop() || '');
          }
        } catch {
          // noop: si falla lectura, seguimos con legacy
        }
      })();
    }
  }, [selectedAttraction]);

  const loadAttractions = async () => {
    try {
      const { data, error } = await supabase
        .from('attractions')
        .select('*')
        .order('name');

      if (error) throw error;
      setAttractions(data || []);
    } catch (error) {
      console.error('Error cargando atractivos:', error);
    }
  };

  const handleModelFileUpload = async (file: File) => {
    try {
      setUploadingModel(true);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedAttraction?.id}-${Date.now()}.${fileExt}`;
      const filePath = `ar-models/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('ar-content')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setModelFileName(fileName);
      
      // Recargar lista de modelos disponibles
      const { data, error: listError } = await supabase.storage.from('ar-content').list('ar-models', {
        limit: 100,
        offset: 0
      });
      if (!listError) {
        const modelFiles = data
          ?.filter(file => file.name.endsWith('.glb') || file.name.endsWith('.gltf'))
          ?.map(file => file.name) || [];
        setAvailableModels(modelFiles);
      }
    } catch (error) {
      console.error('Error subiendo modelo 3D:', error);
      alert('Error al subir el modelo 3D');
    } finally {
      setUploadingModel(false);
    }
  };

  const handleHotspotImageUpload = async (file: File, hotspotId: string) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedAttraction?.id}-${hotspotId}-${Date.now()}.${fileExt}`;
      const filePath = `hotspot-content/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('ar-content')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('ar-content')
        .getPublicUrl(filePath);

      setHotspots(prev => prev.map(h =>
        h.id === hotspotId ? { ...h, content_url: publicUrl } : h
      ));
    } catch (error) {
      console.error('Error subiendo contenido del hotspot:', error);
      alert('Error al subir el archivo');
    }
  };

  const addHotspot = () => {
    const newHotspot: Hotspot = {
      id: `hotspot_${Date.now()}`,
      position: { x: 0, y: 0, z: -2 },
      title: `Hotspot ${hotspots.length + 1}`,
      description: '',
      type: 'info'
    };
    setHotspots([...hotspots, newHotspot]);
  };

  const removeHotspot = (id: string) => {
    setHotspots(hotspots.filter(h => h.id !== id));
  };

  const updateHotspot = (id: string, updates: Partial<Hotspot>) => {
    setHotspots(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h));
  };

  const updateHotspotPosition = (id: string, axis: 'x' | 'y' | 'z', value: number) => {
    setHotspots(prev => prev.map(h =>
      h.id === id ? { ...h, position: { ...h.position, [axis]: value } } : h
    ));
  };

  // Guardado inmediato cuando el usuario alterna el switch AR
  const handleToggleArEnabled = async () => {
    if (!selectedAttraction) return;

    const next = !arEnabled;

    // Actualización optimista en UI
    setArEnabled(next);
    setSaving(true);

    try {
      // Preparar arData (igual que en saveARConfiguration) para persistir si se habilita
      const rawArData = {
        hotspots,
        primitives: latestPrimitivesRef.current || primitives,
        modelTransform: latestModelTransformRef.current || modelTransform,
        phonePreview
      };
      const arData = canonicalizeARDataForSave(rawArData);

      const modelUrl = modelFileName ? supabase.storage.from('ar-content').getPublicUrl(`ar-models/${modelFileName}`).data.publicUrl : '';

      // Si se desactiva AR: limpiar escena normalizada (scene_entities) del modelo
      if (!next) {
        try {
          const { data: scene, error: sceneErr } = await supabase
            .from('scenes')
            .select('id')
            .eq('attraction_id', selectedAttraction.id)
            .maybeSingle();

          if (!sceneErr && scene && scene.id) {
            await supabase
              .from('scene_entities')
              .delete()
              .eq('scene_id', scene.id)
              .eq('type', 'model');
          }
        } catch (cleanupError) {
          console.warn('Error limpiando scene_entities al desactivar AR (toggle):', cleanupError);
        }
      } else {
        // Si se habilita y hay modelo, asegurar que está persistido en scene_entities
        if (modelUrl && modelUrl.trim() !== '') {
          try {
            await saveARModelToScene({
              supabase,
              attractionId: selectedAttraction.id,
              modelUrl,
              transform: (latestModelTransformRef.current || modelTransform),
              sceneName: selectedAttraction.name,
            });
          } catch (err) {
            console.warn('No se pudo persistir modelo al habilitar AR (toggle):', err);
            // No abortamos la operación; el resto se guarda en la tabla attractions.
          }
        }
      }

      const { error } = await supabase
        .from('attractions')
        .update({
          has_ar_content: next,
          ar_model_url: next ? (modelUrl || null) : null,
          ar_hotspots: next ? arData : null,
          qr_code: next ? qrCode : null
        })
        .eq('id', selectedAttraction.id);

      if (error) throw error;

      // Actualizar estado local para reflejar el cambio de inmediato
      const updatedAttraction = {
        ...selectedAttraction,
        has_ar_content: next,
        ar_model_url: next ? (modelUrl || null) : null,
        ar_hotspots: next ? arData : null,
        qr_code: next ? qrCode : null
      } as Attraction;

      if (!next) setModelFileName('');

      setSelectedAttraction(updatedAttraction);
      setAttractions(prev => prev.map(a => a.id === updatedAttraction.id ? updatedAttraction : a));

      // Mensaje breve de confirmación
      // (no modal para no interrumpir el flujo)
      console.log(`AR ${next ? 'habilitado' : 'deshabilitado'} para ${selectedAttraction.id}`);
    } catch (err) {
      console.error('Error al alternar AR:', err);
      // Revertir estado UI en fallo
      setArEnabled(!next);
      alert('Error actualizando estado AR. Revisa la consola para más detalles.');
    } finally {
      setSaving(false);
    }
  };

  const saveARConfiguration = async () => {
    if (!selectedAttraction) return;

    try {
      setSaving(true);

      // Antes de persistir, canonicalizar/normalizar el JSON para evitar formatos legacy
      const rawArData = {
        hotspots,
        primitives: latestPrimitivesRef.current || primitives,
        modelTransform: latestModelTransformRef.current || modelTransform,
        phonePreview
      };
      const arData = canonicalizeARDataForSave(rawArData);

      // Obtener URL pública del modelo si hay uno seleccionado
      const modelUrl = modelFileName ? supabase.storage.from('ar-content').getPublicUrl(`ar-models/${modelFileName}`).data.publicUrl : '';

      // Si AR está deshabilitado, asegurarse de limpiar cualquier 'model' en scene_entities
      if (!arEnabled) {
        try {
          const { data: scene, error: sceneErr } = await supabase
            .from('scenes')
            .select('id')
            .eq('attraction_id', selectedAttraction.id)
            .maybeSingle();

          if (!sceneErr && scene && scene.id) {
            await supabase
              .from('scene_entities')
              .delete()
              .eq('scene_id', scene.id)
              .eq('type', 'model');
          }
        } catch (cleanupError) {
          console.warn('Error limpiando scene_entities al desactivar AR:', cleanupError);
        }
      }

      // Persistir modelo 3D en el esquema normalizado (scenes/assets/scene_entities)
      // Mantiene attractions.ar_model_url como compatibilidad temporal.
      if (arEnabled && modelUrl && modelUrl.trim() !== '') {
        await saveARModelToScene({
          supabase,
          attractionId: selectedAttraction.id,
          modelUrl,
          transform: (latestModelTransformRef.current || modelTransform),
          sceneName: selectedAttraction.name,
        });
      } else if (arEnabled && (!modelUrl || modelUrl.trim() === '')) {
        // Si AR está habilitado pero no hay modelo, limpiar la entidad 'model' en el esquema
        // normalizado (scenes / scene_entities). Usar scene_id + type (nombre real de columnas).
        try {
          const { data: scene, error: sceneErr } = await supabase
            .from('scenes')
            .select('id')
            .eq('attraction_id', selectedAttraction.id)
            .maybeSingle();

          if (!sceneErr && scene && scene.id) {
            await supabase
              .from('scene_entities')
              .delete()
              .eq('scene_id', scene.id)
              .eq('type', 'model');
          }
        } catch (cleanupError) {
          console.warn('Error limpiando scene_entities (scene_id/type):', cleanupError);
          // No fallar el guardado por esto
        }
      }

      const { error } = await supabase
        .from('attractions')
        .update({
          has_ar_content: arEnabled,
          ar_model_url: modelUrl || null,
          ar_hotspots: arEnabled ? arData : null,
          qr_code: arEnabled ? qrCode : null
        })
        .eq('id', selectedAttraction.id);

      if (error) throw error;

      // Actualizar estado local inmediatamente para reflejar el cambio en la UI
      const updatedAttraction = {
        ...selectedAttraction,
        has_ar_content: arEnabled,
        ar_model_url: modelUrl || null,
        ar_hotspots: arEnabled ? arData : null,
        qr_code: arEnabled ? qrCode : null
      } as Attraction;

      // Actualizar modelFileName en el editor si se removió el modelo
      if (!modelFileName) {
        setModelFileName('');
      }

      setSelectedAttraction(updatedAttraction);
      setAttractions(prev => prev.map(a => a.id === updatedAttraction.id ? updatedAttraction : a));

      alert('✅ Configuración AR guardada correctamente');
      loadAttractions();
    } catch (error) {
      console.error('Error guardando configuración AR:', error);
      if (error && typeof error === 'object') {
        const err = error as {
          message?: string;
          details?: string;
          hint?: string;
          code?: string;
        };
        console.error('Detalle error AR:', {
          message: err.message,
          details: err.details,
          hint: err.hint,
          code: err.code,
        });
      }
      alert('❌ Error al guardar la configuración. Revisa la consola para el detalle.');
    } finally {
      setSaving(false);
    }
  };

  // Obtener URL pública del modelo seleccionado
  const currentModelUrl = modelFileName ? supabase.storage.from('ar-content').getPublicUrl(`ar-models/${modelFileName}`).data.publicUrl : undefined;

  // Helper para renderizar panel con controles de orden (no usado actualmente)
  // const renderPanelWithControls = (...) => { ... };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: isMobile ? '12px' : '20px',
      overflowX: 'hidden'
    }}>
      <div style={{ 
        maxWidth: '1600px', 
        margin: '0 auto',
        width: '100%',
        overflowX: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          background: 'white',
          padding: isMobile ? '16px' : '24px',
          borderRadius: '16px',
          marginBottom: isMobile ? '12px' : '20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}>
          <h1 style={{ margin: 0, fontSize: '2rem', color: '#1A3A6C' }}>
            🥽 Configuración de Realidad Aumentada
          </h1>
          <p style={{ margin: '8px 0 0', color: '#666' }}>
            Administra contenido AR para cada atractivo turístico
          </p>
        </div>

        {/* Panel de Selector y Controles Principales */}
        {!selectedAttraction ? (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: isMobile ? '16px' : '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            marginBottom: isMobile ? '12px' : '20px'
          }}>
            <h3 style={{ margin: '0 0 12px', fontSize: isMobile ? '0.9rem' : '1rem', color: '#1A3A6C' }}>
              📍 Selecciona un Atractivo
            </h3>
            <select
              onChange={(e) => {
                const attraction = attractions.find(a => a.id === e.target.value);
                setSelectedAttraction(attraction || null);
              }}
              style={{
                width: '100%',
                padding: isMobile ? '8px' : '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: isMobile ? '0.85rem' : '0.95rem'
              }}
            >
              <option value="">Seleccionar atractivo...</option>
              {attractions.map(attraction => (
                <option key={attraction.id} value={attraction.id}>
                  {attraction.name} {attraction.has_ar_content ? '(AR)' : ''}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {/* Barra flotante de herramientas (fija en desktop, estática en mobile) */}
        {selectedAttraction && !isMobile && (
          <div style={{
            position: 'fixed',
            top: isMobile ? '12px' : '20px',
            right: isMobile ? '12px' : '20px',
            background: 'white',
            borderRadius: '12px',
            padding: isMobile ? '8px 12px' : '12px 16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            zIndex: 50,
            display: 'flex',
            gap: isMobile ? '6px' : '8px',
            alignItems: 'center',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.3)',
            flexWrap: 'wrap',
            maxWidth: isMobile ? 'calc(100vw - 24px)' : 'auto'
          }}>
            <div style={{
              fontSize: isMobile ? '0.7rem' : '0.8rem',
              color: '#666',
              fontWeight: '600'
            }}>
              {selectedAttraction.name}
            </div>
            <div style={{ width: '1px', height: '24px', background: '#e0e0e0' }} />
            
            {/* Selector de Layout - oculto en mobile */}
            {!isMobile && (
              <>
            <select
              value={layoutPreset}
              onChange={(e) => applyLayoutPreset(e.target.value)}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid #ddd',
                fontSize: '0.75rem',
                cursor: 'pointer',
                background: 'white'
              }}
              title="Cambiar disposición de paneles"
            >
              <option value="auto">Layout Personalizado</option>
              <option value="equal">📐 Igual 2x2</option>
              <option value="large-top">⬆️ Grande arriba</option>
              <option value="large-left">⬅️ Grande izquierda</option>
              <option value="two-large">📊 Dos grandes</option>
            </select>
            
            <div style={{ width: '1px', height: '24px', background: '#e0e0e0' }} />
              </>
            )}
            <button
              onClick={handleToggleArEnabled}
              disabled={saving}
              style={{
                background: arEnabled ? '#4CAF50' : '#999',
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: '0.75rem',
                fontWeight: '600',
                opacity: saving ? 0.7 : 1,
                whiteSpace: 'nowrap'
              }}
              title="Alternar AR"
            >
              {arEnabled ? '✓ AR ON' : '✕ AR OFF'}
            </button>
            <button
              onClick={saveARConfiguration}
              disabled={saving || !arEnabled}
              style={{
                background: saving ? '#9E9E9E' : (!arEnabled ? '#ccc' : '#1976d2'),
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: (saving || !arEnabled) ? 'not-allowed' : 'pointer',
                fontSize: '0.75rem',
                fontWeight: '600',
                whiteSpace: 'nowrap'
              }}
              title={arEnabled ? "Guardar configuración" : "Habilita AR primero"}
            >
              {saving ? 'Guardando...' : '💾 Guardar'}
            </button>
          </div>
        )}

        {/* Panel Principal - Layout Grid con tamaños personalizables */}
        {selectedAttraction && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
            gridAutoRows: isMobile ? 'minmax(300px, auto)' : 'minmax(400px, auto)',
            gap: isMobile ? '12px' : '20px'
          }}>

            {/* Paneles en orden personalizable */}
            {panelOrder.map((panelId, idx) => {
              const canMoveUp = idx > 0;
              const canMoveDown = idx < panelOrder.length - 1;
              const panelSize = panelSizes[panelId] || 1;
              
              // Panel 3: Configuración de Modelos
              if (panelId === 'config') return (
            <div key="config" style={{
              background: 'white',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: '500px',
              overflowY: 'auto',
              gridColumn: isMobile ? 'span 1' : `span ${panelSize}`,
              boxSizing: 'border-box',
              width: '100%',
              overflowX: 'hidden'
            }}>
              {/* Header con controles de orden y tamaño */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: '1px solid #e0e0e0',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#1A3A6C' }}>
                  ⚙️ Configuración
                </h3>
                <div style={{ display: 'flex', gap:'4px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: '#999', marginRight: '4px' }}>
                    {idx + 1}/{panelOrder.length}{!isMobile && ` | ${panelSize}col`}
                  </span>
                  
                  {/* Controles de tamaño */}
                  {!isMobile && (
                    <>
                      <button
                        onClick={() => changePanelSize(panelId, -1)}
                        disabled={panelSize <= 1}
                        title="Reducir ancho"
                        style={{
                          background: panelSize > 1 ? '#4CAF50' : '#e0e0e0',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 6px',
                          cursor: panelSize > 1 ? 'pointer' : 'not-allowed',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Minimize2 size={12} />
                      </button>
                      <button
                        onClick={() => changePanelSize(panelId, 1)}
                        disabled={panelSize >= 4}
                        title="Aumentar ancho"
                        style={{
                          background: panelSize < 4 ? '#4CAF50' : '#e0e0e0',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 6px',
                          cursor: panelSize < 4 ? 'pointer' : 'not-allowed',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Maximize2 size={12} />
                      </button>
                      <div style={{ width: '1px', height: '20px', background: '#e0e0e0', margin: '0 2px' }} />
                    </>
                  )}
                  
                  {/* Controles de posición */}
                  <button
                    onClick={() => movePanelUp(panelId)}
                    disabled={!canMoveUp}
                    title="Mover arriba"
                    style={{
                      background: canMoveUp ? '#667eea' : '#e0e0e0',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      cursor: canMoveUp ? 'pointer' : 'not-allowed',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    onClick={() => movePanelDown(panelId)}
                    disabled={!canMoveDown}
                    title="Mover abajo"
                    style={{
                      background: canMoveDown ? '#667eea' : '#e0e0e0',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      cursor: canMoveDown ? 'pointer' : 'not-allowed',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
              </div>

              {/* Selector y info del atractivo */}
              <div style={{
                padding: '12px',
                background: '#f0f7ff',
                borderRadius: '8px',
                border: '1px solid #667eea',
                marginBottom: '12px'
              }}>
                <div style={{ fontWeight: '600', fontSize: '0.9rem', color: '#1A3A6C', marginBottom: '4px' }}>
                  {selectedAttraction.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '8px' }}>
                  {selectedAttraction.category || 'Sin categoría'}
                </div>
                <button
                  onClick={() => setSelectedAttraction(null)}
                  style={{
                    background: 'transparent',
                    border: '1px solid #667eea',
                    color: '#667eea',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Cambiar Atractivo
                </button>
              </div>

              {/* Botones de acción principal - REMOVIDO (están en barra flotante arriba) */}
              {/* Visto que duplicaría controles, estos están en la barra flotante fija */}

              {/* Advertencia si AR está desactivado */}
              {!arEnabled && (
                <div style={{
                  background: '#fff3e0',
                  border: '1px solid #ff9800',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '12px',
                  fontSize: '0.85rem',
                  color: '#e65100'
                }}>
                  <strong>⚠️ AR Desactivado</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '0.75rem' }}>
                    Activa AR usando el botón de la barra superior para habilitar la configuración completa.
                  </p>
                </div>
              )}

              {/* Selector de modelo 3D */}
              <div style={{ marginBottom: '12px', opacity: arEnabled ? 1 : 0.6 }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '500', color: '#333' }}>
                  Modelo 3D
                </label>
                <select
                  value={modelFileName}
                  onChange={(e) => setModelFileName(e.target.value)}
                  disabled={!arEnabled}
                  style={{
                    width: '100%',
                    padding: '6px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    cursor: arEnabled ? 'pointer' : 'not-allowed',
                    background: arEnabled ? 'white' : '#f5f5f5'
                  }}
                >
                  <option value="">Sin modelo</option>
                  {availableModels.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>

              {/* Upload */}
              <label style={{
                background: arEnabled ? '#667eea' : '#ccc',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '6px',
                cursor: arEnabled ? 'pointer' : 'not-allowed',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                marginBottom: '12px',
                opacity: arEnabled ? 1 : 0.6
              }}>
                <Upload size={14} />
                {uploadingModel ? 'Subiendo...' : 'Subir Modelo'}
                <input
                  type="file"
                  accept=".glb,.gltf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && arEnabled) handleModelFileUpload(file);
                  }}
                  style={{ display: 'none' }}
                  disabled={uploadingModel || !arEnabled}
                />
              </label>

              {/* Vista previa del modelo */}
              {modelFileName && (
                <div style={{ marginBottom: '12px', opacity: arEnabled ? 1 : 0.6 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: '500' }}>
                    Vista Miniatura
                  </label>
                  <div style={{
                    width: '100%',
                    height: '150px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    background: '#f8f9fa',
                    overflow: 'hidden'
                  }}>
                    <ModelPreview url={currentModelUrl} />
                  </div>
                </div>
              )}

              {/* Transformación del modelo */}
              <div style={{ 
                borderTop: '1px solid #e0e0e0',
                paddingTop: '12px',
                fontSize: '0.8rem',
                opacity: arEnabled ? 1 : 0.6
              }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '0.85rem', color: '#333' }}>
                  Transformación
                </h4>

                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: '#666', marginBottom: '4px' }}>
                    Posición (X, Y, Z)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
                    <input type="number" step="0.1" value={modelTransform.position.x} onChange={(e) => arEnabled && setModelTransform({...modelTransform, position: {...modelTransform.position, x: parseFloat(e.target.value)}})} disabled={!arEnabled} style={{ padding: '4px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '0.7rem', background: arEnabled ? 'white' : '#f5f5f5', cursor: arEnabled ? 'text' : 'not-allowed' }} placeholder="X" />
                    <input type="number" step="0.1" value={modelTransform.position.y} onChange={(e) => arEnabled && setModelTransform({...modelTransform, position: {...modelTransform.position, y: parseFloat(e.target.value)}})} disabled={!arEnabled} style={{ padding: '4px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '0.7rem', background: arEnabled ? 'white' : '#f5f5f5', cursor: arEnabled ? 'text' : 'not-allowed' }} placeholder="Y" />
                    <input type="number" step="0.1" value={modelTransform.position.z} onChange={(e) => arEnabled && setModelTransform({...modelTransform, position: {...modelTransform.position, z: parseFloat(e.target.value)}})} disabled={!arEnabled} style={{ padding: '4px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '0.7rem', background: arEnabled ? 'white' : '#f5f5f5', cursor: arEnabled ? 'text' : 'not-allowed' }} placeholder="Z" />
                  </div>
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: '#666', marginBottom: '4px' }}>
                    Rotación (X, Y, Z)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
                    <input type="number" step="0.01" value={modelTransform.rotation.x} onChange={(e) => arEnabled && setModelTransform({...modelTransform, rotation: {...modelTransform.rotation, x: parseFloat(e.target.value)}})} disabled={!arEnabled} style={{ padding: '4px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '0.7rem', background: arEnabled ? 'white' : '#f5f5f5', cursor: arEnabled ? 'text' : 'not-allowed' }} placeholder="X" />
                    <input type="number" step="0.01" value={modelTransform.rotation.y} onChange={(e) => arEnabled && setModelTransform({...modelTransform, rotation: {...modelTransform.rotation, y: parseFloat(e.target.value)}})} disabled={!arEnabled} style={{ padding: '4px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '0.7rem', background: arEnabled ? 'white' : '#f5f5f5', cursor: arEnabled ? 'text' : 'not-allowed' }} placeholder="Y" />
                    <input type="number" step="0.01" value={modelTransform.rotation.z} onChange={(e) => arEnabled && setModelTransform({...modelTransform, rotation: {...modelTransform.rotation, z: parseFloat(e.target.value)}})} disabled={!arEnabled} style={{ padding: '4px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '0.7rem', background: arEnabled ? 'white' : '#f5f5f5', cursor: arEnabled ? 'text' : 'not-allowed' }} placeholder="Z" />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: '#666', marginBottom: '4px' }}>
                    Escala (X, Y, Z)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
                    <input type="number" step="0.1" value={modelTransform.scale.x} onChange={(e) => arEnabled && setModelTransform({...modelTransform, scale: {...modelTransform.scale, x: parseFloat(e.target.value)}})} disabled={!arEnabled} style={{ padding: '4px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '0.7rem', background: arEnabled ? 'white' : '#f5f5f5', cursor: arEnabled ? 'text' : 'not-allowed' }} placeholder="X" />
                    <input type="number" step="0.1" value={modelTransform.scale.y} onChange={(e) => arEnabled && setModelTransform({...modelTransform, scale: {...modelTransform.scale, y: parseFloat(e.target.value)}})} disabled={!arEnabled} style={{ padding: '4px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '0.7rem', background: arEnabled ? 'white' : '#f5f5f5', cursor: arEnabled ? 'text' : 'not-allowed' }} placeholder="Y" />
                    <input type="number" step="0.1" value={modelTransform.scale.z} onChange={(e) => arEnabled && setModelTransform({...modelTransform, scale: {...modelTransform.scale, z: parseFloat(e.target.value)}})} disabled={!arEnabled} style={{ padding: '4px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '0.7rem', background: arEnabled ? 'white' : '#f5f5f5', cursor: arEnabled ? 'text' : 'not-allowed' }} placeholder="Z" />
                  </div>
                </div>
              </div>

              {/* Modo ligero */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                cursor: arEnabled ? 'pointer' : 'not-allowed',
                marginTop: '12px',
                padding: '8px',
                background: '#f5f5f5',
                borderRadius: '4px',
                opacity: arEnabled ? 1 : 0.6
              }}>
                <input
                  type="checkbox"
                  checked={lightMode}
                  onChange={(e) => arEnabled && setLightMode(e.target.checked)}
                  disabled={!arEnabled}
                />
                Modo ligero (sin modelo)
              </label>

              {/* QR */}
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e0e0e0', opacity: arEnabled ? 1 : 0.6 }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '500', color: '#333' }}>
                  ID QR
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={qrCode}
                    onChange={(e) => arEnabled && setQrCode(e.target.value)}
                    disabled={!arEnabled}
                    style={{
                      flex: 1,
                      padding: '6px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      background: arEnabled ? 'white' : '#f5f5f5',
                      cursor: arEnabled ? 'text' : 'not-allowed'
                    }}
                  />
                  <button
                    onClick={async () => {
                      if (!selectedAttraction || !arEnabled) return;
                      const qrValue = (qrCode || `AR_${selectedAttraction.id}`).trim();
                      try {
                        setGeneratingQr(true);
                        const url = `${window.location.origin}/ar/${selectedAttraction.id}?qr=${encodeURIComponent(qrValue)}`;
                        const QR = await import('qrcode');
                        const dataUrl = await QR.toDataURL(url, { margin: 2, scale: 8 });
                        setQrDataUrl(dataUrl);
                        const { error: dbError } = await supabase
                          .from('attractions')
                          .update({ qr_code: qrValue })
                          .eq('id', selectedAttraction.id);
                        if (!dbError) {
                          setQrCode(qrValue);
                          setSelectedAttraction({ ...selectedAttraction, qr_code: qrValue });
                          setAttractions(prev => prev.map(a => a.id === selectedAttraction.id ? { ...a, qr_code: qrValue } : a));
                          setQrModalOpen(true);
                        }
                      } catch (err) {
                        console.error('Error:', err);
                      } finally {
                        setGeneratingQr(false);
                      }
                    }}
                    disabled={!arEnabled}
                    style={{
                      background: arEnabled ? '#1976d2' : '#ccc',
                      color: 'white',
                      border: 'none',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      cursor: arEnabled ? 'pointer' : 'not-allowed',
                      fontSize: '0.8rem',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {generatingQr ? '...' : '✓'}
                  </button>
                </div>
              </div>
            </div>
              ); // Fin panel config

              // Panel Hotspots
              if (panelId === 'hotspots') return (
            <div key="hotspots" style={{
              background: 'white',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: '500px',
              overflowY: 'auto',
              gridColumn: isMobile ? 'span 1' : `span ${panelSize}`,
              boxSizing: 'border-box',
              width: '100%',
              overflowX: 'hidden'
            }}>
              {/* Header con titulo y controles */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
                paddingBottom: '8px',
                borderBottom: '1px solid #e0e0e0',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#1A3A6C' }}>
                  📍 Hotspots ({hotspots.length})
                </h3>
                <div style={{ display: 'flex', gap:'4px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: '#999', marginRight: '4px' }}>
                    {idx + 1}/{panelOrder.length} | {panelSize}col
                  </span>
                  {!isMobile && (
                    <>
                      <button onClick={() => changePanelSize(panelId, -1)} disabled={panelSize <= 1} title="Reducir ancho" style={{ background: panelSize > 1 ? '#4CAF50' : '#e0e0e0', border: 'none', borderRadius: '4px', padding: '4px 6px', cursor: panelSize > 1 ? 'pointer' : 'not-allowed', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minimize2 size={12} /></button>
                      <button onClick={() => changePanelSize(panelId, 1)} disabled={panelSize >= 4} title="Aumentar ancho" style={{ background: panelSize < 4 ? '#4CAF50' : '#e0e0e0', border: 'none', borderRadius: '4px', padding: '4px 6px', cursor: panelSize < 4 ? 'pointer' : 'not-allowed', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Maximize2 size={12} /></button>
                      <div style={{ width: '1px', height: '20px', background: '#e0e0e0', margin: '0 2px' }} />
                    </>
                  )}
                  <span style={{ fontSize: '0.7rem', color: '#999', marginRight: '4px' }}>
                    {idx + 1}/{panelOrder.length}
                  </span>
                  <button
                    onClick={() => movePanelUp(panelId)}
                    disabled={!canMoveUp}
                    title="Mover arriba"
                    style={{
                      background: canMoveUp ? '#667eea' : '#e0e0e0',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      cursor: canMoveUp ? 'pointer' : 'not-allowed',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    onClick={() => movePanelDown(panelId)}
                    disabled={!canMoveDown}
                    title="Mover abajo"
                    style={{
                      background: canMoveDown ? '#667eea' : '#e0e0e0',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      cursor: canMoveDown ? 'pointer' : 'not-allowed',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
              </div>
              {/* Botón agregar hotspot */}
              <div style={{ marginBottom: '12px' }}>
                <button
                  onClick={addHotspot}
                  disabled={!arEnabled}
                  style={{
                    background: arEnabled ? '#4CAF50' : '#ccc',
                    color: 'white',
                    border: 'none',
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    cursor: arEnabled ? 'pointer' : 'not-allowed',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    opacity: arEnabled ? 1 : 0.6
                  }}
                  title={arEnabled ? 'Agregar hotspot' : 'Activa AR primero'}
                >
                  <Plus size={14} />
                  Agregar
                </button>
              </div>

              {!arEnabled && hotspots.length === 0 && (
                <div style={{
                  background: '#f5f5f5',
                  border: '1px dashed #ccc',
                  borderRadius: '8px',
                  padding: '20px',
                  textAlign: 'center',
                  color: '#999',
                  fontSize: '0.85rem'
                }}>
                  Activa AR para agregar hotspots
                </div>
              )}

              {hotspots.map(hotspot => (
                <div key={hotspot.id} style={{
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  padding: '10px',
                  marginBottom: '8px',
                  background: '#fafafa',
                  opacity: arEnabled ? 1 : 0.6,
                  display: 'flex',
                  gap: '10px'
                }}>
                  {/* Miniatura del hotspot */}
                  <div style={{
                    width: '60px',
                    height: '60px',
                    flexShrink: 0,
                    borderRadius: '6px',
                    overflow: 'hidden',
                    background: hotspot.type === 'image' ? '#e3f2fd' : hotspot.type === 'video' ? '#f3e5f5' : '#e8f5e9',
                    border: '2px solid',
                    borderColor: hotspot.type === 'image' ? '#2196F3' : hotspot.type === 'video' ? '#9C27B0' : '#4CAF50',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative'
                  }}>
                    {hotspot.type === 'image' && hotspot.content_url ? (
                      <Image 
                        src={hotspot.content_url} 
                        alt={hotspot.title || 'Hotspot image'} 
                        width={60}
                        height={60}
                        style={{
                          objectFit: 'cover'
                        }}
                      />
                    ) : hotspot.type === 'video' ? (
                      <div style={{ fontSize: '1.5rem' }}>🎬</div>
                    ) : hotspot.type === 'image' ? (
                      <div style={{ fontSize: '1.5rem' }}>🖼️</div>
                    ) : (
                      <div style={{ fontSize: '1.5rem' }}>📄</div>
                    )}
                    {/* Indicador de tipo en la esquina */}
                    <div style={{
                      position: 'absolute',
                      bottom: 2,
                      right: 2,
                      background: 'rgba(0,0,0,0.7)',
                      color: 'white',
                      fontSize: '0.55rem',
                      padding: '1px 3px',
                      borderRadius: '3px',
                      fontWeight: 'bold'
                    }}>
                      {hotspot.type === 'image' ? 'IMG' : hotspot.type === 'video' ? 'VID' : 'TXT'}
                    </div>
                  </div>

                  {/* Contenido del hotspot */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      value={hotspot.title}
                      onChange={(e) => arEnabled && updateHotspot(hotspot.id, { title: e.target.value })}
                      disabled={!arEnabled}
                      placeholder="Título"
                      style={{
                        flex: 1,
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        padding: '6px',
                        fontSize: '0.8rem',
                        background: arEnabled ? 'white' : '#f5f5f5',
                        cursor: arEnabled ? 'text' : 'not-allowed'
                      }}
                    />
                    <button
                      onClick={() => arEnabled && removeHotspot(hotspot.id)}
                      disabled={!arEnabled}
                      style={{
                        background: arEnabled ? '#ff5252' : '#ccc',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '6px 8px',
                        cursor: arEnabled ? 'pointer' : 'not-allowed',
                        color: 'white',
                        fontSize: '0.8rem'
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <select
                    value={hotspot.type}
                    onChange={(e) => arEnabled && updateHotspot(hotspot.id, { type: e.target.value as 'info' | 'image' | 'video' })}
                    disabled={!arEnabled}
                    style={{
                      width: '100%',
                      padding: '4px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      marginBottom: '8px',
                      background: arEnabled ? 'white' : '#f5f5f5',
                      cursor: arEnabled ? 'pointer' : 'not-allowed'
                    }}
                  >
                    <option value="info">📄 Información</option>
                    <option value="image">🖼️ Imagen</option>
                    <option value="video">🎥 Video</option>
                  </select>

                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 'bold', marginBottom: '4px', color: '#333' }}>
                      Posición:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
                      <input type="number" step="0.1" value={hotspot.position?.x ?? 0} onChange={(e) => arEnabled && updateHotspotPosition(hotspot.id, 'x', parseFloat(e.target.value))} disabled={!arEnabled} placeholder="X" style={{ padding: '4px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '0.7rem', background: arEnabled ? 'white' : '#f5f5f5', cursor: arEnabled ? 'text' : 'not-allowed' }} />
                      <input type="number" step="0.1" value={hotspot.position?.y ?? 0} onChange={(e) => arEnabled && updateHotspotPosition(hotspot.id, 'y', parseFloat(e.target.value))} disabled={!arEnabled} placeholder="Y" style={{ padding: '4px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '0.7rem', background: arEnabled ? 'white' : '#f5f5f5', cursor: arEnabled ? 'text' : 'not-allowed' }} />
                      <input type="number" step="0.1" value={hotspot.position?.z ?? 0} onChange={(e) => arEnabled && updateHotspotPosition(hotspot.id, 'z', parseFloat(e.target.value))} disabled={!arEnabled} placeholder="Z" style={{ padding: '4px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '0.7rem', background: arEnabled ? 'white' : '#f5f5f5', cursor: arEnabled ? 'text' : 'not-allowed' }} />
                    </div>
                  </div>

                  <textarea
                    value={hotspot.description}
                    onChange={(e) => arEnabled && updateHotspot(hotspot.id, { description: e.target.value })}
                    disabled={!arEnabled}
                    placeholder="Descripción"
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '4px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontFamily: 'inherit',
                      marginBottom: '8px',
                      background: arEnabled ? 'white' : '#f5f5f5',
                      cursor: arEnabled ? 'text' : 'not-allowed'
                    }}
                  />

                  {hotspot.type !== 'info' && (
                    <label style={{
                      background: '#2196F3',
                      color: 'white',
                      padding: '6px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.7rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <ImageIcon size={12} />
                      {hotspot.content_url ? '✓ Actualizar' : 'Subir'}
                      <input
                        type="file"
                        accept={hotspot.type === 'image' ? 'image/*' : 'video/*'}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleHotspotImageUpload(file, hotspot.id);
                        }}
                        style={{ display: 'none' }}
                      />
                    </label>
                  )}
                  </div>
                </div>
              ))}

              {hotspots.length === 0 && (
                <p style={{
                  textAlign: 'center',
                  color: '#999',
                  padding: '20px',
                  fontSize: '0.85rem'
                }}>
                  No hay hotspots. Agrégalos arriba.
                </p>
              )}
            </div>
              ); // Fin panel hotspots

              // Panel Canvas 3D
              if (panelId === 'canvas') return (
            <div key="canvas" style={{
              background: 'white',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: '500px',
              gridColumn: isMobile ? 'span 1' : `span ${panelSize}`,
              boxSizing: 'border-box',
              width: '100%',
              overflowX: 'hidden'
            }}>
              {/* Header con controles */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: '1px solid #e0e0e0',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#1A3A6C' }}>
                  👁️ Canvas 3D
                </h3>
                <div style={{ display: 'flex', gap:'4px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: '#999', marginRight: '4px' }}>
                    {idx + 1}/{panelOrder.length}{!isMobile && ` | ${panelSize}col`}
                  </span>
                  {!isMobile && (
                    <>
                      <button onClick={() => changePanelSize(panelId, -1)} disabled={panelSize <= 1} title="Reducir ancho" style={{ background: panelSize > 1 ? '#4CAF50' : '#e0e0e0', border: 'none', borderRadius: '4px', padding: '4px 6px', cursor: panelSize > 1 ? 'pointer' : 'not-allowed', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minimize2 size={12} /></button>
                      <button onClick={() => changePanelSize(panelId, 1)} disabled={panelSize >= 4} title="Aumentar ancho" style={{ background: panelSize < 4 ? '#4CAF50' : '#e0e0e0', border: 'none', borderRadius: '4px', padding: '4px 6px', cursor: panelSize < 4 ? 'pointer' : 'not-allowed', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Maximize2 size={12} /></button>
                      <div style={{ width: '1px', height: '20px', background: '#e0e0e0', margin: '0 2px' }} />
                    </>
                  )}
                  <button
                    onClick={() => movePanelUp(panelId)}
                    disabled={!canMoveUp}
                    title="Mover arriba"
                    style={{
                      background: canMoveUp ? '#667eea' : '#e0e0e0',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      cursor: canMoveUp ? 'pointer' : 'not-allowed',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    onClick={() => movePanelDown(panelId)}
                    disabled={!canMoveDown}
                    title="Mover abajo"
                    style={{
                      background: canMoveDown ? '#667eea' : '#e0e0e0',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      cursor: canMoveDown ? 'pointer' : 'not-allowed',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
              </div>
              
              {/* Contenedor flex para canvas y herramientas */}
              <div style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                gap: '12px',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden'
              }}>
                {/* Canvas 3D */}
                <div style={{
                  flex: 1,
                  minHeight: '0',
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column'
                }}>
              {arEnabled && (currentModelUrl || hotspots.length > 0 || primitives.length > 0 || lightMode) ? (
                <div style={{
                  flex: 1,
                  minHeight: '0',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <ARPreview3D
                    modelUrl={currentModelUrl}
                    modelTransform={modelTransform}
                    lightMode={lightMode}
                    phonePreview={{ cameraDistance: 1.0, yOffset: 0, previewScale: 1.0 }}
                    onPhonePreviewChange={handlePhonePreviewChange}
                    toolsPortalId="ar-tools-panel"
                    hotspots={hotspots.map(h => {
                      const base = {
                        id: h.id,
                        position: h.position,
                        rotation: h.rotation,
                        scale: h.scale
                      };
                      switch (h.type) {
                        case 'video':
                          return { ...base, type: 'video', video_url: h.content_url || '', title: h.title || '' } as ARHotspot;
                        case '3d_model':
                          return { ...base, type: '3d_model', model_url: h.content_url || '' } as ARHotspot;
                        case 'audio':
                          return { ...base, type: 'audio', audio_url: h.content_url || '', title: h.title || '' } as ARHotspot;
                        case 'image':
                          return { ...base, type: 'image', image_url: h.content_url || '', title: h.title, description: h.description } as ARHotspot;
                        default:
                          return { ...base, type: 'info', title: h.title || '', description: h.description || '', image_url: h.content_url } as ARHotspot;
                      }
                    })}
                    primitives={primitives}
                    onHotspotPositionChange={(id: string, position: { x: number; y: number; z: number }) => {
                      setHotspots(prev => prev.map(h => 
                        h.id === id ? { ...h, position } : h
                      ));
                    }}
                    onHotspotScaleChange={(id: string, scale: { x: number; y: number; z: number }) => {
                      setHotspots(prev => prev.map(h => 
                        h.id === id ? { ...h, scale } : h
                      ));
                    }}
                    onHotspotRotationChange={(id: string, rotation: { x: number; y: number; z: number }) => {
                      setHotspots(prev => prev.map(h => 
                        h.id === id ? { ...h, rotation } : h
                      ));
                    }}
                    onModelTransformChange={(transform: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number }; scale: { x: number; y: number; z: number } }) => {
                      console.log('Actualizando transformación del modelo:', transform);
                      setModelTransform(transform);
                      latestModelTransformRef.current = transform;
                    }}
                    onPrimitivesChange={(p: Primitive[]) => { setPrimitives(p); latestPrimitivesRef.current = p; }}
                  />
                </div>
              ) : (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#999',
                  textAlign: 'center'
                }}>
                  <div>
                    <Box size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>
                      Habilita AR y agrega un modelo para ver la vista previa
                    </p>
                  </div>
                </div>
              )}
                </div>
                
                {/* Panel de herramientas (portal) */}
                {!isMobile && (
                  <div 
                    id="ar-tools-panel"
                    style={{
                      width: '280px',
                      minWidth: '280px',
                      maxHeight: '100%',
                      overflowY: 'auto',
                      overflowX: 'hidden'
                    }}
                  />
                )}
              </div>

              {/* Mensaje de ayuda */}
              <div style={{
                marginTop: '12px',
                padding: '10px',
                background: '#e3f2fd',
                borderRadius: '6px',
                fontSize: '0.75rem',
                color: '#1976d2'
              }}>
                💡 Usa las herramientas para rotar y hacer zoom en el canvas
              </div>
              
              {/* Panel de herramientas en mobile (abajo) */}
              {isMobile && (
                <div 
                  id="ar-tools-panel"
                  style={{
                    width: '100%',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    marginTop: '12px'
                  }}
                />
              )}
            </div>
              ); // Fin panel canvas

              // Panel Vista Móvil
              if (panelId === 'mobile') return (
            <div key="mobile" style={{
              background: 'white',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: '500px',
              gridColumn: isMobile ? 'span 1' : `span ${panelSize}`,
              boxSizing: 'border-box',
              width: '100%',
              overflowX: 'hidden'
            }}>
              {/* Header con controles */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: '1px solid #e0e0e0',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#1A3A6C' }}>
                  📱 Vista Móvil
                </h3>
                <div style={{ display: 'flex', gap:'4px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: '#999', marginRight: '4px' }}>
                    {idx + 1}/{panelOrder.length}{!isMobile && ` | ${panelSize}col`}
                  </span>
                  {!isMobile && (
                    <>
                      <button onClick={() => changePanelSize(panelId, -1)} disabled={panelSize <= 1} title="Reducir ancho" style={{ background: panelSize > 1 ? '#4CAF50' : '#e0e0e0', border: 'none', borderRadius: '4px', padding: '4px 6px', cursor: panelSize > 1 ? 'pointer' : 'not-allowed', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minimize2 size={12} /></button>
                      <button onClick={() => changePanelSize(panelId, 1)} disabled={panelSize >= 4} title="Aumentar ancho" style={{ background: panelSize < 4 ? '#4CAF50' : '#e0e0e0', border: 'none', borderRadius: '4px', padding: '4px 6px', cursor: panelSize < 4 ? 'pointer' : 'not-allowed', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Maximize2 size={12} /></button>
                      <div style={{ width: '1px', height: '20px', background: '#e0e0e0', margin: '0 2px' }} />
                    </>
                  )}
                  <button
                    onClick={() => movePanelUp(panelId)}
                    disabled={!canMoveUp}
                    title="Mover arriba"
                    style={{
                      background: canMoveUp ? '#667eea' : '#e0e0e0',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      cursor: canMoveUp ? 'pointer' : 'not-allowed',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    onClick={() => movePanelDown(panelId)}
                    disabled={!canMoveDown}
                    title="Mover abajo"
                    style={{
                      background: canMoveDown ? '#667eea' : '#e0e0e0',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      cursor: canMoveDown ? 'pointer' : 'not-allowed',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
              </div>

              {arEnabled && (currentModelUrl || hotspots.length > 0 || primitives.length > 0 || lightMode) ? (
                <div style={{
                  flex: 1,
                  minHeight: '0',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px'
                }}>
                  <div style={{
                    width: '280px',
                    maxWidth: '100%',
                    background: '#000',
                    borderRadius: '40px',
                    border: '8px solid #111',
                    aspectRatio: '9/20',
                    overflow: 'hidden',
                    position: 'relative',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    {/* Notch del teléfono */}
                    <div style={{
                      width: '150px',
                      height: '24px',
                      background: '#000',
                      borderRadius: '0 0 20px 20px',
                      margin: '0 auto',
                      position: 'absolute',
                      top: 0,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      zIndex: 10
                    }} />

                    {/* Screen del teléfono con simulación AR */}
                    <div style={{
                      flex: 1,
                      width: '100%',
                      background: '#0a0a0a',
                      paddingTop: '8px',
                      overflow: 'hidden'
                    }}>
                      <Canvas
                        style={{ width: '100%', height: '100%', background: 'transparent' }}
                        camera={{
                          position: [0, 1.6, 0],
                          fov: 75,
                          near: 0.1,
                          far: 1000
                        }}
                      >
                        <Suspense fallback={null}>
                          <ARScene
                            attraction={{
                              id: 'preview-mobile',
                              name: selectedAttraction?.name || 'Preview',
                              lat: selectedAttraction?.lat || 0,
                              lng: selectedAttraction?.lng || 0,
                              ar_model_url: currentModelUrl,
                              ar_hotspots: {
                                hotspots: hotspots as ARHotspot[],
                                primitives: primitives,
                                modelTransform: modelTransform,
                                phonePreview: phonePreview
                              },
                              has_ar_content: true
                            }}
                            showGrid={false}
                            phonePreview={phonePreview}
                          />
                        </Suspense>
                      </Canvas>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#999',
                  textAlign: 'center'
                }}>
                  <div>
                    <Box size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>
                      Vista previa en formato móvil 9:20
                    </p>
                  </div>
                </div>
              )}

              <div style={{
                marginTop: '12px',
                padding: '10px',
                background: '#fff3e0',
                borderRadius: '6px',
                fontSize: '0.75rem',
                color: '#e65100'
              }}>
                📐 Aspecto 9:20 (portrait). Calibración independiente.
              </div>
            </div>
              ); // Fin panel mobile

              // Default (no debería llegar aquí)
              return null;
            })}

          </div>
        )}



        {/* Modal QR Global */}
        {qrModalOpen && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}>
            <div style={{
              width: 'min(600px, 95%)',
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#1A3A6C' }}>
                  Código QR — {selectedAttraction?.name}
                </h2>
                <button
                  onClick={() => { setQrModalOpen(false); setQrDataUrl(''); }}
                  style={{
                    background: '#f0f0f0',
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '1rem'
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                <div style={{
                  background: '#fafafa',
                  padding: '16px',
                  borderRadius: '8px',
                  flex: '0 0 280px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {qrDataUrl ? (
                    <Image src={qrDataUrl} alt="QR" width={250} height={250} unoptimized style={{ display: 'block' }} />
                  ) : (
                    <div style={{ width: 250, height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                      Generando…
                    </div>
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 16px', fontSize: '0.95rem', color: '#333' }}>
                    Escanea este código QR con tu dispositivo móvil para acceder a la experiencia de realidad aumentada. Puedes descargarlo o imprimirlo.
                  </p>

                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => {
                        if (!qrDataUrl) return;
                        const a = document.createElement('a');
                        a.href = qrDataUrl;
                        a.download = `${selectedAttraction?.id || 'qr'}.png`;
                        a.click();
                      }}
                      style={{
                        background: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        padding: '10px 16px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: '600'
                      }}
                    >
                      📥 Descargar PNG
                    </button>

                    <button
                      onClick={() => {
                        if (!qrDataUrl) return;
                        const w = window.open('');
                        if (!w) return alert('No se pudo abrir ventana de impresión');
                        w.document.write(`<html><head><title>${selectedAttraction?.name} - QR</title></head><body style="margin:0;padding:20px;display:flex;align-items:center;justify-content:center;height:100vh;"><img src="${qrDataUrl}" style="width:400px;height:400px;"/></body></html>`);
                        w.document.close();
                        w.setTimeout(() => w.print(), 200);
                      }}
                      style={{
                        background: '#1976d2',
                        color: 'white',
                        border: 'none',
                        padding: '10px 16px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: '600'
                      }}
                    >
                      🖨️ Imprimir
                    </button>

                    <button
                      onClick={() => {
                        if (!selectedAttraction) return;
                        const url = `${window.location.origin}/ar/${selectedAttraction.id}?qr=${encodeURIComponent(qrCode || `AR_${selectedAttraction.id}`)}`;
                        window.open(url, '_blank');
                      }}
                      style={{
                        background: '#f0f0f0',
                        border: '1px solid #ddd',
                        padding: '10px 16px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: '600'
                      }}
                    >
                      🔗 Abrir en nueva pestaña
                    </button>
                  </div>

                  <div style={{
                    background: '#e3f2fd',
                    padding: '12px',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    color: '#1976d2'
                  }}>
                    <strong>URL del AR:</strong>
                    <div style={{ wordBreak: 'break-all', marginTop: '4px', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {`${window.location.origin}/ar/${selectedAttraction?.id}?qr=${encodeURIComponent(qrCode || `AR_${selectedAttraction?.id}`)}`}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}