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

  useEffect(() => {
    loadAttractions();
  }, []);

  useEffect(() => {
    if (selectedAttraction) {
      setArEnabled(selectedAttraction.has_ar_content || false);
      setModelUrl(selectedAttraction.ar_model_url || '');
      setQrCode(selectedAttraction.qr_code || `AR_${selectedAttraction.id}`);
      
      const savedHotspots = selectedAttraction.ar_hotspots?.hotspots || [];
      const savedPrimitives = (selectedAttraction.ar_hotspots as { primitives?: Primitive[] } | undefined)?.primitives || [];
      setHotspots(savedHotspots);
      setPrimitives(savedPrimitives);
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

  const updateHotspot = (id: string, field: string, value: string) => {
    setHotspots(hotspots.map(h => 
      h.id === id ? { ...h, [field]: value } : h
    ));
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

        <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '20px' }}>
          {/* Lista de Atractivos */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            maxHeight: 'calc(100vh - 180px)',
            overflowY: 'auto'
          }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '1.25rem', color: '#1A3A6C' }}>
              Atractivos
            </h2>

            {loading ? (
              <p style={{ textAlign: 'center', color: '#666' }}>Cargando...</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {attractions.map(attraction => (
                  <button
                    key={attraction.id}
                    onClick={() => setSelectedAttraction(attraction)}
                    style={{
                      background: selectedAttraction?.id === attraction.id ? '#667eea' : '#f8f9fa',
                      color: selectedAttraction?.id === attraction.id ? 'white' : '#333',
                      border: 'none',
                      padding: '12px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {attraction.has_ar_content ? (
                      <Eye size={16} style={{ color: selectedAttraction?.id === attraction.id ? 'white' : '#4CAF50' }} />
                    ) : (
                      <EyeOff size={16} style={{ color: selectedAttraction?.id === attraction.id ? 'white' : '#999' }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                        {attraction.name}
                      </div>
                      <div style={{ 
                        fontSize: '0.75rem', 
                        opacity: 0.8,
                        marginTop: '2px'
                      }}>
                        {attraction.category || 'Sin categoría'}
                      </div>
                    </div>
                    {attraction.has_ar_content && (
                      <Box size={16} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Panel de Configuración */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            maxHeight: 'calc(100vh - 180px)',
            overflowY: 'auto'
          }}>
            {!selectedAttraction ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '60px 20px',
                color: '#999'
              }}>
                <Box size={64} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>
                  Selecciona un atractivo
                </h3>
                <p style={{ margin: '8px 0 0' }}>
                  Elige un lugar de la lista para configurar su contenido AR
                </p>
              </div>
            ) : (
              <>
                {/* Header del atractivo seleccionado */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '24px',
                  paddingBottom: '16px',
                  borderBottom: '2px solid #f0f0f0'
                }}>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#1A3A6C' }}>
                      {selectedAttraction.name}
                    </h2>
                    <p style={{ margin: '4px 0 0', color: '#666', fontSize: '0.9rem' }}>
                      {selectedAttraction.description}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => setArEnabled(!arEnabled)}
                    style={{
                      background: arEnabled ? '#4CAF50' : '#999',
                      color: 'white',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.2s'
                    }}
                  >
                    {arEnabled ? <Eye size={18} /> : <EyeOff size={18} />}
                    {arEnabled ? 'AR Activo' : 'AR Inactivo'}
                  </button>
                </div>

                {arEnabled && (
                  <>
                    {/* Modelo 3D */}
                    <div style={{ marginBottom: '24px' }}>
                      <h3 style={{ 
                        margin: '0 0 12px', 
                        fontSize: '1.1rem',
                        color: '#1A3A6C',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <Box size={20} />
                        Modelo 3D
                      </h3>

                      <div style={{
                        background: '#f8f9fa',
                        padding: '16px',
                        borderRadius: '10px'
                      }}>
                        <label style={{ 
                          display: 'block', 
                          marginBottom: '8px',
                          fontWeight: '500',
                          fontSize: '0.9rem'
                        }}>
                          URL del Modelo (.glb, .gltf)
                        </label>
                        <input
                          type="text"
                          value={modelUrl}
                          onChange={(e) => setModelUrl(e.target.value)}
                          placeholder="https://example.com/model.glb"
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: '2px solid #ddd',
                            borderRadius: '8px',
                            fontSize: '0.9rem',
                            marginBottom: '12px'
                          }}
                        />

                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '12px',
                          marginTop: '12px',
                          flexWrap: 'wrap'
                        }}>
                          <span style={{ color: '#666', fontSize: '0.9rem' }}>O subir archivo:</span>
                          <label style={{
                            background: '#667eea',
                            color: 'white',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            display: 'flex',
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

                          {/* Toggle modo ligero */}
                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.8rem',
                            background: lightMode ? '#e3f2fd' : 'transparent',
                            padding: '6px 10px',
                            borderRadius: '20px',
                            border: '1px solid #bbb',
                            cursor: 'pointer'
                          }}>
                            <input
                              type="checkbox"
                              checked={lightMode}
                              onChange={(e) => setLightMode(e.target.checked)}
                              style={{ cursor: 'pointer' }}
                            />
                            <span><strong>Modo ligero</strong> (sin cargar modelo 3D)</span>
                          </label>
                        </div>

                        {modelUrl && (
                          <div style={{
                            marginTop: '12px',
                            padding: '8px 12px',
                            background: '#e3f2fd',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            color: '#1976d2'
                          }}>
                            ✓ Modelo configurado
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Código QR */}
                    <div style={{ marginBottom: '24px' }}>
                      <h3 style={{ 
                        margin: '0 0 12px', 
                        fontSize: '1.1rem',
                        color: '#1A3A6C',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <MapPin size={20} />
                        Código QR
                      </h3>

                      <div style={{
                        background: '#f8f9fa',
                        padding: '16px',
                        borderRadius: '10px'
                      }}>
                        <label style={{ 
                          display: 'block', 
                          marginBottom: '8px',
                          fontWeight: '500',
                          fontSize: '0.9rem'
                        }}>
                          Código Identificador
                        </label>
                        <input
                          type="text"
                          value={qrCode}
                          onChange={(e) => setQrCode(e.target.value)}
                          placeholder="AR_12345"
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: '2px solid #ddd',
                            borderRadius: '8px',
                            fontSize: '0.9rem',
                            marginBottom: '12px'
                          }}
                        />
                        <p style={{ 
                          margin: '0 0 16px', 
                          fontSize: '0.8rem', 
                          color: '#666' 
                        }}>
                          Este código se usará para identificar el lugar al escanear QR
                        </p>

                        {/* Vista previa del QR Code */}
                        {qrCode && (
                          <div style={{
                            background: 'white',
                            padding: '20px',
                            borderRadius: '10px',
                            textAlign: 'center',
                            border: '2px solid #e0e0e0'
                          }}>
                            <p style={{ 
                              margin: '0 0 12px', 
                              fontWeight: '600',
                              fontSize: '0.9rem',
                              color: '#1A3A6C'
                            }}>
                              Código QR para {selectedAttraction.name}
                            </p>
                            
                            {/* QR Code usando API gratuita */}
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}`}
                              alt="QR Code"
                              style={{
                                width: '250px',
                                height: '250px',
                                margin: '0 auto',
                                display: 'block',
                                border: '2px solid #ddd',
                                borderRadius: '8px',
                                padding: '10px',
                                background: 'white'
                              }}
                            />
                            
                            <p style={{
                              margin: '12px 0',
                              fontSize: '0.85rem',
                              color: '#666',
                              fontFamily: 'monospace',
                              background: '#f0f0f0',
                              padding: '8px',
                              borderRadius: '6px'
                            }}>
                              {qrCode}
                            </p>

                            {/* Botones de acción */}
                            <div style={{
                              display: 'flex',
                              gap: '8px',
                              marginTop: '16px',
                              justifyContent: 'center'
                            }}>
                              <a
                                href={`https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(qrCode)}`}
                                download={`qr-${qrCode}.png`}
                                style={{
                                  background: '#4CAF50',
                                  color: 'white',
                                  padding: '10px 20px',
                                  borderRadius: '8px',
                                  textDecoration: 'none',
                                  fontSize: '0.85rem',
                                  fontWeight: '600',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  cursor: 'pointer'
                                }}
                              >
                                📥 Descargar QR
                              </a>
                              
                              <button
                                onClick={() => {
                                  const printWindow = window.open('', '_blank');
                                  if (printWindow) {
                                    printWindow.document.write(`
                                      <html>
                                        <head>
                                          <title>QR Code - ${selectedAttraction.name}</title>
                                          <style>
                                            body {
                                              display: flex;
                                              flex-direction: column;
                                              align-items: center;
                                              justify-content: center;
                                              min-height: 100vh;
                                              margin: 0;
                                              font-family: Arial, sans-serif;
                                            }
                                            h1 {
                                              margin-bottom: 20px;
                                              text-align: center;
                                            }
                                            img {
                                              max-width: 400px;
                                              border: 2px solid #000;
                                              padding: 20px;
                                              background: white;
                                            }
                                            .code {
                                              margin-top: 20px;
                                              font-family: monospace;
                                              font-size: 18px;
                                              font-weight: bold;
                                            }
                                            @media print {
                                              body { margin: 0; }
                                            }
                                          </style>
                                        </head>
                                        <body>
                                          <h1>${selectedAttraction.name}</h1>
                                          <img src="https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(qrCode)}" />
                                          <p class="code">${qrCode}</p>
                                          <p style="margin-top: 20px; text-align: center;">Escanea este código QR para ver en Realidad Aumentada</p>
                                          <script>
                                            window.onload = function() {
                                              setTimeout(function() {
                                                window.print();
                                              }, 500);
                                            };
                                          </script>
                                        </body>
                                      </html>
                                    `);
                                    printWindow.document.close();
                                  }
                                }}
                                style={{
                                  background: '#2196F3',
                                  color: 'white',
                                  padding: '10px 20px',
                                  borderRadius: '8px',
                                  border: 'none',
                                  fontSize: '0.85rem',
                                  fontWeight: '600',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  cursor: 'pointer'
                                }}
                              >
                                🖨️ Imprimir QR
                              </button>
                            </div>

                            <div style={{
                              marginTop: '16px',
                              padding: '12px',
                              background: '#fff3cd',
                              borderRadius: '8px',
                              fontSize: '0.8rem',
                              color: '#856404',
                              textAlign: 'left'
                            }}>
                              <strong>💡 Instrucciones:</strong>
                              <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
                                <li>Descarga o imprime este código QR</li>
                                <li>Colócalo en un lugar visible en el atractivo turístico</li>
                                <li>Los visitantes podrán escanearlo para ver contenido AR</li>
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Hotspots */}
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '12px'
                      }}>
                        <h3 style={{ 
                          margin: 0, 
                          fontSize: '1.1rem',
                          color: '#1A3A6C',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <ImageIcon size={20} />
                          Puntos de Interés ({hotspots.length})
                        </h3>
                        <button
                          onClick={addHotspot}
                          style={{
                            background: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Plus size={16} />
                          Agregar
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {hotspots.map((hotspot) => (
                          <div
                            key={hotspot.id}
                            style={{
                              background: '#f8f9fa',
                              padding: '16px',
                              borderRadius: '10px',
                              border: '2px solid #e0e0e0'
                            }}
                          >
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '12px'
                            }}>
                                <input
                                  type="text"
                                  value={hotspot.title || ''}
                                onChange={(e) => updateHotspot(hotspot.id, 'title', e.target.value)}
                                style={{
                                  flex: 1,
                                  padding: '8px',
                                  border: '1px solid #ddd',
                                  borderRadius: '6px',
                                  fontWeight: '600',
                                  fontSize: '0.95rem'
                                }}
                                placeholder="Título del punto"
                              />
                              <button
                                onClick={() => removeHotspot(hotspot.id)}
                                style={{
                                  background: '#f44336',
                                  color: 'white',
                                  border: 'none',
                                  padding: '8px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  marginLeft: '8px'
                                }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>

                              <textarea
                                value={hotspot.description || ''}
                              onChange={(e) => updateHotspot(hotspot.id, 'description', e.target.value)}
                              style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #ddd',
                                borderRadius: '6px',
                                fontSize: '0.85rem',
                                minHeight: '60px',
                                marginBottom: '12px',
                                resize: 'vertical'
                              }}
                              placeholder="Descripción del punto de interés"
                            />

                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: '12px',
                              marginBottom: '12px'
                            }}>
                              <div>
                                <label style={{ fontSize: '0.8rem', color: '#666', display: 'block', marginBottom: '4px' }}>
                                  Tipo
                                </label>
                                <select
                                  value={hotspot.type || 'info'}
                                  onChange={(e) => updateHotspot(hotspot.id, 'type', e.target.value)}
                                  style={{
                                    width: '100%',
                                    padding: '8px',
                                    border: '1px solid #ddd',
                                    borderRadius: '6px',
                                    fontSize: '0.85rem'
                                  }}
                                >
                                  <option value="info">Información</option>
                                  <option value="image">Imagen</option>
                                  <option value="video">Video</option>
                                </select>
                              </div>

                              {(hotspot.type === 'image' || hotspot.type === 'video') && (
                                <div>
                                  <label style={{ fontSize: '0.8rem', color: '#666', display: 'block', marginBottom: '4px' }}>
                                    Subir Archivo
                                  </label>
                                  <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '8px',
                                    background: '#667eea',
                                    color: 'white',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    gap: '4px'
                                  }}>
                                    <Upload size={14} />
                                    Subir
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
                                </div>
                              )}
                            </div>

                            {/* URL de contenido multimedia */}
                            {(hotspot.type === 'image' || hotspot.type === 'video') && (
                              <div style={{ marginBottom: '12px' }}>
                                <label style={{ 
                                  fontSize: '0.8rem', 
                                  color: '#666', 
                                  display: 'block', 
                                  marginBottom: '4px' 
                                }}>
                                  O ingresar URL
                                </label>
                                <input
                                  type="text"
                                  value={hotspot.content_url || ''}
                                  onChange={(e) => updateHotspot(hotspot.id, 'content_url', e.target.value)}
                                  placeholder={hotspot.type === 'image' ? 'https://ejemplo.com/imagen.jpg' : 'https://ejemplo.com/video.mp4'}
                                  style={{
                                    width: '100%',
                                    padding: '8px',
                                    border: '1px solid #ddd',
                                    borderRadius: '6px',
                                    fontSize: '0.85rem'
                                  }}
                                />
                                <p style={{ 
                                  margin: '4px 0 0', 
                                  fontSize: '0.7rem', 
                                  color: '#999' 
                                }}>
                                  {hotspot.type === 'image' ? 'URL de la imagen (JPG, PNG, GIF)' : 'URL del video (MP4, YouTube, Vimeo)'}
                                </p>
                              </div>
                            )}

                            {hotspot.content_url && (
                              <div style={{
                                padding: '10px',
                                background: '#e8f5e9',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                color: '#2e7d32',
                                marginBottom: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}>
                                <span>✓ Contenido cargado</span>
                                {hotspot.type === 'image' && (
                                  <img 
                                    src={hotspot.content_url} 
                                    alt="Preview" 
                                    style={{ 
                                      width: '40px', 
                                      height: '40px', 
                                      objectFit: 'cover', 
                                      borderRadius: '4px',
                                      border: '1px solid #81c784'
                                    }} 
                                  />
                                )}
                                {hotspot.type === 'video' && (
                                  <span style={{ 
                                    fontSize: '0.7rem', 
                                    background: '#fff',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontFamily: 'monospace'
                                  }}>
                                    🎬 {hotspot.content_url.substring(0, 30)}...
                                  </span>
                                )}
                              </div>
                            )}

                            <div>
                              <label style={{ fontSize: '0.8rem', color: '#666', display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                                Posición 3D (X, Y, Z)
                              </label>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                                <div>
                                  <label style={{ fontSize: '0.7rem', color: '#999', display: 'block', marginBottom: '2px' }}>X</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={hotspot.position?.x ?? 0}
                                    onChange={(e) => updateHotspotPosition(hotspot.id, 'x', parseFloat(e.target.value))}
                                    style={{
                                      width: '100%',
                                      padding: '6px',
                                      border: '1px solid #ddd',
                                      borderRadius: '6px',
                                      fontSize: '0.85rem'
                                    }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '0.7rem', color: '#999', display: 'block', marginBottom: '2px' }}>Y</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={hotspot.position?.y ?? 0}
                                    onChange={(e) => updateHotspotPosition(hotspot.id, 'y', parseFloat(e.target.value))}
                                    style={{
                                      width: '100%',
                                      padding: '6px',
                                      border: '1px solid #ddd',
                                      borderRadius: '6px',
                                      fontSize: '0.85rem'
                                    }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '0.7rem', color: '#999', display: 'block', marginBottom: '2px' }}>Z</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={hotspot.position?.z ?? 0}
                                    onChange={(e) => updateHotspotPosition(hotspot.id, 'z', parseFloat(e.target.value))}
                                    style={{
                                      width: '100%',
                                      padding: '6px',
                                      border: '1px solid #ddd',
                                      borderRadius: '6px',
                                      fontSize: '0.85rem'
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                        {hotspots.length === 0 && (
                          <p style={{ 
                            textAlign: 'center', 
                            color: '#999', 
                            padding: '20px',
                            background: '#f8f9fa',
                            borderRadius: '10px'
                          }}>
                            No hay puntos de interés. Haz clic en &quot;Agregar&quot; para crear uno.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Vista Previa 3D */}
                    {arEnabled && (modelUrl || hotspots.length > 0 || primitives.length > 0 || lightMode) && (
                      <div style={{ marginBottom: '24px' }}>
                        <h3 style={{ 
                          margin: '0 0 12px', 
                          fontSize: '1.1rem',
                          color: '#1A3A6C',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          👁️ Vista Previa 3D
                        </h3>
                        
                        <div style={{
                          background: '#f8f9fa',
                          padding: '16px',
                          borderRadius: '10px'
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
                              console.log('Guardando transformación del modelo:', transform);
                              // Aquí podrías guardar en la base de datos si es necesario
                            }}
                            onPrimitivesChange={setPrimitives}
                          />
                          
                          <div style={{
                            marginTop: '12px',
                            padding: '12px',
                            background: '#e3f2fd',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            color: '#1976d2'
                          }}>
                            <strong>💡 Consejo:</strong> Usa los controles para rotar y hacer zoom. 
                            Los puntos de colores representan tus hotspots. Ajusta las coordenadas 
                            X, Y, Z en los controles de arriba si necesitas reposicionarlos.
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Botones de acción */}
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  marginTop: '24px',
                  paddingTop: '24px',
                  borderTop: '2px solid #f0f0f0'
                }}>
                  <button
                    onClick={saveARConfiguration}
                    disabled={saving}
                    style={{
                      flex: 1,
                      background: '#4CAF50',
                      color: 'white',
                      border: 'none',
                      padding: '14px',
                      borderRadius: '10px',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      fontSize: '1rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      opacity: saving ? 0.6 : 1
                    }}
                  >
                    <Save size={20} />
                    {saving ? 'Guardando...' : 'Guardar Configuración'}
                  </button>

                  <button
                    onClick={() => setSelectedAttraction(null)}
                    style={{
                      background: '#999',
                      color: 'white',
                      border: 'none',
                      padding: '14px 24px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      fontWeight: '600'
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
