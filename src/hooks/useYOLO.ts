'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as ort from 'onnxruntime-web';
import type { YOLOResult, YOLODetection } from '@/types/vision';

interface UseYOLOOptions {
  modelPath?: string;
  scoreThreshold?: number;
  iouThreshold?: number;
  autoLoad?: boolean;
}

const DEFAULT_OPTIONS: Required<UseYOLOOptions> = {
  modelPath: '/models/yolov8n.onnx',
  scoreThreshold: 0.5,
  iouThreshold: 0.45,
  autoLoad: false, // Carga lazy por defecto
};

// Nombres de clases COCO (80 clases)
const COCO_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
  'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
  'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
  'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
  'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
  'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair',
  'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
  'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator',
  'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
];

export function useYOLO(options: UseYOLOOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const sessionRef = useRef<ort.InferenceSession | null>(null);
  const isLoadingRef = useRef(false);

  // Cargar modelo YOLO ONNX
  const loadModel = useCallback(async () => {
    // Si ya está cargado, no hacer nada
    if (sessionRef.current) {
      console.log('✅ YOLO: Modelo ya está cargado');
      setIsReady(true);
      return;
    }
    
    if (isLoadingRef.current) {
      console.log('⏳ YOLO: Ya está cargando, esperando...');
      // Esperar a que termine la carga actual
      while (isLoadingRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      console.log('🔄 Cargando modelo YOLO desde:', config.modelPath);
      
      // Configurar ONNX Runtime para WebGL (más rápido en GPU)
      ort.env.wasm.numThreads = 4;
      ort.env.wasm.simd = true;

      const session = await ort.InferenceSession.create(config.modelPath, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });

      sessionRef.current = session;
      setIsReady(true);
      console.log('✅ Modelo YOLO cargado exitosamente (isReady=true)');
      console.log('📊 Input names:', session.inputNames);
      console.log('📊 Output names:', session.outputNames);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      
      // Mensaje de error mejorado para guiar al usuario
      if (errorMsg.includes('failed to load') || errorMsg.includes('404') || errorMsg.includes('Not Found')) {
        // Usar console.warn en lugar de console.error para no activar error overlay de Next.js
        console.warn(`
⚠️ MODELO YOLO NO ENCONTRADO

El archivo ${config.modelPath} no existe en el servidor.

📋 SOLUCIÓN RÁPIDA:
Ejecuta el script automático: python export_yolo_model.py

📋 O MANUALMENTE:
1. Instala Ultralytics: pip install ultralytics
2. Exporta el modelo: python -c "from ultralytics import YOLO; YOLO('yolov8n.pt').export(format='onnx', simplify=True, opset=12)"
3. Copia el archivo: cp yolov8n.onnx public/models/yolov8n.onnx
4. Reinicia el servidor de desarrollo

📖 Ver: README_YOLO_SETUP.md o QUICKSTART_YOLO.md
        `.trim());
        
        setError('Modelo YOLO no encontrado');
      } else {
        console.error('❌ Error cargando modelo YOLO:', err);
        setError(`Error cargando modelo YOLO: ${errorMsg}`);
      }
      setIsReady(false);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
      console.log('📊 YOLO loadModel completado - isReady:', !!sessionRef.current);
    }
  }, [config.modelPath]);

  // Pre-procesar imagen para YOLO (640x640, normalizada, NCHW)
  const preprocessImage = useCallback((imageData: ImageData): ort.Tensor => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    // YOLO26n espera input 640x640
    const inputSize = 640;
    canvas.width = inputSize;
    canvas.height = inputSize;
    
    // Redimensionar manteniendo aspect ratio
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = imageData.width;
    tmpCanvas.height = imageData.height;
    const tmpCtx = tmpCanvas.getContext('2d')!;
    tmpCtx.putImageData(imageData, 0, 0);
    
    ctx.drawImage(tmpCanvas, 0, 0, inputSize, inputSize);
    const resized = ctx.getImageData(0, 0, inputSize, inputSize);
    
    // Convertir a formato NCHW (batch, channels, height, width) normalizado [0,1]
    const float32Data = new Float32Array(3 * inputSize * inputSize);
    const pixels = resized.data;
    
    for (let i = 0; i < inputSize * inputSize; i++) {
      // RGB normalizado [0, 1]
      float32Data[i] = pixels[i * 4] / 255.0; // R
      float32Data[inputSize * inputSize + i] = pixels[i * 4 + 1] / 255.0; // G
      float32Data[inputSize * inputSize * 2 + i] = pixels[i * 4 + 2] / 255.0; // B
    }
    
    return new ort.Tensor('float32', float32Data, [1, 3, inputSize, inputSize]);
  }, []);

  // Non-Maximum Suppression (NMS)
  const nms = useCallback((boxes: YOLODetection[]): YOLODetection[] => {
    if (boxes.length === 0) return [];
    
    // Ordenar por confidence descendente
    boxes.sort((a, b) => b.confidence - a.confidence);
    
    const selected: YOLODetection[] = [];
    
    for (const box of boxes) {
      let keep = true;
      
      for (const selectedBox of selected) {
        const iou = calculateIoU(box.bbox, selectedBox.bbox);
        if (iou > config.iouThreshold) {
          keep = false;
          break;
        }
      }
      
      if (keep) {
        selected.push(box);
      }
    }
    
    return selected;
  }, [config.iouThreshold]);

  // Calcular Intersection over Union
  const calculateIoU = (boxA: number[], boxB: number[]): number => {
    const [x1A, y1A, w1, h1] = boxA;
    const [x1B, y1B, w2, h2] = boxB;
    
    const x2A = x1A + w1;
    const y2A = y1A + h1;
    const x2B = x1B + w2;
    const y2B = y1B + h2;
    
    const xA = Math.max(x1A, x1B);
    const yA = Math.max(y1A, y1B);
    const xB = Math.min(x2A, x2B);
    const yB = Math.min(y2A, y2B);
    
    const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
    const boxAArea = w1 * h1;
    const boxBArea = w2 * h2;
    const unionArea = boxAArea + boxBArea - interArea;
    
    return interArea / unionArea;
  };

  // Post-procesar output YOLO
  const postprocessOutput = useCallback((output: ort.Tensor): YOLODetection[] => {
    const detections: YOLODetection[] = [];
    const data = output.data as Float32Array;
    const dims = output.dims; // [batch, num_detections, 85] o [batch, 84, num_detections]
    
    // YOLO26n output shape: [1, 84, 8400] -> [batch, (x,y,w,h + 80 classes), anchors]
    const numClasses = 80;
    const numDetections = dims[2]; // 8400 anchors
    
    for (let i = 0; i < numDetections; i++) {
      // Formato: [cx, cy, w, h, class0_score, class1_score, ..., class79_score]
      const cx = data[i];
      const cy = data[numDetections + i];
      const w = data[2 * numDetections + i];
      const h = data[3 * numDetections + i];
      
      // Encontrar clase con mayor score
      let maxScore = 0;
      let maxClassId = 0;
      
      for (let c = 0; c < numClasses; c++) {
        const score = data[(4 + c) * numDetections + i];
        if (score > maxScore) {
          maxScore = score;
          maxClassId = c;
        }
      }
      
      // Filtrar por threshold
      if (maxScore > config.scoreThreshold) {
        // Convertir de centro a esquina superior izquierda
        const x = cx - w / 2;
        const y = cy - h / 2;
        
        detections.push({
          class: COCO_CLASSES[maxClassId] || `class_${maxClassId}`,
          classId: maxClassId,
          bbox: [x, y, w, h],
          confidence: maxScore,
        });
      }
    }
    
    // Aplicar NMS
    return nms(detections);
  }, [config.scoreThreshold, nms]);

  // Ejecutar detección
  const detect = useCallback(async (imageData: ImageData): Promise<YOLOResult> => {
    if (!sessionRef.current) {
      throw new Error('Modelo YOLO no cargado. Llama a loadModel() primero');
    }

    const startTime = performance.now();

    try {
      // Pre-procesar
      const inputTensor = preprocessImage(imageData);
      
      // Ejecutar modelo
      const feeds = { images: inputTensor };
      const results = await sessionRef.current.run(feeds);
      
      // Post-procesar (el output name puede variar, típicamente 'output0' o 'output')
      const outputName = sessionRef.current.outputNames[0];
      const output = results[outputName];
      
      const detections = postprocessOutput(output);
      
      const inferenceTime = performance.now() - startTime;
      
      console.log(`🎯 YOLO detectó ${detections.length} objetos en ${inferenceTime.toFixed(0)}ms`);
      
      return {
        detections,
        inferenceTime,
        timestamp: Date.now(),
      };
      
    } catch (err) {
      console.error('❌ Error en detección YOLO:', err);
      throw err;
    }
  }, [preprocessImage, postprocessOutput]);

  // Auto-cargar si está habilitado
  useEffect(() => {
    if (config.autoLoad) {
      loadModel();
    }
  }, [config.autoLoad, loadModel]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current = null;
        setIsReady(false);
      }
    };
  }, []);

  return {
    isLoading,
    isReady,
    error,
    loadModel,
    detect,
  };
}
