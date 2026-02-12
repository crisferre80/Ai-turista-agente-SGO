"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { Upload, Save, X, Eye, EyeOff, Plus, Trash2, Image as ImageIcon, Box, MapPin } from 'lucide-react';

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
  ar_hotspots?: { hotspots: Hotspot[] };
  qr_code?: string;
}

interface Hotspot {
  id: string;
  position: { x: number; y: number; z: number };
  title: string;
  description: string;
  type: 'info' | 'image' | 'video';
  content_url?: string;
  scale?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingModel, setUploadingModel] = useState(false);
  
  // Estados del formulario AR
  const [arEnabled, setArEnabled] = useState(false);
  const [modelUrl, setModelUrl] = useState('');
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [primitives, setPrimitives] = useState<Primitive[]>([]);
  const [lightMode, setLightMode] = useState(false);
  const [qrCode, setQrCode] = useState('');
  
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

  useEffect(() => {
    loadAttractions();
  }, []);

  useEffect(() => {
    if (selectedAttraction) {
      setArEnabled(selectedAttraction.has_ar_content || false);
      setModelUrl(selectedAttraction.ar_model_url || '');
      setQrCode(selectedAttraction.qr_code || `AR_${selectedAttraction.id}`);
      
      const arData = selectedAttraction.ar_hotspots as any;
      const savedHotspots = arData?.hotspots || [];
      const savedPrimitives = arData?.primitives || [];
      const savedModelTransform = arData?.modelTransform;
      
      setHotspots(savedHotspots);
      setPrimitives(savedPrimitives);
      
      // Cargar transformaciones del modelo si existen
      if (savedModelTransform) {
        setModelTransform(savedModelTransform);
      } else {
        // Resetear a valores por defecto
        setModelTransform({
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        });
      }
    }
  }, [selectedAttraction]);

  const loadAttractions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('attractions')
        .select('*')
        .order('name');

      if (error) throw error;
      setAttractions(data || []);
    } catch (error) {
      console.error('Error cargando atractivos:', error);
    } finally {
      setLoading(false);
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

      const { data: { publicUrl } } = supabase.storage
        .from('ar-content')
        .getPublicUrl(filePath);

      setModelUrl(publicUrl);
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
      const fileName = `hotspot-${hotspotId}-${Date.now()}.${fileExt}`;
      const filePath = `ar-hotspots/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('ar-content')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('ar-content')
        .getPublicUrl(filePath);

      setHotspots(hotspots.map(h => 
        h.id === hotspotId ? { ...h, content_url: publicUrl } : h
      ));
    } catch (error) {
      console.error('Error subiendo imagen:', error);
      alert('Error al subir la imagen');
    }
  };

  const addHotspot = () => {
    const newHotspot: Hotspot = {
      id: `hotspot-${Date.now()}`,
      position: { x: 0, y: 1.5, z: -2 },
      title: 'Nuevo punto de interés',
      description: 'Descripción del punto',
      type: 'info',
      scale: { x: 1, y: 1, z: 1 },
      rotation: { x: 0, y: 0, z: 0 }
    };
    setHotspots([...hotspots, newHotspot]);
  };

  const updateHotspot = (id: string, updates: Partial<Hotspot>) => {
    setHotspots(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h));
  };

  const updateHotspotPosition = (id: string, axis: 'x' | 'y' | 'z', value: number) => {
    setHotspots(hotspots.map(h => {
      if (h.id !== id) return h;

      const safePosition = h.position || { x: 0, y: 0, z: 0 };
      return {
        ...h,
        position: {
          ...safePosition,
          [axis]: value
        }
      };
    }));
  };

  const removeHotspot = (id: string) => {
    setHotspots(hotspots.filter(h => h.id !== id));
  };

  const saveARConfiguration = async () => {
    if (!selectedAttraction) return;

    try {
      setSaving(true);

      const arData = {
        hotspots,
        primitives,
        modelTransform
      };

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
      alert('❌ Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
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
                    {/* URL del modelo */}
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500' }}>
                        Modelo 3D
                      </label>
                      <input
                        type="text"
                        value={modelUrl}
                        onChange={(e) => setModelUrl(e.target.value)}
                        placeholder="URL del modelo .glb/.gltf"
                        style={{
                          width: '100%',
                          padding: '6px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '0.8rem'
                        }}
                      />
                      <div style={{ marginTop: '8px' }}>
                        <label style={{
                          background: '#667eea',
                          color: 'white',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <Upload size={16} />
                          {uploadingModel ? 'Subiendo...' : 'Seleccionar archivo'}
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
                      </div>
                    </div>

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

                    {/* QR Code */}
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500' }}>
                        ID QR
                      </label>
                      <input
                        type="text"
                        value={qrCode}
                        onChange={(e) => setQrCode(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '0.8rem'
                        }}
                      />
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
            ) : arEnabled && (modelUrl || hotspots.length > 0 || primitives.length > 0 || lightMode) ? (
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
                    modelUrl={modelUrl || undefined}
                    lightMode={lightMode}
                    hotspots={hotspots}
                    primitives={primitives}
                    onHotspotPositionChange={(id, position) => {
                      setHotspots(prev => prev.map(h => 
                        h.id === id ? { ...h, position } : h
                      ));
                    }}
                    onHotspotScaleChange={(id, scale) => {
                      setHotspots(prev => prev.map(h => 
                        h.id === id ? { ...h, scale } : h
                      ));
                    }}
                    onHotspotRotationChange={(id, rotation) => {
                      setHotspots(prev => prev.map(h => 
                        h.id === id ? { ...h, rotation } : h
                      ));
                    }}
                    onModelTransformChange={(transform) => {
                      console.log('Actualizando transformación del modelo:', transform);
                      setModelTransform(transform);
                    }}
                    onPrimitivesChange={setPrimitives}
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

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginBottom: '8px' }}>
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
                            fontSize: '0.75rem'
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
                            fontSize: '0.75rem'
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
                            fontSize: '0.75rem'
                          }}
                        />
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
                      No hay hotspots. Haz clic en "Agregar" para crear uno.
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
                    ⚙️ Configuración Avanzada
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
                      💡 Las transformaciones del modelo se guardan automáticamente
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
