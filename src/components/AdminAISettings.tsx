"use client";
import React, { useEffect, useState } from 'react';

type Settings = {
  ia_provider?: 'gemini' | 'openai' | 'huggingface';
  ia_model?: string;
  tts_provider?: 'browser' | 'openai' | 'google' | 'coqui' | 'other';
  tts_engine?: string;
  tts_voice_gender?: 'MALE' | 'FEMALE';
  tts_voice_name_es?: string;
  tts_voice_name_en?: string;
  tts_voice_name_pt?: string;
  tts_voice_name_fr?: string;
  google_tts_api_key?: string;
};

export default function AdminAISettings() {
  type TTSVoice = { name: string; languageCodes?: string[]; ssmlGender?: string; naturalSampleRateHertz?: number };

  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Voices for browser TTS
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [openaiVoices, setOpenaiVoices] = useState<TTSVoice[]>([]);
  const [googleVoices, setGoogleVoices] = useState<TTSVoice[]>([]);
  const [showGoogleKey, setShowGoogleKey] = useState(false);

  // TTS Voice Selector by Language and Gender
  const [voiceGenderFilter, setVoiceGenderFilter] = useState<'MALE' | 'FEMALE'>('MALE');
  const [expandedLanguage, setExpandedLanguage] = useState<string | null>(null);
  const [voicesByLanguage, setVoicesByLanguage] = useState<Record<string, TTSVoice[]>>({});

  // Models listing
  type ModelInfo = { name: string; displayName?: string; description?: string; provider?: string; is_free?: boolean; pricing?: string; tier?: string };
  type RawModel = { name: string; displayName?: string; description?: string; provider?: string; is_free?: boolean; pricing?: string; tier?: string };
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  async function listModels() {
    setModelsLoading(true);
    setModels([]);
    setMessage(null);
    try {
      const provider = settings.ia_provider ?? 'gemini';
      const url = `/api/admin/${provider}/models`;
      const res = await fetch(url);
      const body = await res.json();
      
      // Always process the response, even if there are warnings
      const normalized = (body.models || []).map((m: RawModel) => ({
        name: m.name,
        displayName: m.displayName || m.name,
        description: m.description || m.displayName || '',
        provider: body.provider || provider,
        is_free: (typeof m.is_free === 'boolean') ? m.is_free : (m.pricing === 'free' || m.pricing === 'unknown' ? false : false)
      }));
      
      setModels(normalized);
      
      // Show warnings or errors as messages instead of alerts
      if (body.warning) {
        setMessage(`⚠️ ${body.warning}`);
      } else if (body.error) {
        setMessage(`❌ ${body.error}`);
      } else if (body.success) {
        setMessage(`✅ ${normalized.length} modelos cargados desde ${provider.toUpperCase()}`);
      } else {
        setMessage(`📋 ${normalized.length} modelos disponibles para ${provider.toUpperCase()}`);
      }
      
      if (normalized.length === 0 && !body.warning && !body.error) {
        setMessage(`⚠️ No se encontraron modelos para ${provider}`);
      }
    } catch (e) {
      console.error('List models error', e);
      setMessage(`❌ Error al conectar con ${settings.ia_provider}: ${e instanceof Error ? e.message : 'Error desconocido'}`);
    } finally {
      setModelsLoading(false);
      // Clear message after 5 seconds
      setTimeout(() => setMessage(null), 5000);
    }
  }

  async function listAllModels() {
    setModelsLoading(true);
    setModels([]);
    setMessage(null);
    try {
      const providers = ['gemini', 'openai', 'huggingface'];
      const allModels: ModelInfo[] = [];
      const warnings: string[] = [];
      const errors: string[] = [];
      
      for (const provider of providers) {
        try {
          const res = await fetch(`/api/admin/${provider}/models`);
          const body = await res.json();
          
          const normalized = (body.models || []).map((m: RawModel) => ({
            name: m.name,
            displayName: m.displayName || m.name,
            description: m.description || m.displayName || '',
            provider: provider,
            is_free: (typeof m.is_free === 'boolean') ? m.is_free : (m.pricing === 'free' || m.tier === 'free')
          }));
          
          allModels.push(...normalized);
          
          if (body.warning) {
            warnings.push(`${provider.toUpperCase()}: ${body.warning}`);
          }
          if (body.error && !body.models?.length) {
            errors.push(`${provider.toUpperCase()}: ${body.error}`);
          }
        } catch (e) {
          console.warn(`Failed to load ${provider} models:`, e);
          errors.push(`${provider.toUpperCase()}: Error de conexión`);
        }
      }
      
      setModels(allModels);
      
      // Show comprehensive status message
      let message = `📋 ${allModels.length} modelos cargados`;
      if (warnings.length > 0) {
        message += `\n⚠️ Advertencias:\n${warnings.join('\n')}`;
      }
      if (errors.length > 0) {
        message += `\n❌ Errores:\n${errors.join('\n')}`;
      }
      
      setMessage(message);
      
      if (allModels.length === 0) {
        setMessage('❌ No se pudieron cargar modelos de ningún proveedor');
      }
    } catch (e) {
      console.error('List all models error', e);
      setMessage(`❌ Error general: ${e instanceof Error ? e.message : 'Error desconocido'}`);
    } finally {
      setModelsLoading(false);
      // Clear message after 7 seconds for longer messages
      setTimeout(() => setMessage(null), 7000);
    }
  }

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(d => setSettings(d?.settings ?? {}))
      .catch(e => console.error('AdminAISettings fetch error', e))
      .finally(() => setLoading(false));

    // Populate browser voices if available
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const populateVoices = () => {
        const v = window.speechSynthesis.getVoices();
        setBrowserVoices(v);
      };
      populateVoices();
      window.speechSynthesis.onvoiceschanged = populateVoices;
      return () => { window.speechSynthesis.onvoiceschanged = null; };
    }
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const body = await res.json();
      if (!res.ok) {
        const errMsg = body?.error || body?.message || 'Save failed';
        setMessage('Error: ' + errMsg);
        throw new Error(errMsg);
      }
      setMessage('Guardado');
    } catch (err) {
      console.error('AdminAISettings save error', err);
      setMessage('Error al guardar');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 2500);
    }
  }

  return (
    <div style={{ padding: 12, maxWidth: 720 }}>
      <h3>Configuración de IA y TTS</h3>
      {loading ? <div>Cargando...</div> : (
        <>
          <div style={{ marginBottom: 8 }}>
            <label>Proveedor IA</label><br />
            <select value={settings.ia_provider ?? 'gemini'} onChange={e => setSettings({ ...settings, ia_provider: e.target.value as 'gemini' | 'openai' })}>
              <option value="gemini">Gemini (Google)</option>
              <option value="openai">OpenAI</option>
              <option value="huggingface">HuggingFace (open-source)</option>
            </select>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label>Modelo IA</label><br />

            {/* Enhanced model selection interface */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <input 
                value={settings.ia_model ?? ''} 
                onChange={e => setSettings({ ...settings, ia_model: e.target.value })} 
                placeholder={`ej. ${settings.ia_provider === 'gemini' ? 'gemini-1.5-flash' : settings.ia_provider === 'openai' ? 'gpt-3.5-turbo' : 'meta-llama/Llama-2-7b-chat-hf'}`}
                style={{ flex: 1 }}
              />
              <button type="button" onClick={listModels} disabled={modelsLoading}>
                {modelsLoading ? 'Cargando...' : `Listar ${settings.ia_provider ?? 'gemini'}`}
              </button>
              <button 
                type="button" 
                onClick={listAllModels} 
                disabled={modelsLoading}
                style={{ 
                  backgroundColor: '#2196f3', 
                  color: 'white', 
                  border: 'none', 
                  padding: '8px 12px', 
                  borderRadius: 4, 
                  cursor: 'pointer' 
                }}
              >
                {modelsLoading ? 'Cargando...' : 'Ver Todos'}
              </button>
            </div>

            {/* Models grid display */}
            {models.length > 0 && (
              <div style={{ 
                border: '1px solid #e0e0e0', 
                borderRadius: 8, 
                padding: 16, 
                backgroundColor: '#fafafa',
                marginBottom: 12
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ margin: 0, color: '#333' }}>
                    {models.some(m => m.provider !== models[0]?.provider) ? 
                      `Modelos de Todos los Proveedores (${models.length})` : 
                      `Modelos ${settings.ia_provider?.toUpperCase()} (${models.length})`
                    }
                  </h4>
                  <button 
                    type="button" 
                    onClick={() => setModels([])} 
                    style={{ 
                      padding: '4px 8px', 
                      fontSize: '0.9em', 
                      backgroundColor: '#f44336', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: 4, 
                      cursor: 'pointer' 
                    }}
                  >
                    Limpiar
                  </button>
                </div>
                
                {/* Free models section */}
                {models.some(m => m.is_free) && (
                  <div style={{ marginBottom: 16 }}>
                    <h5 style={{ 
                      margin: '0 0 8px 0', 
                      color: '#4caf50', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 6 
                    }}>
                      💚 Modelos Gratuitos
                    </h5>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                      gap: 8 
                    }}>
                      {models.filter(m => m.is_free).map(m => (
                        <div 
                          key={m.name}
                          onClick={() => {
                            setSettings({ 
                              ...settings, 
                              ia_model: m.name,
                              ia_provider: m.provider as 'gemini' | 'openai' | 'huggingface'
                            });
                          }}
                          style={{
                            border: `2px solid ${settings.ia_model === m.name ? '#4caf50' : '#e0e0e0'}`,
                            borderRadius: 6,
                            padding: 12,
                            cursor: 'pointer',
                            backgroundColor: settings.ia_model === m.name ? '#f1f8e9' : 'white',
                            transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ fontWeight: 600, color: '#2e7d32', marginBottom: 4 }}>
                            {m.displayName || m.name}
                            {models.some(model => model.provider !== models[0]?.provider) && (
                              <span style={{ 
                                marginLeft: 8, 
                                fontSize: '0.75em', 
                                padding: '2px 6px', 
                                backgroundColor: '#e8f5e8', 
                                color: '#2e7d32', 
                                borderRadius: 8,
                                fontWeight: 400 
                              }}>
                                {m.provider?.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.85em', color: '#666', marginBottom: 6 }}>
                            {m.description || 'Modelo open-source disponible gratuitamente'}
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <div style={{ 
                              display: 'inline-block',
                              padding: '2px 8px',
                              backgroundColor: '#4caf50',
                              color: 'white',
                              borderRadius: 12,
                              fontSize: '0.75em',
                              fontWeight: 500
                            }}>
                              GRATUITO
                            </div>
                            <div style={{ 
                              fontSize: '0.75em',
                              color: '#4caf50',
                              fontWeight: 500
                            }}>
                              ⚡ Requiere configuración
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Paid models section */}
                {models.some(m => !m.is_free) && (
                  <div>
                    <h5 style={{ 
                      margin: '0 0 8px 0', 
                      color: '#ff9800', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 6 
                    }}>
                      💰 Modelos de Pago
                    </h5>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                      gap: 8 
                    }}>
                      {models.filter(m => !m.is_free).map(m => (
                        <div 
                          key={m.name}
                          onClick={() => {
                            setSettings({ 
                              ...settings, 
                              ia_model: m.name,
                              ia_provider: m.provider as 'gemini' | 'openai' | 'huggingface'
                            });
                          }}
                          style={{
                            border: `2px solid ${settings.ia_model === m.name ? '#ff9800' : '#e0e0e0'}`,
                            borderRadius: 6,
                            padding: 12,
                            cursor: 'pointer',
                            backgroundColor: settings.ia_model === m.name ? '#fff8e1' : 'white',
                            transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ fontWeight: 600, color: '#f57c00', marginBottom: 4 }}>
                            {m.displayName || m.name}
                            {models.some(model => model.provider !== models[0]?.provider) && (
                              <span style={{ 
                                marginLeft: 8, 
                                fontSize: '0.75em', 
                                padding: '2px 6px', 
                                backgroundColor: '#fff3e0', 
                                color: '#f57c00', 
                                borderRadius: 8,
                                fontWeight: 400 
                              }}>
                                {m.provider?.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.85em', color: '#666', marginBottom: 6 }}>
                            {m.description || 'Modelo premium con funcionalidades avanzadas'}
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <div style={{ 
                              display: 'inline-block',
                              padding: '2px 8px',
                              backgroundColor: '#ff9800',
                              color: 'white',
                              borderRadius: 12,
                              fontSize: '0.75em',
                              fontWeight: 500
                            }}>
                              PAGO
                            </div>
                            {m.provider === 'openai' && m.name?.includes('3.5') && (
                              <div style={{ fontSize: '0.75em', color: '#ff9800', fontWeight: 500 }}>
                                💰 Económico
                              </div>
                            )}
                            {m.provider === 'openai' && m.name?.includes('gpt-4') && (
                              <div style={{ fontSize: '0.75em', color: '#f44336', fontWeight: 500 }}>
                                💎 Premium
                              </div>
                            )}
                            {m.provider === 'gemini' && m.name?.includes('flash') && (
                              <div style={{ fontSize: '0.75em', color: '#ff9800', fontWeight: 500 }}>
                                ⚡ Rápido y económico
                              </div>
                            )}
                            {m.provider === 'gemini' && m.name?.includes('pro') && (
                              <div style={{ fontSize: '0.75em', color: '#f44336', fontWeight: 500 }}>
                                🚀 Alto rendimiento
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Selected model info */}
                {settings.ia_model && (
                  <div style={{ 
                    marginTop: 16, 
                    padding: 12, 
                    backgroundColor: '#e3f2fd', 
                    border: '1px solid #2196f3', 
                    borderRadius: 6 
                  }}>
                    <div style={{ fontWeight: 600, color: '#1976d2', marginBottom: 4 }}>
                      ✓ Modelo Seleccionado
                    </div>
                    <div style={{ fontSize: '0.9em' }}>
                      <strong>{settings.ia_model}</strong>
                      {models.find(m => m.name === settings.ia_model) && (
                        <span style={{ marginLeft: 8 }}>
                          ({models.find(m => m.name === settings.ia_model)?.is_free ? 'Gratuito' : 'De pago'})
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 6, padding: 12, backgroundColor: '#f0f7ff', borderRadius: 6, border: '1px solid #e3f2fd' }}>
              <div style={{ fontWeight: 600, color: '#1565c0', marginBottom: 8 }}>
                💡 Guía de Selección de Modelos
              </div>
              <div style={{ fontSize: '0.9em', color: '#1565c0' }}>
                <div style={{ marginBottom: 6 }}>
                  <strong>🟢 Gratuitos (HuggingFace):</strong> Requieren configuración técnica, ideal para desarrollo y pruebas
                </div>
                <div style={{ marginBottom: 6 }}>
                  <strong>🟡 Económicos (OpenAI 3.5, Gemini Flash):</strong> Excelente relación calidad-precio para uso general
                </div>
                <div>
                  <strong>🔴 Premium (OpenAI 4, Gemini Pro):</strong> Máxima calidad para aplicaciones críticas
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label>Proveedor TTS</label><br />
            <select value={settings.tts_provider ?? 'openai'} onChange={e => setSettings({ ...settings, tts_provider: e.target.value as 'browser' | 'openai' | 'google' | 'coqui' | 'other' })}>
              <option value="browser">Navegador (SpeechSynthesis)</option>
              <option value="openai">OpenAI TTS</option>
              <option value="google">Google Cloud TTS</option>
              <option value="coqui">Coqui (self-host)</option>
              <option value="other">Otro</option>
            </select>
          </div>

          {settings.tts_provider === 'google' && (
            <div style={{ marginBottom: 12 }}>
              <label>Google TTS API Key (opcional)</label><br />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type={showGoogleKey ? 'text' : 'password'}
                  value={settings.google_tts_api_key ?? ''}
                  onChange={e => setSettings({ ...settings, google_tts_api_key: e.target.value })}
                  placeholder="Clave API de Google Cloud TTS"
                  style={{ flex: 1 }}
                />
                <button type="button" onClick={() => setShowGoogleKey(s => !s)}>{showGoogleKey ? 'Ocultar' : 'Mostrar'}</button>
                <button type="button" onClick={async () => {
                  setLoading(true);
                  try {
                    const headers: Record<string,string> = {};
                    if (settings.google_tts_api_key) headers['x-google-tts-api-key'] = settings.google_tts_api_key;
                    // Filtrar específicamente por voces masculinas
                    const res = await fetch('/api/admin/tts/voices?provider=google&gender=MALE', { headers });
                    const body = await res.json();
                    if (res.ok && body.voices) {
                      setGoogleVoices(body.voices as TTSVoice[]);
                    } else {
                      alert('No se pudieron obtener voces: ' + (body.error || 'unknown'));
                    }
                  } catch (e) { console.error('Fetch voices error', e); alert('Error al obtener voces'); }
                  setLoading(false);
                }}>👨 Listar voces masculinas (Google)</button>
              </div>
              <div style={{ marginTop: 6, color: '#666', fontSize: '0.9rem' }}>
                Si ingresás la clave acá, se almacenará en la tabla <code>app_settings</code> (solo accesible para admins). También se puede guardar en <code>GOOGLE_TTS_API_KEY</code> en el servidor.
              </div>

              {googleVoices.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <label>Voces Google disponibles ({googleVoices.length})</label>
                  <div style={{ marginTop: 6, color: '#666', fontSize: '0.9rem' }}>
                    Hacé clic en una voz para seleccionarla, luego en &quot;Probar&quot; para escucharla. Mostrando voces masculinas de Google (recomendado para Santi, tu avatar masculino).
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginTop: 6 }}>
                    {googleVoices.map(v => (
                      <div 
                        key={v.name} 
                        style={{ 
                          border: '1px solid #ddd',
                          borderRadius: '6px',
                          padding: '8px',
                          backgroundColor: settings.tts_engine === v.name ? '#e3f2fd' : '#f8f9fa',
                          borderColor: settings.tts_engine === v.name ? '#2196f3' : '#ddd'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <button 
                            type="button" 
                            onClick={() => setSettings(prev => ({ ...prev, tts_engine: v.name }))} 
                            style={{ 
                              background: 'none',
                              border: 'none',
                              textAlign: 'left',
                              cursor: 'pointer',
                              flex: 1,
                              padding: 0,
                              fontWeight: settings.tts_engine === v.name ? 'bold' : 'normal'
                            }}
                          >
                            <div style={{ fontSize: '0.9em' }}>{v.name}</div>
                            {v.languageCodes && v.languageCodes.length > 0 && (
                              <div style={{ fontSize: '0.75em', color: '#666' }}>
                                {v.languageCodes[0]} • {v.ssmlGender || 'Unknown'}
                              </div>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                setLoading(true);
                                const testText = 'Hola, esta es una prueba de voz con Google TTS.';
                                const headers: Record<string,string> = { 'Content-Type': 'application/json' };
                                
                                // Add Google API key if available
                                if (settings.google_tts_api_key?.trim()) {
                                  headers['x-google-tts-api-key'] = settings.google_tts_api_key.trim();
                                }
                                
                                console.log('Testing voice:', v.name, 'with headers:', Object.keys(headers));
                                
                                const response = await fetch('/api/speech', {
                                  method: 'POST',
                                  headers,
                                  body: JSON.stringify({ 
                                    text: testText,
                                    voice: v.name,
                                    provider: 'google',
                                    languageCode: v.languageCodes?.[0] || 'es-419'
                                  })
                                });

                                console.log('TTS response status:', response.status);
                                
                                if (!response.ok) {
                                  const errorBody = await response.text();
                                  console.error('TTS error response:', errorBody);
                                  throw new Error(`TTS test failed: ${response.status} - ${errorBody}`);
                                }

                                // Check if response is JSON (fallback) or audio
                                const contentType = response.headers.get('content-type');
                                console.log('Response content type:', contentType);
                                
                                if (contentType?.includes('application/json')) {
                                  const jsonData = await response.json();
                                  if (jsonData.fallback) {
                                    alert('Fallback to browser TTS (Google TTS not properly configured)');
                                    return;
                                  }
                                  throw new Error(jsonData.error || 'Unknown TTS error');
                                }

                                const blob = await response.blob();
                                console.log('Audio blob size:', blob.size);
                                
                                if (blob.size === 0) {
                                  throw new Error('Received empty audio blob');
                                }
                                
                                const audio = new Audio(URL.createObjectURL(blob));
                                await audio.play();
                                
                                console.log('Voice test successful for:', v.name);
                              } catch (e) {
                                console.error('Voice test error:', e);
                                alert(`Error al probar la voz "${v.name}": ${e instanceof Error ? e.message : 'Unknown error'}`);
                              } finally {
                                setLoading(false);
                              }
                            }}
                            disabled={loading}
                            style={{
                              padding: '4px 8px',
                              fontSize: '0.8em',
                              backgroundColor: '#4caf50',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              marginLeft: '8px'
                            }}
                          >
                            {loading ? '...' : '▶ Probar'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 8, padding: 8, backgroundColor: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: 4 }}>
                    <strong>Cómo usar:</strong>
                    <ol style={{ margin: '4px 0', paddingLeft: 20 }}>
                      <li>Hacé clic en una voz para seleccionarla (se resaltará en azul)</li>
                      <li>Hacé clic en &quot;▶ Probar&quot; para escuchar cómo suena</li>
                      <li>Una vez que elijas una voz, hacé clic en el botón &quot;Guardar&quot; al final</li>
                    </ol>
                    <div style={{ fontSize: '0.9em', color: '#856404', marginTop: 4 }}>
                      Voz seleccionada: <strong>{settings.tts_engine || 'Ninguna'}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ marginBottom: 8 }}>
            <label>Engine / Config TTS</label><br />
            <input value={settings.tts_engine ?? ''} onChange={e => setSettings({ ...settings, tts_engine: e.target.value })} placeholder="ej. alloy (OpenAI), es-AR (browser)" />
            <div style={{ marginTop: 6, color: '#666', fontSize: '0.9rem' }}>
              Si elegís <strong>OpenAI</strong>, el valor por defecto es <code>alloy</code> (voz por defecto de OpenAI TTS). Si elegís <strong>Navegador</strong>, podés seleccionar una voz disponible abajo.
            </div>
          </div>

          {settings.tts_provider === 'browser' && (
            <div style={{ marginBottom: 12 }}>
              <label>Voz del navegador</label><br />
              <select value={settings.tts_engine ?? ''} onChange={e => setSettings({ ...settings, tts_engine: e.target.value })}>
                <option value="">(Seleccionar voz del navegador)</option>
                {browserVoices.map((v, i) => (
                  <option key={i} value={`${v.lang}||${v.name}`}>{v.lang} — {v.name} {v.localService ? '(local)' : ''}</option>
                ))}
              </select>
              <button type="button" onClick={async () => {
                // Test speak with selected voice
                if (!settings.tts_engine) { alert('Seleccioná una voz primero'); return; }
                const [lang, name] = (settings.tts_engine as string).split('||');
                try {
                  const utter = new SpeechSynthesisUtterance('Esta es una prueba de voz');
                  utter.lang = lang || 'es-AR';
                  const voices = window.speechSynthesis.getVoices();
                  utter.voice = voices.find(v => v.name === name) || null;
                  window.speechSynthesis.cancel();
                  window.speechSynthesis.speak(utter);
                } catch (e) { console.error('Browser TTS test failed', e); alert('Error en prueba de voz'); }
              }}>Probar voz</button>
              {googleVoices.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <label>Voces Google ya cargadas ({googleVoices.length})</label>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    {googleVoices.slice(0, 10).map(v => (
                      <button key={v.name} type="button" onClick={() => setSettings(prev => ({ ...prev, tts_engine: v.name }))} style={{ padding: '6px 8px' }}>{v.name}</button>
                    ))}
                  </div>
                </div>
              )}              <div style={{ marginTop: 6, color: '#666', fontSize: '0.9rem' }}>Nota: las voces del navegador dependen del sistema operativo y el navegador. Si no ves voces, intenta recargar la página o abrir desde Chrome/Edge.</div>
            </div>
          )}

          {settings.tts_provider === 'openai' && (
            <div style={{ marginBottom: 12 }}>
              <label>Voz OpenAI</label><br />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select value={settings.tts_engine ?? 'alloy'} onChange={e => setSettings({ ...settings, tts_engine: e.target.value })}>
                  <option value="alloy">alloy (default)</option>
                  <option value="fable">fable</option>
                  <option value="echo">echo</option>
                </select>
                <button type="button" onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await fetch('/api/admin/tts/voices?provider=openai');
                    const body = await res.json();
                    if (res.ok && body.voices) {
                      const voices = body.voices as TTSVoice[];
                      setOpenaiVoices(voices);
                    } else {
                      alert('No se pudieron obtener voces: ' + (body.error || 'unknown'));
                    }
                  } catch (e) { console.error('Fetch voices error', e); alert('Error al obtener voces'); }
                  setLoading(false);
                }}>Listar voces (OpenAI)</button>

                <button type="button" onClick={async () => {
                  setLoading(true);
                  try {
                    const headers: Record<string,string> = {};
                    if (settings.google_tts_api_key) headers['x-google-tts-api-key'] = settings.google_tts_api_key;
                    // Filtrar por género MALE (masculino) por defecto para Santi
                    const res = await fetch('/api/admin/tts/voices?provider=google&gender=MALE', { headers });
                    const body = await res.json();
                    if (res.ok && body.voices) {
                      setGoogleVoices(body.voices as TTSVoice[]);
                    } else {
                      alert('No se pudieron obtener voces: ' + (body.error || 'unknown'));
                    }
                  } catch (e) { console.error('Fetch voices error', e); alert('Error al obtener voces'); }
                  setLoading(false);
                }}>👨 Voces masculinas</button>

                {/* Botones para filtrar por idioma */}
                <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <small style={{ width: '100%', color: '#666' }}>Voces masculinas por idioma:</small>
                  {(['es', 'en', 'pt', 'fr'] as const).map(langCode => {
                    const langLabels = { es: 'Español', en: 'English', pt: 'Português', fr: 'Français' } as const;
                    const langLabel = langLabels[langCode];
                    return (
                      <button
                        key={langCode}
                        type="button"
                        onClick={async () => {
                          setLoading(true);
                          try {
                            const headers: Record<string,string> = {};
                            if (settings.google_tts_api_key) headers['x-google-tts-api-key'] = settings.google_tts_api_key;
                            const res = await fetch(`/api/admin/tts/voices?provider=google&gender=MALE&lang=${langCode}`, { headers });
                            const body = await res.json();
                            if (res.ok && body.voices) {
                              setGoogleVoices(body.voices as TTSVoice[]);
                            } else {
                              alert(`No se pudieron obtener voces para ${langLabel}: ` + (body.error || 'unknown'));
                            }
                          } catch (e) { console.error('Fetch voices error', e); alert('Error al obtener voces'); }
                          setLoading(false);
                        }}
                        disabled={loading}
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.85em',
                          backgroundColor: '#2196f3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        {langCode.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ marginTop: 6, color: '#666', fontSize: '0.9rem' }}>
                Si tu proveedor tiene más voces, podés escribir su nombre manualmente o usar Listar voces para ver opciones.
              </div>

              {openaiVoices.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <label>Voces obtenidas</label>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    {openaiVoices.map(v => (
                      <button key={v.name} type="button" onClick={() => setSettings(prev => ({ ...prev, tts_engine: v.name }))} style={{ padding: '6px 8px' }}>{v.name}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ marginBottom: 12, marginTop: 16, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 6 }}>
            <h4>Configuración de voces TTS (Santi)</h4>
            <div style={{ marginBottom: 8 }}>
              <label>Género de voz preferido</label><br />
              <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setVoiceGenderFilter('MALE');
                    setExpandedLanguage(null);
                    setVoicesByLanguage({});
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: voiceGenderFilter === 'MALE' ? '#2196f3' : '#ddd',
                    color: voiceGenderFilter === 'MALE' ? 'white' : 'black',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: voiceGenderFilter === 'MALE' ? 'bold' : 'normal'
                  }}
                >
                  👨 Masculino
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVoiceGenderFilter('FEMALE');
                    setExpandedLanguage(null);
                    setVoicesByLanguage({});
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: voiceGenderFilter === 'FEMALE' ? '#ff9800' : '#ddd',
                    color: voiceGenderFilter === 'FEMALE' ? 'white' : 'black',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: voiceGenderFilter === 'FEMALE' ? 'bold' : 'normal'
                  }}
                >
                  👩 Femenino
                </button>
              </div>
              <div style={{ marginTop: 6, color: '#666', fontSize: '0.9rem' }}>
                Género seleccionado: <strong>{voiceGenderFilter}</strong> - Las voces se filtrarán por este género
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label>Buscar voces por idioma</label>
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {[
                  { code: 'es', label: 'Español', key: 'tts_voice_name_es' as const },
                  { code: 'en', label: 'Inglés', key: 'tts_voice_name_en' as const },
                  { code: 'pt', label: 'Portugués', key: 'tts_voice_name_pt' as const },
                  { code: 'fr', label: 'Francés', key: 'tts_voice_name_fr' as const }
                ].map(lang => (
                  <div key={lang.code} style={{ 
                    border: expandedLanguage === lang.code ? '2px solid #2196f3' : '1px solid #ddd', 
                    padding: '8px',
                    borderRadius: '4px',
                    backgroundColor: expandedLanguage === lang.code ? '#e3f2fd' : 'white'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={async () => {
                          if (expandedLanguage === lang.code) {
                            setExpandedLanguage(null);
                          } else {
                            setLoading(true);
                            setMessage(null);
                            try {
                              const headers: Record<string, string> = {};
                              if (settings.google_tts_api_key?.trim()) {
                                console.log(`📡 Usando API key del formulario (${settings.google_tts_api_key.trim().length} chars)`);
                                headers['x-google-tts-api-key'] = settings.google_tts_api_key.trim();
                              } else {
                                console.log('✓ Sin API key en formulario, usaré GOOGLE_TTS_API_KEY del servidor (.env)');
                              }
                              const url = `/api/admin/tts/voices?provider=google&gender=${voiceGenderFilter}&lang=${lang.code}`;
                              console.log(`🔍 Buscando voces: ${url}`);
                              const res = await fetch(url, { headers });
                              const body = await res.json();
                              
                              console.log('Response:', {
                                status: res.status,
                                voicesCount: body.voices?.length || 0,
                                filterApplied: body.filterApplied,
                                totalAvailable: body.totalAvailable,
                                filteredAvailable: body.filteredAvailable,
                                error: body.error
                              });

                              if (res.ok && body.voices && body.voices.length > 0) {
                                setVoicesByLanguage(prev => ({
                                  ...prev,
                                  [lang.code]: body.voices as TTSVoice[]
                                }));
                                setExpandedLanguage(lang.code);
                                setMessage(null);
                              } else {
                                const errorMsg = body.error || `No hay voces disponibles para ${lang.label} en género ${voiceGenderFilter}. Verifica que GOOGLE_TTS_API_KEY esté configurado y que la API esté habilitada.`;
                                console.warn('❌ Error o sin voces:', errorMsg);
                                setMessage(`⚠️ ${errorMsg}`);
                              }
                            } catch (e) {
                              console.error('Fetch voices error', e);
                              const errorMsg = e instanceof Error ? e.message : 'Error desconocido';
                              setMessage(`❌ Error al obtener voces: ${errorMsg}`);
                              alert(`Error al obtener voces para ${lang.label}: ${errorMsg}`);
                            } finally {
                              setLoading(false);
                            }
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          backgroundColor: expandedLanguage === lang.code ? '#2196f3' : '#f0f0f0',
                          color: expandedLanguage === lang.code ? 'white' : 'black',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: loading ? 'wait' : 'pointer',
                          fontWeight: 'bold',
                          fontSize: '0.9em',
                          opacity: loading ? 0.7 : 1
                        }}
                      >
                        {expandedLanguage === lang.code ? '✓' : '▼'} {lang.label}
                      </button>
                      {settings[lang.key] && (
                        <div style={{
                          fontSize: '0.75em',
                          backgroundColor: '#e8f5e9',
                          padding: '2px 6px',
                          borderRadius: '3px',
                          color: '#2e7d32',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {settings[lang.key].split('-').slice(0, 2).join('-')}
                        </div>
                      )}
                    </div>

                    {expandedLanguage === lang.code && voicesByLanguage[lang.code] && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: '0.85em', color: '#666', marginBottom: 6 }}>
                          {voicesByLanguage[lang.code].length} voces disponibles:
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 4 }}>
                          {voicesByLanguage[lang.code].map((voice) => (
                            <button
                              key={voice.name}
                              type="button"
                              onClick={() => {
                                setSettings(prev => ({
                                  ...prev,
                                  [lang.key]: voice.name
                                }));
                              }}
                              style={{
                                padding: '6px 8px',
                                backgroundColor: settings[lang.key] === voice.name ? '#4caf50' : '#fff',
                                color: settings[lang.key] === voice.name ? 'white' : 'black',
                                border: settings[lang.key] === voice.name ? '2px solid #4caf50' : '1px solid #ccc',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                fontSize: '0.75em',
                                fontWeight: settings[lang.key] === voice.name ? 'bold' : 'normal',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                              title={voice.name}
                            >
                              {voice.name.split('-').slice(0, 3).join('-')}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {!expandedLanguage && settings[lang.key] && (
                      <div style={{ fontSize: '0.75em', color: '#999', marginTop: '4px' }}>
                        Asignada: {settings[lang.key]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, padding: 12, backgroundColor: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: 4 }}>
                <strong>💡 Cómo usar:</strong>
                <ol style={{ margin: '4px 0 8px 0', paddingLeft: 20 }}>
                  <li>Selecciona el género (Masculino/Femenino)</li>
                  <li>Haz clic en un idioma para cargar las voces disponibles</li>
                  <li>Selecciona una voz haciendo clic sobre ella (se resaltará en verde)</li>
                  <li>Repite para otros idiomas</li>
                  <li>Al final, haz clic en &quot;Guardar&quot;</li>
                </ol>

                {!settings.google_tts_api_key && (
                  <div style={{ marginTop: 8, padding: 8, backgroundColor: '#e8f5e9', border: '1px solid #4caf50', borderRadius: 3 }}>
                    <strong style={{ color: '#1b5e20' }}>✓ API Key configurada en servidor:</strong>
                    <p style={{ margin: '4px 0', fontSize: '0.9em', color: '#2e7d32' }}>
                      Se detectó <code>GOOGLE_TTS_API_KEY</code> en .env.local. El servidor usará esa clave automáticamente.
                    </p>
                    <p style={{ margin: '4px 0', fontSize: '0.9em', color: '#2e7d32' }}>
                      Puedes proceder a cargar las voces por idioma. Si tienes problemas, abre la consola (F12) para ver los logs.
                    </p>
                  </div>
                )}

                {settings.google_tts_api_key && (
                  <div style={{ marginTop: 8, padding: 8, backgroundColor: '#e8f5e9', border: '1px solid #4caf50', borderRadius: 3 }}>
                    <strong style={{ color: '#1b5e20' }}>✓ API Key guardada en base de datos:</strong>
                    <p style={{ margin: '4px 0', fontSize: '0.9em', color: '#2e7d32' }}>
                      {settings.google_tts_api_key.substring(0, 10)}...{settings.google_tts_api_key.substring(settings.google_tts_api_key.length - 5)}
                    </p>
                    <p style={{ margin: '4px 0', fontSize: '0.9em', color: '#2e7d32' }}>
                      Esta clave tiene prioridad sobre .env.local. Puedes proceder a cargar las voces.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          {message && <div style={{ marginTop: 8 }}>{message}</div>}
        </>
      )}
    </div>
  );
}
