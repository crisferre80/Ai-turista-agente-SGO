'use client';

/**
 * Overlay de análisis visual
 * Muestra indicador cuando Santi está "mirando" y analizando la escena
 */

import { useEffect, useState } from 'react';
import { Eye, Loader2 } from 'lucide-react';
import type { VisionAnalysisResult } from '@/types/vision';

interface VisionAnalysisOverlayProps {
  isAnalyzing: boolean;
  result?: VisionAnalysisResult | null;
  showBoundingBoxes?: boolean;
  onClose?: () => void;
}

export function VisionAnalysisOverlay({
  isAnalyzing,
  result,
  showBoundingBoxes = false,
  onClose,
}: VisionAnalysisOverlayProps) {
  const [scanProgress, setScanProgress] = useState(0);

  // Animación de progreso mientras analiza
  useEffect(() => {
    if (!isAnalyzing) {
      // Reset progress after animation completes
      const timeout = setTimeout(() => setScanProgress(0), 1000);
      return () => clearTimeout(timeout);
    }

    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      if (progress >= 95) {
        setScanProgress(95);
        clearInterval(interval);
      } else {
        setScanProgress(progress);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isAnalyzing]);

  if (!isAnalyzing && !result) {
    return null;
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-40">
      {/* Efecto de escaneo */}
      {isAnalyzing && (
        <>
          {/* Corners de escaneo AR */}
          <div className="absolute top-20 left-10 w-16 h-16 border-t-4 border-l-4 border-blue-500 animate-pulse" />
          <div className="absolute top-20 right-10 w-16 h-16 border-t-4 border-r-4 border-blue-500 animate-pulse" />
          <div className="absolute bottom-20 left-10 w-16 h-16 border-b-4 border-l-4 border-blue-500 animate-pulse" />
          <div className="absolute bottom-20 right-10 w-16 h-16 border-b-4 border-r-4 border-blue-500 animate-pulse" />

          {/* Línea de escaneo animada */}
          <div 
            className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-scan"
            style={{
              top: `${scanProgress}%`,
              boxShadow: '0 0 10px rgba(59, 130, 246, 0.8)',
            }}
          />

          {/* Indicador central */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
            <div className="bg-black/80 backdrop-blur-sm rounded-full px-6 py-4 flex items-center gap-3 animate-fadeIn shadow-2xl">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              <div className="text-white">
                <div className="font-semibold">Santi está analizando...</div>
                <div className="text-sm text-gray-300">Detectando personas y objetos</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Resultado del análisis */}
      {result && !isAnalyzing && (
        <div className="absolute top-4 right-4 max-w-md pointer-events-auto animate-slideInRight">
          <div className="bg-white rounded-2xl shadow-2xl p-4 border-2 border-blue-500">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3 pb-2 border-b">
              <Eye className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-gray-900">Análisis Visual</h3>
              <button
                onClick={onClose}
                className="ml-auto text-gray-400 hover:text-gray-600 transition"
              >
                ✕
              </button>
            </div>

            {/* Detecciones principales */}
            <div className="space-y-2 text-sm">
              {/* Personas */}
              {result.groupAnalysis.count > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-2xl">👥</span>
                  <div>
                    <div className="font-semibold text-gray-800">
                      {result.groupAnalysis.count} persona{result.groupAnalysis.count !== 1 ? 's' : ''}
                    </div>
                    <div className="text-gray-600 text-xs">
                      Tipo: {result.groupAnalysis.type}
                      {result.groupAnalysis.hasChildren && ' (con niños)'}
                    </div>
                  </div>
                </div>
              )}

              {/* Caras conocidas */}
              {result.faceRecognition.knownFaces.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-2xl">😊</span>
                  <div>
                    <div className="font-semibold text-gray-800">
                      ¡Caras conocidas!
                    </div>
                    <div className="text-gray-600 text-xs">
                      {result.faceRecognition.knownFaces.map(f => f.nickname).join(', ')}
                    </div>
                  </div>
                </div>
              )}

              {/* Landmarks */}
              {result.objectContext.landmarks.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-2xl">🏛️</span>
                  <div>
                    <div className="font-semibold text-gray-800">
                      Lugares cercanos
                    </div>
                    <div className="text-gray-600 text-xs">
                      {result.objectContext.landmarks.slice(0, 2).map(l => l.name).join(', ')}
                    </div>
                  </div>
                </div>
              )}

              {/* Gesto de señalar */}
              {result.poseAnalysis?.isPointing && (
                <div className="flex items-start gap-2">
                  <span className="text-2xl">👉</span>
                  <div>
                    <div className="font-semibold text-gray-800">
                      Señalando
                    </div>
                    <div className="text-gray-600 text-xs">
                      Detecté que señalas hacia algo
                    </div>
                  </div>
                </div>
              )}

              {/* Accesibilidad */}
              {result.groupAnalysis.needsAccessibility && (
                <div className="flex items-start gap-2 bg-yellow-50 -mx-2 px-2 py-1 rounded">
                  <span className="text-2xl">♿</span>
                  <div>
                    <div className="font-semibold text-yellow-900">
                      Accesibilidad requerida
                    </div>
                    <div className="text-yellow-700 text-xs">
                      Mostraré solo lugares accesibles
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="mt-3 pt-2 border-t text-xs text-gray-500 flex justify-between">
              <span>Tiempo: {result.processingTime.toFixed(0)}ms</span>
              <span>Confianza: {(result.confidenceScore * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Bounding boxes (opcional, para debug) */}
      {showBoundingBoxes && result && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {result.yoloDetections.map((detection, idx) => {
            const [x, y, w, h] = detection.bbox;
            // Convertir coordenadas normalizadas a píxeles de pantalla
            const screenX = x * window.innerWidth;
            const screenY = y * window.innerHeight;
            const screenW = w * window.innerWidth;
            const screenH = h * window.innerHeight;

            return (
              <g key={idx}>
                <rect
                  x={screenX}
                  y={screenY}
                  width={screenW}
                  height={screenH}
                  fill="none"
                  stroke={detection.class === 'person' ? '#3b82f6' : '#10b981'}
                  strokeWidth="2"
                  opacity="0.8"
                />
                <text
                  x={screenX + 4}
                  y={screenY + 16}
                  fill="white"
                  fontSize="12"
                  className="font-bold drop-shadow-lg"
                >
                  {detection.class} {(detection.confidence * 100).toFixed(0)}%
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

// Estilos de animación en globals.css o tailwind.config.js
// @keyframes scan {
//   0% { top: 0; }
//   100% { top: 100%; }
// }
// @keyframes fadeIn {
//   from { opacity: 0; transform: scale(0.9); }
//   to { opacity: 1; transform: scale(1); }
// }
// @keyframes slideInRight {
//   from { transform: translateX(100%); opacity: 0; }
//   to { transform: translateX(0); opacity: 1; }
// }
