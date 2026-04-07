/**
 * Analizador de grupos de personas
 * Combina detecciones de YOLO (personas) con MediaPipe (poses/caras)
 * para clasificar el tipo y características del grupo
 */

import type { YOLODetection } from '@/types/vision';
import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import type { GroupAnalysis } from '@/types/vision';
import { estimatePersonHeight, classifyAge } from './pose-detector';
import { COCO_CLASSES } from '@/types/vision';

/**
 * Analiza grupo de personas detectadas
 */
export function analyzeGroup(
  yoloDetections: YOLODetection[],
  poseResult: PoseLandmarkerResult | null
): GroupAnalysis {
  // Contar personas detectadas por YOLO
  const personDetections = yoloDetections.filter(
    d => d.classId === COCO_CLASSES.PERSON
  );
  const personCount = personDetections.length;

  // Verificar si hay poses detectadas (puede ser diferente del conteo YOLO)
  const poseCount = poseResult?.landmarks?.length || 0;

  // Usar el conteo más confiable (el mayor, típicamente)
  const totalPeople = Math.max(personCount, poseCount);

  // Detectar indicadores de movilidad reducida
  const hasWheelchair = yoloDetections.some(
    d => d.class.toLowerCase().includes('wheelchair')
  );

  // Analizar edades aproximadas si tenemos poses
  let hasChildren = false;
  let averageAge: GroupAnalysis['averageAge'] = 'adultos';

  if (poseResult && poseResult.landmarks && poseResult.landmarks.length > 0) {
    const heights = poseResult.landmarks.map(estimatePersonHeight);
    const ages = heights.map(classifyAge);
    
    hasChildren = ages.some(age => age === 'niño');

    // Clasificar edad promedio del grupo
    const childCount = ages.filter(a => a === 'niño').length;
    if (childCount > totalPeople / 2) {
      averageAge = 'niños';
    } else if (heights.filter(h => h > 0.6).length === totalPeople) {
      // Todos son altos -> adultos o mayores
      // Este es un estimado muy básico
      averageAge = 'adultos';
    }
  }

  // Detectar objetos típicos de turistas (potencial uso futuro)
  // const touristIndicators = {
  //   hasBackpack: yoloDetections.some(d => d.classId === COCO_CLASSES.BACKPACK),
  //   hasSuitcase: yoloDetections.some(d => d.classId === COCO_CLASSES.SUITCASE),
  //   hasCamera: false, // YOLO no detecta cámaras directamente en COCO
  // };

  // Clasificar tipo de grupo
  let groupType: GroupAnalysis['type'];
  if (totalPeople === 0) {
    groupType = 'solo';
  } else if (totalPeople === 1) {
    groupType = 'solo';
  } else if (totalPeople === 2) {
    groupType = 'pareja';
  } else if (totalPeople >= 3 && totalPeople <= 4) {
    groupType = hasChildren ? 'familia' : 'grupo_grande';
  } else {
    groupType = 'grupo_grande';
  }

  // Calcular confidence basado en coincidencia YOLO-MediaPipe
  let confidence = 0.5; // Base
  if (personCount > 0 && poseCount > 0) {
    const match = Math.min(personCount, poseCount) / Math.max(personCount, poseCount);
    confidence = 0.5 + (match * 0.5); // 0.5 a 1.0
  } else if (personCount > 0 || poseCount > 0) {
    confidence = 0.6;
  }

  return {
    count: totalPeople,
    type: groupType,
    hasChildren,
    needsAccessibility: hasWheelchair,
    averageAge,
    confidence,
  };
}

/**
 * Genera descripción textual del grupo para usar en prompts
 */
export function describeGroup(analysis: GroupAnalysis): string {
  const parts: string[] = [];

  // Cantidad
  if (analysis.count === 0) {
    return 'No se detectaron personas en la escena';
  } else if (analysis.count === 1) {
    parts.push('1 persona');
  } else {
    parts.push(`${analysis.count} personas`);
  }

  // Tipo
  const typeDescriptions = {
    solo: 'viajando sola',
    pareja: 'en pareja',
    familia: 'grupo familiar',
    grupo_grande: 'grupo grande',
  };
  parts.push(typeDescriptions[analysis.type]);

  // Niños
  if (analysis.hasChildren) {
    parts.push('con niños');
  }

  // Accesibilidad
  if (analysis.needsAccessibility) {
    parts.push('con necesidades de accesibilidad (silla de ruedas detectada)');
  }

  // Edad promedio
  if (analysis.averageAge && analysis.averageAge !== 'adultos') {
    parts.push(`edad promedio: ${analysis.averageAge}`);
  }

  return parts.join(', ');
}

/**
 * Genera sugerencias específicas basadas en el análisis del grupo
 */
export function getGroupSuggestions(analysis: GroupAnalysis): {
  activities: string[];
  places: string[];
  considerations: string[];
} {
  const suggestions = {
    activities: [] as string[],
    places: [] as string[],
    considerations: [] as string[],
  };

  switch (analysis.type) {
    case 'solo':
      suggestions.activities.push(
        'recorridos culturales',
        'visitas a museos',
        'cafeterías para trabajar'
      );
      suggestions.places.push('bibliotecas', 'cafés tranquilos', 'miradores');
      break;

    case 'pareja':
      suggestions.activities.push(
        'paseos románticos',
        'cenas en restaurantes',
        'miradores panorámicos'
      );
      suggestions.places.push(
        'restaurantes románticos',
        'parques con bancos',
        'lugares con vistas'
      );
      break;

    case 'familia':
      suggestions.activities.push(
        'visitas a parques',
        'museos interactivos',
        'áreas de juegos'
      );
      suggestions.places.push(
        'parques infantiles',
        'museos para niños',
        'restaurantes familiares'
      );
      if (analysis.hasChildren) {
        suggestions.considerations.push('espacios abiertos para que los niños jueguen');
        suggestions.considerations.push('baños cercanos');
      }
      break;

    case 'grupo_grande':
      suggestions.activities.push(
        'tours grupales',
        'eventos culturales',
        'restaurantes con mesas grandes'
      );
      suggestions.places.push(
        'plazas amplias',
        'centros culturales',
        'restaurantes con capacidad'
      );
      suggestions.considerations.push('espacios amplios para el grupo');
      break;
  }

  // Consideraciones de accesibilidad
  if (analysis.needsAccessibility) {
    suggestions.considerations.push('IMPORTANTE: lugares con acceso para sillas de ruedas');
    suggestions.considerations.push('rampas y elevadores disponibles');
    suggestions.places = suggestions.places.map(p => `${p} (accesible)`);
  }

  return suggestions;
}
