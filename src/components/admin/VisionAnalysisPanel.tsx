"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { VisionAnalysisResult, YOLODetection } from '@/types/vision';

interface VisionRecord {
  id: string;
  timestamp: string;
  people_count: number;
  group_type: string;
  detected_objects: string[];
  confidence_score: number;
  processing_time: number;
  snapshot_url?: string;
}

interface VisionConfig {
  enableYolo: boolean;
  enableMediaPipe: boolean;
  enableFaceRecognition: boolean;
  detectionInterval: number; // ms
  confidenceThreshold: number; // 0-1
  saveSnapshots: boolean;
}

export default function VisionAnalysisPanel() {
  // Estados principales
  const [isActive, setIsActive] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<VisionAnalysisResult | null>(null);
  const [records, setRecords] = useState<VisionRecord[]>([]);
  const [config, setConfig] = useState<VisionConfig>({
    enableYolo: true,
    enableMediaPipe: true,
    enableFaceRecognition: false,
    detectionInterval: 2000,
    confidenceThreshold: 0.5,
    saveSnapshots: true,
  });
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalAnalyses: 0,
    avgPeopleCount: 0,
    avgProcessingTime: 0,
    mostCommonObjects: [] as string[],
  });

  // Referencias
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Colores
  const COLOR_GOLD = '#F1C40F';
  const COLOR_BLUE = '#1A3A6C';
  const COLOR_GREEN = '#10B981';
  const COLOR_RED = '#EF4444';

  // Inicializar cámara
  const initCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (error) {
      console.error('Error al acceder a la cámara:', error);
      alert('No se pudo acceder a la cámara. Por favor, verifica los permisos.');
    }
  }, []);

  // Detener cámara
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Cargar registros desde base de datos
  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/vision/records');
      if (response.ok) {
        const data = await response.json();
        setRecords(data.records || []);
        setStats(data.stats || stats);
      }
    } catch (error) {
      console.error('Error al cargar registros:', error);
    } finally {
      setLoading(false);
    }
  }, [stats]);

  // Guardar análisis en base de datos
  const saveAnalysis = useCallback(async (result: VisionAnalysisResult, imageBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('analysis', JSON.stringify({
        people_count: result.groupAnalysis.count,
        group_type: result.groupAnalysis.type,
        detected_objects: result.objectContext.detectedObjects,
        confidence_score: result.confidenceScore,
        processing_time: Math.round(result.processingTime),
      }));
      formData.append('snapshot', imageBlob);

      await fetch('/api/vision/save', {
        method: 'POST',
        body: formData,
      });

      // Recargar registros
      fetchRecords();
    } catch (error) {
      console.error('Error al guardar análisis:', error);
    }
  }, [fetchRecords]);

  // Capturar frame y analizar
  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Ajustar tamaño del canvas
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Dibujar frame actual
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      // Obtener imagen como blob
      const imageBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.8);
      });

      if (!imageBlob) return;

      // Enviar a API de análisis
      const formData = new FormData();
      formData.append('image', imageBlob);
      formData.append('config', JSON.stringify(config));

      const response = await fetch('/api/vision/analyze', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result: VisionAnalysisResult = await response.json();
        setCurrentAnalysis(result);
        
        // Dibujar detecciones en el canvas
        drawDetections(ctx, result);

        // Guardar en base de datos si está configurado
        if (config.saveSnapshots) {
          await saveAnalysis(result, imageBlob);
        }
      }
    } catch (error) {
      console.error('Error en análisis:', error);
    }
  }, [config, saveAnalysis]);

  // Dibujar detecciones en el canvas
  const drawDetections = (ctx: CanvasRenderingContext2D, result: VisionAnalysisResult) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Limpiar overlay anterior
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibujar bounding boxes de YOLO
    result.yoloDetections.forEach((det: YOLODetection) => {
      const [x, y, w, h] = det.bbox;
      
      // Color según tipo
      const isPersona = det.class === 'person';
      ctx.strokeStyle = isPersona ? COLOR_GREEN : COLOR_GOLD;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);

      // Label
      ctx.fillStyle = isPersona ? COLOR_GREEN : COLOR_GOLD;
      ctx.fillRect(x, y - 25, 150, 25);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px Arial';
      ctx.fillText(`${det.class} ${(det.confidence * 100).toFixed(0)}%`, x + 5, y - 7);
    });

    // Dibujar indicador de pose si está señalando
    if (result.poseAnalysis?.isPointing) {
      ctx.fillStyle = COLOR_RED;
      ctx.font = 'bold 20px Arial';
      ctx.fillText('👉 Señalando', 10, 40);
    }

    // Mostrar contador de personas
    ctx.fillStyle = 'rgba(26, 58, 108, 0.8)';
    ctx.fillRect(10, canvas.height - 100, 200, 90);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 18px Arial';
    ctx.fillText(`Personas: ${result.groupAnalysis.count}`, 20, canvas.height - 70);
    ctx.font = '14px Arial';
    ctx.fillText(`Grupo: ${result.groupAnalysis.type}`, 20, canvas.height - 45);
    ctx.fillText(`Confianza: ${(result.confidenceScore * 100).toFixed(0)}%`, 20, canvas.height - 20);
  };

  // Iniciar/detener análisis
  const toggleAnalysis = async () => {
    if (isActive) {
      stopCamera();
      setIsActive(false);
    } else {
      await initCamera();
      setIsActive(true);
      
      // Iniciar análisis periódico
      intervalRef.current = setInterval(() => {
        captureAndAnalyze();
      }, config.detectionInterval);
    }
  };

  // Cargar registros al montar
  useEffect(() => {
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Panel de Control */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}>
        <h2 style={{ margin: '0 0 15px 0', color: COLOR_BLUE, fontSize: '1.5rem' }}>
          🎥 Control de Cámara
        </h2>
        
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button
            onClick={toggleAnalysis}
            style={{
              padding: '12px 24px',
              background: isActive ? COLOR_RED : COLOR_GREEN,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
            }}
          >
            {isActive ? '⏹️ Detener' : '▶️ Iniciar Análisis'}
          </button>

          <button
            onClick={captureAndAnalyze}
            disabled={!isActive}
            style={{
              padding: '12px 24px',
              background: isActive ? COLOR_GOLD : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: isActive ? 'pointer' : 'not-allowed',
              fontSize: '16px',
            }}
          >
            📸 Capturar Frame
          </button>

          <button
            onClick={fetchRecords}
            style={{
              padding: '12px 24px',
              background: COLOR_BLUE,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            🔄 Actualizar
          </button>
        </div>

        {/* Visor de Cámara */}
        <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', background: '#000' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', display: 'block' }}
          />
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          />
          {!isActive && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(0,0,0,0.7)',
              color: 'white',
              padding: '20px',
              borderRadius: '8px',
              fontSize: '18px',
            }}>
              Cámara detenida
            </div>
          )}
        </div>
      </div>

      {/* Configuración */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}>
        <h2 style={{ margin: '0 0 15px 0', color: COLOR_BLUE, fontSize: '1.5rem' }}>
          ⚙️ Configuración
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="checkbox"
              checked={config.enableYolo}
              onChange={(e) => setConfig({ ...config, enableYolo: e.target.checked })}
            />
            <span>Detección YOLO (objetos)</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="checkbox"
              checked={config.enableMediaPipe}
              onChange={(e) => setConfig({ ...config, enableMediaPipe: e.target.checked })}
            />
            <span>MediaPipe (poses)</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="checkbox"
              checked={config.enableFaceRecognition}
              onChange={(e) => setConfig({ ...config, enableFaceRecognition: e.target.checked })}
            />
            <span>Reconocimiento facial</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="checkbox"
              checked={config.saveSnapshots}
              onChange={(e) => setConfig({ ...config, saveSnapshots: e.target.checked })}
            />
            <span>Guardar capturas</span>
          </label>
        </div>

        <div style={{ marginTop: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Intervalo de análisis: {config.detectionInterval}ms
          </label>
          <input
            type="range"
            min="500"
            max="5000"
            step="500"
            value={config.detectionInterval}
            onChange={(e) => setConfig({ ...config, detectionInterval: parseInt(e.target.value) })}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ marginTop: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Umbral de confianza: {(config.confidenceThreshold * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={config.confidenceThreshold}
            onChange={(e) => setConfig({ ...config, confidenceThreshold: parseFloat(e.target.value) })}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* Estadísticas */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}>
        <h2 style={{ margin: '0 0 15px 0', color: COLOR_BLUE, fontSize: '1.5rem' }}>
          📊 Estadísticas
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div style={{ padding: '15px', background: '#f0f9ff', borderRadius: '8px' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: COLOR_BLUE }}>
              {stats.totalAnalyses}
            </div>
            <div style={{ color: '#666' }}>Total de análisis</div>
          </div>

          <div style={{ padding: '15px', background: '#f0fdf4', borderRadius: '8px' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: COLOR_GREEN }}>
              {stats.avgPeopleCount.toFixed(1)}
            </div>
            <div style={{ color: '#666' }}>Promedio de personas</div>
          </div>

          <div style={{ padding: '15px', background: '#fef3c7', borderRadius: '8px' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#d97706' }}>
              {stats.avgProcessingTime.toFixed(0)}ms
            </div>
            <div style={{ color: '#666' }}>Tiempo de procesamiento</div>
          </div>
        </div>

        {stats.mostCommonObjects.length > 0 && (
          <div style={{ marginTop: '15px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '10px' }}>Objetos más detectados:</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {stats.mostCommonObjects.slice(0, 10).map((obj, idx) => (
                <span
                  key={idx}
                  style={{
                    padding: '5px 12px',
                    background: COLOR_GOLD,
                    color: 'white',
                    borderRadius: '20px',
                    fontSize: '14px',
                  }}
                >
                  {obj}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Historial de Registros */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}>
        <h2 style={{ margin: '0 0 15px 0', color: COLOR_BLUE, fontSize: '1.5rem' }}>
          📋 Historial de Análisis
        </h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>Cargando...</div>
        ) : records.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
            No hay registros aún. Inicia el análisis para comenzar a registrar datos.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Fecha</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Personas</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Tipo</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Objetos</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Confianza</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Tiempo (ms)</th>
                </tr>
              </thead>
              <tbody>
                {records.slice(0, 50).map((record) => (
                  <tr key={record.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px' }}>
                      {new Date(record.timestamp).toLocaleString('es-AR')}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span style={{
                        padding: '4px 10px',
                        background: COLOR_GREEN,
                        color: 'white',
                        borderRadius: '12px',
                        fontWeight: 'bold',
                      }}>
                        {record.people_count}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>{record.group_type}</td>
                    <td style={{ padding: '10px', fontSize: '0.9rem' }}>
                      {record.detected_objects.slice(0, 3).join(', ')}
                      {record.detected_objects.length > 3 && '...'}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {(record.confidence_score * 100).toFixed(0)}%
                    </td>
                    <td style={{ padding: '10px' }}>{record.processing_time.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Análisis Actual */}
      {currentAnalysis && (
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: `2px solid ${COLOR_GOLD}`,
        }}>
          <h2 style={{ margin: '0 0 15px 0', color: COLOR_BLUE, fontSize: '1.5rem' }}>
            🔍 Análisis Actual
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: '5px' }}>Grupo Detectado</h3>
              <p>Personas: <strong>{currentAnalysis.groupAnalysis.count}</strong></p>
              <p>Tipo: <strong>{currentAnalysis.groupAnalysis.type}</strong></p>
              <p>Niños: <strong>{currentAnalysis.groupAnalysis.hasChildren ? 'Sí' : 'No'}</strong></p>
            </div>

            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: '5px' }}>Objetos Detectados</h3>
              <p>{currentAnalysis.objectContext.detectedObjects.join(', ') || 'Ninguno'}</p>
            </div>

            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: '5px' }}>Poses</h3>
              <p>Señalando: <strong>{currentAnalysis.poseAnalysis?.isPointing ? 'Sí' : 'No'}</strong></p>
            </div>

            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: '5px' }}>Sugerencias</h3>
              <p>{currentAnalysis.suggestions.length} generadas</p>
            </div>
          </div>

          {currentAnalysis.suggestions.length > 0 && (
            <div style={{ marginTop: '15px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '10px' }}>💡 Sugerencias del Sistema:</h3>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {currentAnalysis.suggestions.slice(0, 5).map((sug, idx) => (
                  <li key={idx} style={{ marginBottom: '5px' }}>
                    <strong>{sug.type}</strong>: {sug.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
