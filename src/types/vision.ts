/**
 * Tipos TypeScript para el sistema de visión artificial
 * con YOLO + MediaPipe
 */

import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

// ============ YOLO Types ============

export interface YOLODetection {
  class: string;
  classId: number;
  bbox: [number, number, number, number]; // [x, y, width, height]
  confidence: number;
}

export interface YOLOResult {
  detections: YOLODetection[];
  inferenceTime: number; // ms
  timestamp: number;
}

// Clases COCO relevantes para turismo
export const COCO_CLASSES = {
  PERSON: 0,
  BICYCLE: 1,
  CAR: 2,
  MOTORCYCLE: 3,
  BUS: 5,
  TRUCK: 7,
  TRAFFIC_LIGHT: 9,
  FIRE_HYDRANT: 10,
  STOP_SIGN: 11,
  BENCH: 13,
  BACKPACK: 24,
  UMBRELLA: 25,
  HANDBAG: 26,
  TIE: 27,
  SUITCASE: 28,
  CHAIR: 56,
  DINING_TABLE: 60,
  CELL_PHONE: 67,
  BOOK: 73,
  CLOCK: 74,
} as const;

// ============ MediaPipe Types ============

export interface PoseDetectionResult {
  isPointing: boolean;
  pointingDirection?: {
    x: number;
    y: number;
    z: number;
  };
  landmarks?: NormalizedLandmark[];
  confidence: number;
}

export interface FaceEmbedding {
  embedding: number[]; // 128-dimensional vector
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
}

export interface FaceRecognitionResult {
  knownFaces: {
    id: string;
    nickname: string;
    visits: number;
    lastSeen: Date;
    similarity: number;
  }[];
  unknownFaces: FaceEmbedding[];
  totalFaces: number;
}

// ============ Analysis Types ============

export interface GroupAnalysis {
  count: number;
  type: 'solo' | 'pareja' | 'familia' | 'grupo_grande';
  hasChildren: boolean;
  needsAccessibility: boolean;
  averageAge?: 'niños' | 'jóvenes' | 'adultos' | 'mayores';
  confidence: number;
}

export interface ObjectContext {
  detectedObjects: string[];
  landmarks: {
    name: string;
    confidence: number;
    matchedAttractionId?: string;
  }[];
  touristIndicators: {
    hasBackpack: boolean;
    hasSuitcase: boolean;
    hasCamera: boolean;
  };
}

export interface VisionAnalysisResult {
  // Detecciones primarias
  yoloDetections: YOLODetection[];
  poseAnalysis: PoseDetectionResult | null;
  faceRecognition: FaceRecognitionResult;
  
  // Análisis consolidado
  groupAnalysis: GroupAnalysis;
  objectContext: ObjectContext;
  
  // Sugerencias
  suggestions: {
    type: 'greeting' | 'activity' | 'accessibility' | 'location_info' | 'announcement';
    priority: 'high' | 'medium' | 'low';
    message: string;
    actionData?: Record<string, unknown>;
  }[];
  
  // Metadata
  timestamp: number;
  processingTime: number;
  confidenceScore: number;
}

// ============ Context for Chat API ============

export interface VisionContext {
  summary: string;
  detectedPeople: number;
  groupType: string;
  pointingAt?: string;
  knownFaces: string[];
  detectedObjects: string[];
  landmarks: string[];
  needsAccessibility: boolean;
  timestamp: number;
}

// ============ Database Types ============

export interface FaceEmbeddingRecord {
  id: string;
  user_id: string | null;
  embedding: number[];
  first_seen: string;
  last_seen: string;
  nickname: string | null;
  visit_count: number;
  metadata?: Record<string, unknown>;
}

export interface VisionAnalysisLog {
  id: string;
  user_id: string | null;
  timestamp: string;
  location: {
    lat: number;
    lng: number;
  } | null;
  detections: {
    people_count: number;
    objects: string[];
    landmarks: string[];
  };
  suggestions_given: string[];
  confidence: number;
}

// ============ Hook States ============

export interface VisionLoadingState {
  yolo: boolean;
  mediapipe: boolean;
  overall: boolean;
}

export interface VisionError {
  source: 'yolo' | 'mediapipe' | 'frame_capture' | 'orchestrator';
  message: string;
  details?: unknown;
}
