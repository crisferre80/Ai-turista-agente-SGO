/**
 * Orquestador principal del sistema de visión artificial
 * Coordina YOLO, MediaPipe y todos los analizadores
 */

import type { 
  VisionAnalysisResult,
  VisionContext,
  YOLOResult
} from '@/types/vision';
import type { PoseLandmarkerResult, FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { captureFrameAuto } from './frame-capture';
import { analyzePoseForPointing } from './pose-detector';
import { extractFaceEmbeddings, recognizeFaces } from './face-recognition';
import { analyzeGroup, describeGroup } from './group-analyzer';
import { analyzeObjects, describeObjects } from './object-detector';
import { generateSuggestions, buildVisionContextForChat } from './suggestion-engine';

export interface VisionOrchestra {
  yoloDetect: (imageData: ImageData) => Promise<YOLOResult>;
  mediapipeDetectPose: (imageData: ImageData) => PoseLandmarkerResult | null;
  mediapipeDetectFace: (imageData: ImageData) => FaceLandmarkerResult | null;
}

/**
 * Ejecuta análisis visual completo
 */
export async function analyzeScene(
  orchestra: VisionOrchestra,
  userLocation?: { lat: number; lng: number },
  captureOptions?: { width?: number; height?: number }
): Promise<VisionAnalysisResult> {
  const startTime = performance.now();

  console.log('🔍 Iniciando análisis visual completo...');

  // 1. Capturar frame actual
  const frame = await captureFrameAuto(captureOptions);
  if (!frame) {
    throw new Error('No se pudo capturar frame de cámara');
  }

  console.log('📷 Frame capturado:', frame.width, 'x', frame.height);

  try {
    // 2. Ejecutar detecciones en paralelo
    console.log('⚡ Ejecutando detectores en paralelo...');
    
    const [yoloResult, poseResult, faceResult] = await Promise.all([
      orchestra.yoloDetect(frame).catch(err => {
        console.error('YOLO detection failed:', err);
        return { detections: [], inferenceTime: 0, timestamp: Date.now() };
      }),
      Promise.resolve(orchestra.mediapipeDetectPose(frame)),
      Promise.resolve(orchestra.mediapipeDetectFace(frame)),
    ]);

    console.log(`✅ YOLO: ${yoloResult.detections.length} objetos`);
    console.log(`✅ MediaPipe Pose: ${poseResult?.landmarks?.length || 0} personas`);
    console.log(`✅ MediaPipe Face: ${faceResult?.faceLandmarks?.length || 0} caras`);

    // 3. Analizar poses para gestos
    const poseAnalysis = analyzePoseForPointing(poseResult);
    console.log('👉 Pose analysis:', poseAnalysis.isPointing ? 'Señalando!' : 'Normal');

    // 4. Extraer y reconocer caras
    const faceEmbeddings = extractFaceEmbeddings(faceResult);
    const faceRecognition = await recognizeFaces(faceEmbeddings);
    console.log(`👤 Caras: ${faceRecognition.totalFaces} detectadas, ${faceRecognition.knownFaces.length} conocidas`);

    // 5. Analizar grupo
    const groupAnalysis = analyzeGroup(yoloResult.detections, poseResult);
    console.log('👥 Grupo:', describeGroup(groupAnalysis));

    // 6. Analizar objetos y contexto
    const objectContext = await analyzeObjects(yoloResult.detections, userLocation);
    console.log('🏛️  Objetos:', describeObjects(objectContext));

    // 7. Generar sugerencias
    const suggestions = generateSuggestions(
      groupAnalysis,
      objectContext,
      faceRecognition,
      poseAnalysis
    );
    console.log(`💡 Sugerencias: ${suggestions.length} generadas`);

    // 8. Calcular confidence global
    const confidenceScores = [
      groupAnalysis.confidence,
      poseAnalysis.confidence,
      yoloResult.detections.length > 0 ? 0.8 : 0.3,
      faceRecognition.totalFaces > 0 ? 0.9 : 0.5,
    ];
    const confidenceScore = confidenceScores.reduce((a, b) => a + b) / confidenceScores.length;

    const processingTime = performance.now() - startTime;

    const result: VisionAnalysisResult = {
      yoloDetections: yoloResult.detections,
      poseAnalysis,
      faceRecognition,
      groupAnalysis,
      objectContext,
      suggestions,
      timestamp: Date.now(),
      processingTime,
      confidenceScore,
    };

    console.log(`✅ Análisis completado en ${processingTime.toFixed(0)}ms (confidence: ${(confidenceScore * 100).toFixed(0)}%)`);

    return result;
    
  } catch (err) {
    console.error('❌ Error en análisis visual:', err);
    throw err;
  }
}

/**
 * Genera contexto simplificado para el chat
 */
export function buildContextForChat(result: VisionAnalysisResult | null): VisionContext | null {
  if (!result) return null;
  
  const summary = buildVisionContextForChat(result);

  return {
    summary,
    detectedPeople: result.groupAnalysis.count,
    groupType: result.groupAnalysis.type,
    pointingAt: result.poseAnalysis?.isPointing 
      ? result.objectContext.landmarks[0]?.name 
      : undefined,
    knownFaces: result.faceRecognition.knownFaces.map(f => f.nickname),
    detectedObjects: result.objectContext.detectedObjects,
    landmarks: result.objectContext.landmarks.map(l => l.name),
    needsAccessibility: result.groupAnalysis.needsAccessibility,
    timestamp: result.timestamp,
  };
}

/**
 * Genera mensaje de resumen legible para el usuario
 */
export function generateUserSummary(result: VisionAnalysisResult | null): string {
  if (!result) {
    return 'Lo siento, no pude analizar la escena en este momento.';
  }
  
  const parts: string[] = [];

  // Saludos personalizados primero
  const greetings = result.suggestions.filter(s => s.type === 'greeting');
  if (greetings.length > 0) {
    parts.push(greetings[0].message);
  }

  // Descripción del grupo
  if (result.groupAnalysis.count > 0) {
    parts.push(`Detecto ${describeGroup(result.groupAnalysis)}.`);
  }

  // Lugares cercanos
  if (result.objectContext.landmarks.length > 0) {
    if (result.poseAnalysis?.isPointing) {
      parts.push(`Veo que señalas hacia ${result.objectContext.landmarks[0].name}.`);
    } else {
      const landmarkNames = result.objectContext.landmarks.slice(0, 2).map(l => l.name);
      parts.push(`Estás cerca de: ${landmarkNames.join(' y ')}.`);
    }
  }

  // Sugerencia principal
  const mainSuggestion = result.suggestions.find(s => 
    s.type === 'activity' || s.type === 'location_info'
  );
  if (mainSuggestion) {
    parts.push(mainSuggestion.message);
  }

  return parts.join(' ') || '¿En qué puedo ayudarte hoy?';
}

/**
 * Guarda registro de análisis en la base de datos (opcional, para analytics)
 */
export async function logVisionAnalysis(
  result: VisionAnalysisResult,
  userId?: string,
  location?: { lat: number; lng: number }
): Promise<void> {
  try {
    const { supabase } = await import('@/lib/supabase');

    await supabase.from('vision_analysis_log').insert({
      user_id: userId || null,
      timestamp: new Date(result.timestamp).toISOString(),
      location: location || null,
      detections: {
        people_count: result.groupAnalysis.count,
        objects: result.objectContext.detectedObjects,
        landmarks: result.objectContext.landmarks.map(l => l.name),
      },
      suggestions_given: result.suggestions.map(s => s.message),
      confidence: result.confidenceScore,
    });

    console.log('📊 Análisis registrado en BD');
  } catch (err) {
    console.error('Error guardando análisis:', err);
    // No fallar si no se puede guardar
  }
}
