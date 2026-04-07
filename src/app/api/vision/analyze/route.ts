import { NextRequest, NextResponse } from 'next/server';
import type { VisionAnalysisResult } from '@/types/vision';

/**
 * API endpoint para análisis de visión en tiempo real
 * Recibe una imagen y devuelve detecciones de YOLO, MediaPipe, etc.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageBlob = formData.get('image') as Blob;
    const configStr = formData.get('config') as string;
    const config = configStr ? JSON.parse(configStr) : {};

    if (!imageBlob) {
      return NextResponse.json(
        { error: 'No se proporcionó imagen' },
        { status: 400 }
      );
    }

    // Convertir blob a buffer
    const arrayBuffer = await imageBlob.arrayBuffer();
    // const buffer = Buffer.from(arrayBuffer);

    // En producción, procesaría la imagen real con canvas o sharp
    // const imageData = { data: new Uint8ClampedArray(buffer), width: 1280, height: 720 };

    // Simular análisis (en producción, esto llamaría a YOLO/MediaPipe)
    // Por ahora, devolvemos datos de prueba para que la interfaz funcione
    const mockAnalysis: VisionAnalysisResult = {
      yoloDetections: [
        {
          class: 'person',
          classId: 0,
          bbox: [100, 100, 200, 400],
          confidence: 0.92,
        },
        {
          class: 'backpack',
          classId: 24,
          bbox: [150, 250, 80, 120],
          confidence: 0.78,
        },
      ],
      poseAnalysis: {
        isPointing: false,
        confidence: 0.85,
      },
      faceRecognition: {
        knownFaces: [],
        unknownFaces: [],
        totalFaces: 1,
      },
      groupAnalysis: {
        count: 1,
        type: 'solo',
        hasChildren: false,
        needsAccessibility: false,
        confidence: 0.88,
      },
      objectContext: {
        detectedObjects: ['person', 'backpack'],
        landmarks: [],
        touristIndicators: {
          hasBackpack: true,
          hasSuitcase: false,
          hasCamera: false,
        },
      },
      suggestions: [
        {
          type: 'greeting',
          priority: 'high',
          message: '¡Hola viajero! Veo que llevas mochila. ¿Te gustaría conocer lugares cercanos?',
        },
      ],
      timestamp: Date.now(),
      processingTime: Math.round(Math.random() * 200 + 100), // 100-300ms (redondeado)
      confidenceScore: 0.86,
    };

    // TODO: Implementar análisis real con YOLO/MediaPipe
    // Este es un placeholder que devuelve datos simulados
    console.log('📸 Análisis de visión solicitado:', {
      imageSize: arrayBuffer.byteLength,
      config,
    });

    return NextResponse.json(mockAnalysis);
  } catch (error) {
    console.error('Error en análisis de visión:', error);
    return NextResponse.json(
      { error: 'Error al procesar imagen' },
      { status: 500 }
    );
  }
}

/**
 * Endpoint GET para verificar estado del sistema
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'API de visión IA activa',
    features: {
      yolo: true,
      mediapipe: true,
      faceRecognition: false, // Deshabilitado por defecto por privacidad
    },
  });
}
