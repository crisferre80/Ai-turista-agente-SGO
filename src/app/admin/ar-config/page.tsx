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
import { Upload, Plus, Trash2, Image as ImageIcon, Box } from 'lucide-react';
import * as THREE from 'three';

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

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          background: 'white',
          padding: '24px',
          borderRadius: '16px',
          marginBottom: '20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}>
          <h1 style={{ margin: 0, fontSize: '2rem', color: '#1A3A6C' }}>
            🥽 Configuración de Realidad Aumentada
          </h1>
          <p style={{ margin: '8px 0 0', color: '#666' }}>
            Administra contenido AR para cada atractivo turístico
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 360px', gap: '20px', height: 'calc(100vh - 180px)' }}>
          {/* Columna Izquierda: Selector y Configuración Básica */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {/* Selector de Atractivos Compacto */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              maxHeight: '200px'
            }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '1rem', color: '#1A3A6C' }}>
                📍 Atractivo Actual
              </h3>
              
              {selectedAttraction ? (
                <div style={{
                  padding: '12px',
                  background: '#f0f7ff',
                  borderRadius: '8px',
                  border: '1px solid #667eea'
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
              ) : (
                <select
                  onChange={(e) => {
                    const attraction = attractions.find(a => a.id === e.target.value);
                    setSelectedAttraction(attraction || null);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '0.9rem'
                  }}
                >
                  <option value="">Seleccionar atractivo...</option>
                  {attractions.map(attraction => (
                    <option key={attraction.id} value={attraction.id}>
                      {attraction.name} {attraction.has_ar_content ? '(AR)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Configuración Básica */}
            {selectedAttraction && (
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                flex: 1,
                overflowY: 'auto'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px'
                }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', color: '#1A3A6C' }}>
                    ⚙️ Configuración
                  </h3>
                  <button
                    onClick={() => setArEnabled(!arEnabled)}
                    style={{
                      background: arEnabled ? '#4CAF50' : '#999',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: '600'
                    }}
                  >
                    {arEnabled ? 'AR ON' : 'AR OFF'}
                  </button>
                </div>

                {arEnabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Selector de modelo 3D */}
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500' }}>
                        Modelo 3D
                      </label>
                      <select
                        value={modelFileName}
                        onChange={(e) => {
                          setModelFileName(e.target.value);
                        }}
                        style={{
                          width: '100%',
                          padding: '6px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          backgroundColor: 'white'
                        }}
                      >
                        <option value="">Sin modelo 3D</option>
                        {availableModels.map(model => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Vista previa del modelo seleccionado */}
                    {modelFileName && (
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500' }}>
                          Vista Previa del Modelo
                        </label>
                        <div style={{
                          width: '100%',
                          height: '200px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          background: '#f8f9fa',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          overflow: 'hidden'
                        }}>
                          <ModelPreview url={currentModelUrl} />
                        </div>
                      </div>
                    )}

                    {/* Upload de archivo */}
                    <label style={{
                      background: '#667eea',
                      color: 'white',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}>
                      <Upload size={14} />
                      {uploadingModel ? 'Subiendo...' : 'Subir archivo'}
                      <input
                        type="file"
                        accept=".glb,.gltf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleModelFileUpload(file);
                        }}
                        style={{ display: 'none' }}
                        disabled={uploadingModel}
                      />
                    </label>

                    {/* Modo ligero */}
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={lightMode}
                        onChange={(e) => setLightMode(e.target.checked)}
                      />
                      Modo ligero (sin modelo)
                    </label>

                    {/* QR Code + Generador */}
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500' }}>
                        ID QR
                      </label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={qrCode}
                          onChange={(e) => setQrCode(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '6px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '0.8rem'
                          }}
                        />

                        <button
                          onClick={async () => {
                            // generar QR, persistir en DB y abrir modal
                            if (!selectedAttraction) return;

                            const qrValue = (qrCode || `AR_${selectedAttraction.id}`).trim();

                            try {
                              setGeneratingQr(true);

                              // 1) Generar data URL del QR
                              const url = `${window.location.origin}/ar/${selectedAttraction.id}?qr=${encodeURIComponent(qrValue)}`;
                              const QR = await import('qrcode');
                              const dataUrl = await QR.toDataURL(url, { margin: 2, scale: 8 });
                              setQrDataUrl(dataUrl);

                              // 2) Persistir qr_code en la DB (auto-save)
                              const { error: dbError } = await supabase
                                .from('attractions')
                                .update({ qr_code: qrValue })
                                .eq('id', selectedAttraction.id);

                              if (dbError) {
                                console.error('Error guardando QR en DB:', dbError);
                                alert('Error guardando el código QR en la base de datos');
                              } else {
                                // actualizar estado local para reflejar el cambio inmediatamente
                                setQrCode(qrValue);
                                setSelectedAttraction({ ...selectedAttraction, qr_code: qrValue });

                                // actualizar lista local (si existe)
                                setAttractions(prev => prev.map(a => a.id === selectedAttraction.id ? { ...a, qr_code: qrValue } : a));
                              }

                              // 3) abrir modal
                              setQrModalOpen(true);
                            } catch (err) {
                              console.error('Error generando QR:', err);
                              alert('No se pudo generar el código QR');
                            } finally {
                              setGeneratingQr(false);
                            }
                          }}
                          style={{
                            background: '#1976d2',
                            color: 'white',
                            border: 'none',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          {generatingQr ? 'Generando...' : 'Generar & Guardar'}
                        </button>
                      </div>

                      {/* Modal del QR (simple) */}
                      {qrModalOpen && (
                        <div style={{
                          position: 'fixed',
                          inset: 0,
                          background: 'rgba(0,0,0,0.4)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 60
                        }}>
                          <div style={{
                            width: 'min(520px, 95%)',
                            background: 'white',
                            borderRadius: '12px',
                            padding: '20px',
                            boxShadow: '0 8px 40px rgba(0,0,0,0.2)'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                              <h3 style={{ margin: 0, fontSize: '1rem' }}>Código QR — {selectedAttraction?.name}</h3>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  onClick={() => { setQrModalOpen(false); setQrDataUrl(''); }}
                                  style={{ background: 'transparent', border: '1px solid #ddd', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer' }}
                                >Cerrar</button>
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '16px', marginTop: '16px', alignItems: 'center' }}>
                              <div style={{ background: '#fafafa', padding: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {qrDataUrl ? (
                                  <Image src={qrDataUrl} alt="QR" width={220} height={220} unoptimized style={{ display: 'block' }} />
                                ) : (
                                  <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>Generando…</div>
                                )}
                              </div>

                              <div style={{ flex: 1 }}>
                                <p style={{ marginTop: 0 }}>
                                  Escanea este código para abrir la experiencia AR en el dispositivo. Puedes descargarlo o imprimirlo.
                                </p>

                                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                  <button
                                    onClick={() => {
                                      if (!qrDataUrl) return;
                                      const a = document.createElement('a');
                                      a.href = qrDataUrl;
                                      a.download = `${selectedAttraction?.id || 'qr'}.png`;
                                      a.click();
                                    }}
                                    style={{ background: '#4CAF50', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}
                                  >Descargar PNG</button>

                                  <button
                                    onClick={() => {
                                      if (!qrDataUrl) return;
                                      const w = window.open('');
                                      if (!w) return alert('No se pudo abrir ventana de impresión');
                                      w.document.write(`<img src="${qrDataUrl}" style="width:320px;height:320px;display:block;margin:auto;"/>`);
                                      w.document.title = `${selectedAttraction?.name} - QR`;
                                      w.document.close();
                                      w.focus();
                                      setTimeout(() => { w.print(); }, 200);
                                    }}
                                    style={{ background: '#1976d2', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}
                                  >Imprimir</button>

                                  <button
                                    onClick={() => {
                                      // Abrir URL (prueba rápida)
                                      if (!selectedAttraction) return;
                                      const url = `${window.location.origin}/ar/${selectedAttraction.id}?qr=${encodeURIComponent(qrCode || `AR_${selectedAttraction.id}`)}`;
                                      window.open(url, '_blank');
                                    }}
                                    style={{ background: '#eee', border: '1px solid #ddd', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}
                                  >Abrir en nueva pestaña</button>
                                </div>

                                <div style={{ marginTop: '12px', fontSize: '0.85rem', color: '#666' }}>
                                  <strong>URL codificada:</strong>
                                  <div style={{ wordBreak: 'break-all' }}>{`${window.location.origin}/ar/${selectedAttraction?.id}?qr=${encodeURIComponent(qrCode || `AR_${selectedAttraction?.id}`)}`}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Botón guardar */}
                    <button
                      onClick={saveARConfiguration}
                      disabled={saving}
                      style={{
                        background: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        padding: '10px',
                        borderRadius: '6px',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        marginTop: '8px',
                        opacity: saving ? 0.6 : 1
                      }}
                    >
                      {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Columna Central: Canvas 3D */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0
          }}>
            {!selectedAttraction ? (
              <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#999'
              }}>
                <Box size={64} style={{ margin: '0 0 16px', opacity: 0.3 }} />
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>
                  Selecciona un atractivo
                </h3>
                <p style={{ margin: '8px 0 0', textAlign: 'center' }}>
                  Elige un lugar para configurar su contenido AR
                </p>
              </div>
            ) : arEnabled && (currentModelUrl || hotspots.length > 0 || primitives.length > 0 || lightMode) ? (
              <>
                <h3 style={{ 
                  margin: '0 0 16px', 
                  fontSize: '1.1rem',
                  color: '#1A3A6C',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  👁️ Vista Previa 3D
                </h3>
                
                <div style={{ 
                  flex: 1,
                  minHeight: '400px',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  position: 'relative'
                }}>
                  <ARPreview3D
                    modelUrl={currentModelUrl}
                    modelTransform={modelTransform}
                    lightMode={lightMode}
                    phonePreview={phonePreview}
                    onPhonePreviewChange={handlePhonePreviewChange}
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
                
                <div style={{
                  marginTop: '12px',
                  padding: '12px',
                  background: '#e3f2fd',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  color: '#1976d2'
                }}>
                  <strong>💡 Consejo:</strong> Usa los controles para rotar y hacer zoom. 
                  Los puntos representan tus hotspots.
                </div>
              </>
            ) : (
              <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#999'
              }}>
                <Box size={48} style={{ margin: '0 0 16px', opacity: 0.3 }} />
                <h4 style={{ margin: 0, fontSize: '1rem' }}>
                  Canvas vacío
                </h4>
                <p style={{ margin: '8px 0 0', textAlign: 'center', fontSize: '0.9rem' }}>
                  Habilita AR y agrega un modelo o hotspots
                </p>
              </div>
            )}
          </div>

          {/* Columna Derecha: Herramientas y Controles */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {selectedAttraction && arEnabled && (
              <>
                {/* Herramientas de Hotspots */}
                <div style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  maxHeight: '400px',
                  overflowY: 'auto'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px'
                  }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: '#1A3A6C' }}>
                      📍 Hotspots ({hotspots.length})
                    </h3>
                    <button
                      onClick={addHotspot}
                      style={{
                        background: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Plus size={14} />
                      Agregar
                    </button>
                  </div>

                  {hotspots.map(hotspot => (
                    <div key={hotspot.id} style={{
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      padding: '12px',
                      marginBottom: '8px',
                      background: '#fafafa'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '8px'
                      }}>
                        <input
                          type="text"
                          value={hotspot.title}
                          onChange={(e) => updateHotspot(hotspot.id, { title: e.target.value })}
                          placeholder="Título del hotspot"
                          style={{
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            padding: '4px 6px',
                            fontSize: '0.85rem',
                            flex: 1,
                            marginRight: '8px'
                          }}
                        />
                        <button
                          onClick={() => removeHotspot(hotspot.id)}
                          style={{
                            background: '#ff5252',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px',
                            cursor: 'pointer',
                            color: 'white'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <select
                        value={hotspot.type}
                        onChange={(e) => updateHotspot(hotspot.id, { type: e.target.value as 'info' | 'image' | 'video' })}
                        style={{
                          width: '100%',
                          padding: '4px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          marginBottom: '8px'
                        }}
                      >
                        <option value="info">📄 Información</option>
                        <option value="image">🖼️ Imagen</option>
                        <option value="video">🎥 Video</option>
                      </select>

                      <div style={{ marginBottom: '8px' }}>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '0.8rem', 
                          fontWeight: 'bold', 
                          marginBottom: '4px',
                          color: '#333'
                        }}>
                          Posición:
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                          <input
                            type="number"
                            step="0.1"
                            value={hotspot.position?.x ?? 0}
                            onChange={(e) => updateHotspotPosition(hotspot.id, 'x', parseFloat(e.target.value))}
                            placeholder="X"
                            style={{
                              padding: '4px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              width: '100%',
                              boxSizing: 'border-box'
                            }}
                          />
                          <input
                            type="number"
                            step="0.1"
                            value={hotspot.position?.y ?? 0}
                            onChange={(e) => updateHotspotPosition(hotspot.id, 'y', parseFloat(e.target.value))}
                            placeholder="Y"
                            style={{
                              padding: '4px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              width: '100%',
                              boxSizing: 'border-box'
                            }}
                          />
                          <input
                            type="number"
                            step="0.1"
                            value={hotspot.position?.z ?? 0}
                            onChange={(e) => updateHotspotPosition(hotspot.id, 'z', parseFloat(e.target.value))}
                            placeholder="Z"
                            style={{
                              padding: '4px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              width: '100%',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                      </div>

                      <textarea
                        value={hotspot.description}
                        onChange={(e) => updateHotspot(hotspot.id, { description: e.target.value })}
                        placeholder="Descripción del hotspot"
                        rows={2}
                        style={{
                          width: '100%',
                          padding: '4px 6px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          resize: 'vertical',
                          fontFamily: 'inherit'
                        }}
                      />

                      {hotspot.type !== 'info' && (
                        <div style={{ marginTop: '8px' }}>
                          <label style={{
                            background: '#2196F3',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <ImageIcon size={12} />
                            Subir {hotspot.type === 'image' ? 'Imagen' : 'Video'}
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
                          {hotspot.content_url && (
                            <div style={{ marginTop: '4px', fontSize: '0.7rem', color: '#4CAF50' }}>
                              ✓ Contenido cargado
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {hotspots.length === 0 && (
                    <p style={{
                      textAlign: 'center',
                      color: '#999',
                      padding: '20px',
                      fontSize: '0.85rem'
                    }}>
                      No hay hotspots. Haz clic en &quot;Agregar&quot; para crear uno.
                    </p>
                  )}
                </div>

                {/* Configuraciones Avanzadas */}
                <div style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: '1rem', color: '#1A3A6C' }}>
                    ⚙️ Transformaciones del Modelo
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
                    <div>
                      <label>Posición del modelo:</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginTop: '4px' }}>
                        <span>X: {modelTransform.position.x.toFixed(2)}</span>
                        <span>Y: {modelTransform.position.y.toFixed(2)}</span>
                        <span>Z: {modelTransform.position.z.toFixed(2)}</span>
                      </div>
                    </div>

                    <div>
                      <label>Rotación del modelo:</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginTop: '4px' }}>
                        <span>X: {modelTransform.rotation.x.toFixed(2)}</span>
                        <span>Y: {modelTransform.rotation.y.toFixed(2)}</span>
                        <span>Z: {modelTransform.rotation.z.toFixed(2)}</span>
                      </div>
                    </div>

                    <div>
                      <label>Escala del modelo:</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginTop: '4px' }}>
                        <span>X: {modelTransform.scale.x.toFixed(2)}</span>
                        <span>Y: {modelTransform.scale.y.toFixed(2)}</span>
                        <span>Z: {modelTransform.scale.z.toFixed(2)}</span>
                      </div>
                    </div>

                    <div style={{
                      padding: '8px',
                      background: '#f0f7ff',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      color: '#1976d2'
                    }}>
                      💡 Las transformaciones se actualizan automáticamente
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}