/**
 * Detector de poses y gestos usando MediaPipe
 * Detecta cuando una persona señala hacia algo
 */

import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import type { PoseDetectionResult } from '@/types/vision';

// Índices de landmarks de MediaPipe Pose
const POSE_LANDMARKS = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
};

/**
 * Analiza resultado de pose para detectar gesto de "señalar"
 */
export function analyzePoseForPointing(
  poseResult: PoseLandmarkerResult | null
): PoseDetectionResult {
  if (!poseResult || !poseResult.landmarks || poseResult.landmarks.length === 0) {
    return {
      isPointing: false,
      confidence: 0,
    };
  }

  // Analizar cada persona detectada
  for (const personLandmarks of poseResult.landmarks) {
    // Intentar detectar señalamiento con brazo derecho
    const rightPointing = detectArmPointing(
      personLandmarks,
      POSE_LANDMARKS.RIGHT_SHOULDER,
      POSE_LANDMARKS.RIGHT_ELBOW,
      POSE_LANDMARKS.RIGHT_WRIST,
      POSE_LANDMARKS.RIGHT_INDEX
    );

    if (rightPointing.isPointing) {
      return rightPointing;
    }

    // Intentar detectar señalamiento con brazo izquierdo
    const leftPointing = detectArmPointing(
      personLandmarks,
      POSE_LANDMARKS.LEFT_SHOULDER,
      POSE_LANDMARKS.LEFT_ELBOW,
      POSE_LANDMARKS.LEFT_WRIST,
      POSE_LANDMARKS.LEFT_INDEX
    );

    if (leftPointing.isPointing) {
      return leftPointing;
    }
  }

  return {
    isPointing: false,
    confidence: 0,
    landmarks: poseResult.landmarks[0],
  };
}

/**
 * Detecta si un brazo específico está señalando
 */
function detectArmPointing(
  landmarks: { x: number; y: number; z?: number; visibility?: number }[],
  shoulderIdx: number,
  elbowIdx: number,
  wristIdx: number,
  indexIdx: number
): PoseDetectionResult {
  const shoulder = landmarks[shoulderIdx];
  const elbow = landmarks[elbowIdx];
  const wrist = landmarks[wristIdx];
  const index = landmarks[indexIdx];

  if (!shoulder || !elbow || !wrist || !index) {
    return { isPointing: false, confidence: 0 };
  }

  // Verificar visibilidad de los landmarks
  const minVisibility = 0.5;
  if (
    (shoulder.visibility ?? 0) < minVisibility ||
    (elbow.visibility ?? 0) < minVisibility ||
    (wrist.visibility ?? 0) < minVisibility
  ) {
    return { isPointing: false, confidence: 0 };
  }

  // Calcular vectores
  const shoulderToElbow = {
    x: elbow.x - shoulder.x,
    y: elbow.y - shoulder.y,
    z: (elbow.z || 0) - (shoulder.z || 0),
  };

  const elbowToWrist = {
    x: wrist.x - elbow.x,
    y: wrist.y - elbow.y,
    z: (wrist.z || 0) - (elbow.z || 0),
  };

  // Normalizar vectores
  const normalize = (v: { x: number; y: number; z: number }) => {
    const mag = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    return { x: v.x / mag, y: v.y / mag, z: v.z / mag };
  };

  const v1 = normalize(shoulderToElbow);
  const v2 = normalize(elbowToWrist);

  // Calcular ángulo entre vectores (producto punto)
  const dotProduct = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
  const angleDeg = (angle * 180) / Math.PI;

  // Brazo extendido: ángulo cercano a 180° (casi recto)
  const isExtended = angleDeg > 140 && angleDeg < 200;

  // Verificar que el brazo está elevado (no apuntando hacia abajo)
  const isElevated = wrist.y < shoulder.y + 0.2; // Muñeca por encima del hombro

  // Detectar dirección hacia donde señala
  const pointingDirection = normalize({
    x: wrist.x - shoulder.x,
    y: wrist.y - shoulder.y,
    z: (wrist.z || 0) - (shoulder.z || 0),
  });

  const isPointing = isExtended && isElevated;
  const confidence = isPointing
    ? Math.min(
        shoulder.visibility ?? 0,
        elbow.visibility ?? 0,
        wrist.visibility ?? 0
      )
    : 0;

  return {
    isPointing,
    pointingDirection: isPointing ? pointingDirection : undefined,
    confidence,
  };
}

/**
 * Estima la altura de una persona en relación al frame
 * Útil para detectar niños vs adultos
 */
export function estimatePersonHeight(landmarks: { x: number; y: number; z: number; visibility?: number }[]): number {
  if (!landmarks || landmarks.length === 0) {
    return 0;
  }

  const head = landmarks[0]; // Nariz (punto más alto)
  const leftFoot = landmarks[31];
  const rightFoot = landmarks[32];

  if (!head || (!leftFoot && !rightFoot)) {
    return 0;
  }

  const foot = leftFoot || rightFoot;
  const height = Math.abs(head.y - foot.y);

  return height;
}

/**
 * Clasifica edad aproximada basada en altura relativa
 */
export function classifyAge(relativeHeight: number): 'niño' | 'adulto' {
  // En un frame normalizado, niños típicamente ocupan menos altura
  // Este es un estimado muy básico
  return relativeHeight < 0.5 ? 'niño' : 'adulto';
}
