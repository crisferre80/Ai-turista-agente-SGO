'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  PoseLandmarker,
  FaceLandmarker,
  FilesetResolver,
  PoseLandmarkerResult,
  FaceLandmarkerResult,
} from '@mediapipe/tasks-vision';

interface UseMediaPipeOptions {
  autoLoad?: boolean;
  enablePose?: boolean;
  enableFace?: boolean;
}

const DEFAULT_OPTIONS: Required<UseMediaPipeOptions> = {
  autoLoad: false,
  enablePose: true,
  enableFace: true,
};

export function useMediaPipeVision(options: UseMediaPipeOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wasmRef = useRef<any>(null);
  const isLoadingRef = useRef(false);

  // Cargar modelos MediaPipe
  const loadModels = useCallback(async () => {
    // Si ya está listo, no hacer nada
    if (poseLandmarkerRef.current && faceLandmarkerRef.current) {
      console.log('✅ MediaPipe: Modelos ya están cargados');
      setIsReady(true);
      return;
    }
    
    if (isLoadingRef.current) {
      console.log('⏳ MediaPipe: Ya está cargando, esperando...');
      // Esperar a que termine la carga actual
      while (isLoadingRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    // Suprimir mensajes informativos de MediaPipe durante carga
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      const message = args[0]?.toString() || '';
      if (
        message.includes('INFO:') ||
        message.includes('TensorFlow Lite') ||
        message.includes('XNNPACK') ||
        message.includes('Initialized TensorFlow')
      ) {
        // Silenciar mensajes informativos
        return;
      }
      originalError(...args);
    };

    try {
      console.log('🔄 Cargando MediaPipe Vision...');
      
      // Cargar WASM runtime
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm'
      );
      wasmRef.current = vision;

      // Cargar Pose Landmarker
      if (config.enablePose && !poseLandmarkerRef.current) {
        console.log('📍 Cargando PoseLandmarker...');
        const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU', // Usar GPU si está disponible
          },
          runningMode: 'IMAGE',
          numPoses: 5, // Detectar hasta 5 personas
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        poseLandmarkerRef.current = poseLandmarker;
        console.log('✅ PoseLandmarker listo');
      }

      // Cargar Face Landmarker
      if (config.enableFace && !faceLandmarkerRef.current) {
        console.log('👤 Cargando FaceLandmarker...');
        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'IMAGE',
          numFaces: 10, // Detectar hasta 10 caras
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputFaceBlendshapes: true, // Para expresiones faciales
          outputFacialTransformationMatrixes: true,
        });
        faceLandmarkerRef.current = faceLandmarker;
        console.log('✅ FaceLandmarker listo');
      }

      setIsReady(true);
      console.log('✅ MediaPipe Vision cargado completamente (isReady=true)');
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      // Restaurar temporalmente para mostrar errores reales
      console.error = originalError;
      console.error('❌ Error cargando MediaPipe:', err);
      setError(`Error cargando MediaPipe: ${errorMsg}`);
      setIsReady(false);
    } finally {
      // Restaurar console.error original
      console.error = originalError;
      setIsLoading(false);
      isLoadingRef.current = false;
      console.log('📊 MediaPipe loadModels completado - isReady:', poseLandmarkerRef.current && faceLandmarkerRef.current);
    }
  }, [config.enablePose, config.enableFace]);

  // Detectar poses
  const detectPose = useCallback((imageData: ImageData): PoseLandmarkerResult | null => {
    if (!poseLandmarkerRef.current) {
      console.warn('⚠️ PoseLandmarker no está cargado');
      return null;
    }

    try {
      const result = poseLandmarkerRef.current.detect(imageData);
      return result;
    } catch (err) {
      console.error('❌ Error en detección de poses:', err);
      return null;
    }
  }, []);

  // Detectar caras
  const detectFace = useCallback((imageData: ImageData): FaceLandmarkerResult | null => {
    if (!faceLandmarkerRef.current) {
      console.warn('⚠️ FaceLandmarker no está cargado');
      return null;
    }

    try {
      const result = faceLandmarkerRef.current.detect(imageData);
      return result;
    } catch (err) {
      console.error('❌ Error en detección de caras:', err);
      return null;
    }
  }, []);

  // Extraer embedding facial (vector de características)
  const extractFaceEmbedding = useCallback((landmarks: { x: number; y: number; z: number }[]): number[] => {
    // MediaPipe Face Mesh tiene 478 landmarks
    // Extraemos un vector simplificado de características clave
    if (!landmarks || landmarks.length === 0) {
      return [];
    }

    // Puntos clave de la cara para crear embedding único
    const keyPoints = [
      0,   // Punta de la nariz
      1,   // Centro entre ojos
      4,   // Barbilla
      33,  // Ojo izquierdo exterior
      133, // Ojo izquierdo interior
      362, // Ojo derecho exterior
      263, // Ojo derecho interior
      61,  // Labio superior izquierdo
      291, // Labio superior derecho
      17,  // Labio inferior izquierdo
      84,  // Labio inferior derecho
    ];

    const embedding: number[] = [];
    keyPoints.forEach(idx => {
      if (landmarks[idx]) {
        embedding.push(landmarks[idx].x, landmarks[idx].y, landmarks[idx].z || 0);
      }
    });

    // Normalizar embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }, []);

  // Calcular similaridad coseno entre dos embeddings
  const calculateSimilarity = useCallback((embedding1: number[], embedding2: number[]): number => {
    if (embedding1.length !== embedding2.length || embedding1.length === 0) {
      return 0;
    }

    let dotProduct = 0;
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
    }

    return dotProduct; // Ya están normalizados
  }, []);

  // Auto-cargar si está habilitado
  useEffect(() => {
    if (config.autoLoad) {
      loadModels();
    }
  }, [config.autoLoad, loadModels]);

  // Cleanup
  useEffect(() => {
    return () => {
      // Suprimir mensajes informativos de MediaPipe durante cleanup
      const originalError = console.error;
      console.error = (...args: unknown[]) => {
        // Filtrar mensajes informativos de MediaPipe que no son errores reales
        const message = args[0]?.toString() || '';
        if (
          message.includes('INFO:') ||
          message.includes('TensorFlow Lite') ||
          message.includes('XNNPACK')
        ) {
          // Silenciar mensajes informativos
          return;
        }
        originalError(...args);
      };

      try {
        if (poseLandmarkerRef.current) {
          poseLandmarkerRef.current.close();
          poseLandmarkerRef.current = null;
        }
      } catch {
        // Ignorar errores durante cleanup de PoseLandmarker
      }

      try {
        if (faceLandmarkerRef.current) {
          faceLandmarkerRef.current.close();
          faceLandmarkerRef.current = null;
        }
      } catch {
        // Ignorar errores durante cleanup de FaceLandmarker
      }

      // Restaurar console.error original
      console.error = originalError;
      
      setIsReady(false);
    };
  }, []);

  return {
    isLoading,
    isReady,
    error,
    loadModels,
    detectPose,
    detectFace,
    extractFaceEmbedding,
    calculateSimilarity,
  };
}
