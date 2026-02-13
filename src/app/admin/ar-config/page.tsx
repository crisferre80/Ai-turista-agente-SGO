"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { Upload, Plus, Trash2, Image as ImageIcon, Box } from 'lucide-react';

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
  const [saving, setSaving] = useState(false);
  const [uploadingModel, setUploadingModel] = useState(false);
  
  // Estados del formulario AR
  const [arEnabled, setArEnabled] = useState(false);
  const [modelUrl, setModelUrl] = useState('');
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

  // Refs para garantizar que el guardado usa el último transform/primitives inmediatamente
  const latestModelTransformRef = React.useRef(modelTransform);
  const latestPrimitivesRef = React.useRef<Primitive[]>([]);

  useEffect(() => {
    loadAttractions();
  }, []);

  useEffect(() => {
    if (selectedAttraction) {
      setArEnabled(selectedAttraction.has_ar_content || false);
      setModelUrl(selectedAttraction.ar_model_url || '');
      setQrCode(selectedAttraction.qr_code || `AR_${selectedAttraction.id}`);
      
      const arData = selectedAttraction.ar_hotspots as { 
        hotspots?: Hotspot[]; 
        primitives?: Primitive[]; 
        modelTransform?: typeof modelTransform 
      } | null;
      const savedHotspots = arData?.hotspots || [];
      const savedPrimitives = arData?.primitives || [];
      const savedModelTransform = arData?.modelTransform;
      
      setHotspots(savedHotspots);
      setPrimitives(savedPrimitives);
      latestPrimitivesRef.current = savedPrimitives;
      
      // Cargar transformaciones del modelo si existen
      if (savedModelTransform) {
        setModelTransform(savedModelTransform);
        latestModelTransformRef.current = savedModelTransform;
      } else {
        // Resetear a valores por defecto
        const defaultTransform = {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        };
        setModelTransform(defaultTransform);
        latestModelTransformRef.current = defaultTransform;
      }
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

      const arData = {
        hotspots,
        primitives: latestPrimitivesRef.current || primitives,
        modelTransform: latestModelTransformRef.current || modelTransform
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
                    </div>

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
                                  <img src={qrDataUrl} alt="QR" style={{ width: 220, height: 220, display: 'block' }} />
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
                      latestModelTransformRef.current = transform;
                    }}
                    onPrimitivesChange={(p) => { setPrimitives(p); latestPrimitivesRef.current = p; }}
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