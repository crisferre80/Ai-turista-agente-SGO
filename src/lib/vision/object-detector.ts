/**
 * Detector contextual de objetos
 * Combina detecciones YOLO con matching semántico de atractivos turísticos
 */

import type { YOLODetection, ObjectContext } from '@/types/vision';
import { supabase } from '@/lib/supabase';

// Mapeo de categorías YOLO a términos turísticos
const OBJECT_TO_LANDMARK_MAP: Record<string, string[]> = {
  'church': ['iglesia', 'catedral', 'templo', 'basílica'],
  'building': ['edificio', 'museo', 'monumento', 'palacio'],
  'bench': ['plaza', 'parque', 'jardín'],
  'traffic light': ['calle', 'avenida', 'centro'],
  'fire hydrant': ['calle', 'barrio'],
  'stop sign': ['intersección', 'esquina'],
  'bus': ['transporte', 'parada', 'terminal'],
  'car': ['estacionamiento', 'parking'],
  'bicycle': ['ciclovía', 'paseo'],
  'clock': ['torre', 'reloj', 'plaza'],
  'potted plant': ['jardín', 'parque', 'plaza'],
};

/**
 * Analiza objetos detectados y los contextualiza
 */
export async function analyzeObjects(
  yoloDetections: YOLODetection[],
  userLocation?: { lat: number; lng: number }
): Promise<ObjectContext> {
  const detectedObjects = yoloDetections.map(d => d.class);

  // Identificar indicadores turísticos
  const touristIndicators = {
    hasBackpack: detectedObjects.includes('backpack'),
    hasSuitcase: detectedObjects.includes('suitcase'),
    hasCamera: detectedObjects.includes('cell phone'), // Proxy para cámaras
  };

  // Intentar hacer matching con landmarks conocidos
  const landmarks = await matchLandmarks(yoloDetections, userLocation);

  return {
    detectedObjects: [...new Set(detectedObjects)], // Únicos
    landmarks,
    touristIndicators,
  };
}

/**
 * Busca atractivos cercanos que coincidan con objetos detectados
 */
async function matchLandmarks(
  detections: YOLODetection[],
  userLocation?: { lat: number; lng: number }
): Promise<ObjectContext['landmarks']> {
  const landmarks: ObjectContext['landmarks'] = [];

  try {
    // Extraer posibles términos de búsqueda
    const searchTerms = new Set<string>();
    detections.forEach(detection => {
      const mappedTerms = OBJECT_TO_LANDMARK_MAP[detection.class];
      if (mappedTerms) {
        mappedTerms.forEach(term => searchTerms.add(term));
      }
    });

    if (searchTerms.size === 0) {
      return landmarks;
    }

    // Buscar atractivos que coincidan
    let query = supabase
      .from('attractions')
      .select('id, name, category, lat, lng, description');

    // Si tenemos ubicación,priorizar cercanía
    if (userLocation) {
      // Buscar en radio de 1km aproximadamente
      const latRange = 0.009; // ~1km
      const lngRange = 0.009;

      query = query
        .gte('lat', userLocation.lat - latRange)
        .lte('lat', userLocation.lat + latRange)
        .gte('lng', userLocation.lng - lngRange)
        .lte('lng', userLocation.lng + lngRange);
    }

    const { data: attractions, error } = await query.limit(20);

    if (error) {
      console.error('Error buscando atractivos:', error);
      return landmarks;
    }

    // Hacer matching semántico
    if (attractions) {
      for (const attraction of attractions) {
        const nameLC = attraction.name.toLowerCase();
        const categoryLC = attraction.category?.toLowerCase() || '';
        const descLC = attraction.description?.toLowerCase() || '';

        let matched = false;
        let matchConfidence = 0;

        for (const term of searchTerms) {
          if (nameLC.includes(term) || categoryLC.includes(term)) {
            matched = true;
            matchConfidence = 0.8;
            break;
          } else if (descLC.includes(term)) {
            matched = true;
            matchConfidence = 0.6;
          }
        }

        if (matched) {
          landmarks.push({
            name: attraction.name,
            confidence: matchConfidence,
            matchedAttractionId: attraction.id,
          });
        }
      }
    }
  } catch (err) {
    console.error('Error en matchLandmarks:', err);
  }

  // Ordenar por confidence
  return landmarks.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

/**
 * Genera descripción textual de objetos detectados
 */
export function describeObjects(context: ObjectContext): string {
  const parts: string[] = [];

  // Objetos relevantes (filtrar "person" que ya se maneja en groupAnalysis)
  const relevantObjects = context.detectedObjects.filter(
    obj => !['person'].includes(obj)
  );

  if (relevantObjects.length > 0) {
    parts.push(`Objetos detectados: ${relevantObjects.slice(0, 5).join(', ')}`);
  }

  // Landmarks
  if (context.landmarks.length > 0) {
    const landmarkNames = context.landmarks.map(l => l.name);
    parts.push(`Posibles lugares cercanos: ${landmarkNames.join(', ')}`);
  }

  // Indicadores turísticos
  if (context.touristIndicators.hasBackpack || context.touristIndicators.hasSuitcase) {
    parts.push('Indicadores de turistas detectados (mochilas/maletas)');
  }

  return parts.join('. ') || 'No se detectaron objetos relevantes';
}
