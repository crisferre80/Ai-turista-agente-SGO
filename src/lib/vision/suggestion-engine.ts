/**
 * Motor de sugerencias inteligentes
 * Genera acciones y recomendaciones basadas en análisis visual
 */

import type { 
  GroupAnalysis, 
  ObjectContext, 
  FaceRecognitionResult,
  PoseDetectionResult,
  VisionAnalysisResult
} from '@/types/vision';
import { getGroupSuggestions } from './group-analyzer';

export interface Suggestion {
  type: 'greeting' | 'activity' | 'accessibility' | 'location_info' | 'announcement';
  priority: 'high' | 'medium' | 'low';
  message: string;
  actionData?: Record<string, unknown>;
}

/**
 * Genera sugerencias basadas en todo el análisis visual
 */
export function generateSuggestions(
  groupAnalysis: GroupAnalysis,
  objectContext: ObjectContext,
  faceRecognition: FaceRecognitionResult,
  poseAnalysis: PoseDetectionResult | null
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // 1. Saludos personalizados (caras conocidas)
  const greetings = generateGreetings(faceRecognition);
  suggestions.push(...greetings);

  // 2. Sugerencias de actividades basadas en grupo
  const activities = generateActivitySuggestions(groupAnalysis);
  suggestions.push(...activities);

  // 3. Información de lugares detectados
  const locationInfo = generateLocationInfo(objectContext, poseAnalysis);
  suggestions.push(...locationInfo);

  // 4. Alertas de accesibilidad
  if (groupAnalysis.needsAccessibility) {
    suggestions.push({
      type: 'accessibility',
      priority: 'high',
      message: 'Detecto necesidades de accesibilidad. Te mostraré solo lugares con rampas y elevadores.',
      actionData: { filterAccessible: true },
    });
  }

  // 5. Anuncios especiales
  const announcements = generateAnnouncements(groupAnalysis, objectContext);
  suggestions.push(...announcements);

  return suggestions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Genera saludos personalizados para caras conocidas
 */
function generateGreetings(faceRecognition: FaceRecognitionResult): Suggestion[] {
  const suggestions: Suggestion[] = [];

  if (faceRecognition.knownFaces.length > 0) {
    const firstKnown = faceRecognition.knownFaces[0];
    
    const daysSinceLastVisit = Math.floor(
      (Date.now() - firstKnown.lastSeen.getTime()) / (1000 * 60 * 60 * 24)
    );

    let greeting = '';
    if (daysSinceLastVisit === 0) {
      greeting = `¡Hola de nuevo, ${firstKnown.nickname}! Veo que sigues explorando por aquí.`;
    } else if (daysSinceLastVisit === 1) {
      greeting = `¡Qué bueno verte otra vez, ${firstKnown.nickname}! Ayer también te vi por aquí.`;
    } else if (daysSinceLastVisit < 7) {
      greeting = `¡Bienvenido nuevamente, ${firstKnown.nickname}! Esta es tu visita número ${firstKnown.visits}.`;
    } else if (daysSinceLastVisit < 30) {
      greeting = `¡Hola ${firstKnown.nickname}! Hace ${daysSinceLastVisit} días que no te veía. ¿Qué te trae por aquí hoy?`;
    } else {
      greeting = `¡Bienvenido de vuelta, ${firstKnown.nickname}! Ha pasado un tiempo desde tu última visita.`;
    }

    suggestions.push({
      type: 'greeting',
      priority: 'high',
      message: greeting,
      actionData: {
        userId: firstKnown.id,
        visits: firstKnown.visits,
      },
    });
  }

  return suggestions;
}

/**
 * Genera sugerencias de actividades según el tipo de grupo
 */
function generateActivitySuggestions(groupAnalysis: GroupAnalysis): Suggestion[] {
  const suggestions: Suggestion[] = [];

  if (groupAnalysis.count === 0) {
    return suggestions;
  }

  const groupSuggestions = getGroupSuggestions(groupAnalysis);

  // Construir mensaje basado en tipo de grupo
  let message = '';
  const { type, count, hasChildren } = groupAnalysis;

  switch (type) {
    case 'solo':
      message = '¿Viajas solo? Te recomiendo lugares tranquilos como cafeterías, bibliotecas o recorridos culturales.';
      break;

    case 'pareja':
      message = 'Veo que vienes en pareja. ¿Qué tal un paseo romántico por el centro histórico o una cena con vistas?';
      break;

    case 'familia':
      if (hasChildren) {
        message = `Veo que vienes con tu familia y ${count > 2 ? 'algunos' : 'un'} niño${count > 3 ? 's' : ''}. Te sugiero parques, museos interactivos o áreas de juegos.`;
      } else {
        message = `Perfecto para un grupo familiar como el tuyo: tours grupales, restaurantes amplios o eventos culturales.`;
      }
      break;

    case 'grupo_grande':
      message = `Veo que son un grupo de ${count} personas. Les recomiendo plazas amplias, centros culturales o restaurantes con capacidad para grupos.`;
      break;
  }

  if (message) {
    suggestions.push({
      type: 'activity',
      priority: 'medium',
      message,
      actionData: {
        groupType: type,
        count,
        hasChildren,
        suggestedPlaces: groupSuggestions.places,
        suggestedActivities: groupSuggestions.activities,
      },
    });
  }

  return suggestions;
}

/**
 * Genera información sobre lugares detectados o señalados
 */
function generateLocationInfo(
  objectContext: ObjectContext,
  poseAnalysis: PoseDetectionResult | null
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Si hay landmarks detectados y la persona está señalando
  if (poseAnalysis?.isPointing && objectContext.landmarks.length > 0) {
    const landmark = objectContext.landmarks[0];
    suggestions.push({
      type: 'location_info',
      priority: 'high',
      message: `Veo que señalas hacia ${landmark.name}. ¿Quieres que te cuente más sobre este lugar?`,
      actionData: {
        landmark: landmark.name,
        attractionId: landmark.matchedAttractionId,
        pointing: true,
      },
    });
  } else if (objectContext.landmarks.length > 0) {
    // Landmarks detectados sin gesto de señalar
    const landmarkNames = objectContext.landmarks.slice(0, 2).map(l => l.name).join(' y ');
    suggestions.push({
      type: 'location_info',
      priority: 'medium',
      message: `Detecto que estás cerca de ${landmarkNames}. ¿Te interesa saber más?`,
      actionData: {
        landmarks: objectContext.landmarks.map(l => ({
          name: l.name,
          id: l.matchedAttractionId,
        })),
      },
    });
  }

  return suggestions;
}

/**
 * Genera anuncios especiales basados en contexto
 */
function generateAnnouncements(
  groupAnalysis: GroupAnalysis,
  objectContext: ObjectContext
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Anuncio si detectamos turistas (mochilas, maletas)
  if (
    objectContext.touristIndicators.hasBackpack ||
    objectContext.touristIndicators.hasSuitcase
  ) {
    suggestions.push({
      type: 'announcement',
      priority: 'low',
      message: '¡Bienvenidos turistas! Recuerden que pueden guardar sus pertenencias en consignas cercanas si necesitan visitarmonumentos.',
      actionData: {
        isTourist: true,
      },
    });
  }

  // Anuncio especial para grupos grandes
  if (groupAnalysis.type === 'grupo_grande' && groupAnalysis.count >= 8) {
    suggestions.push({
      type: 'announcement',
      priority: 'medium',
      message: 'Para grupos grandes como el suyo, ofrecemos tours guiados especiales. ¿Les interesa?',
      actionData: {
        groupSize: groupAnalysis.count,
        offerGroupTour: true,
      },
    });
  }

  return suggestions;
}

/**
 * Genera contexto enriquecido para enviar al chat API
 */
export function buildVisionContextForChat(result: VisionAnalysisResult | null): string {
  if (!result) {
    return '';
  }
  
  const parts: string[] = [];

  // Grupo
  if (result.groupAnalysis.count > 0) {
    parts.push(`Personas detectadas: ${result.groupAnalysis.count}`);
    parts.push(`Tipo: ${result.groupAnalysis.type}`);
    if (result.groupAnalysis.hasChildren) {
      parts.push('Con niños');
    }
    if (result.groupAnalysis.needsAccessibility) {
      parts.push('IMPORTANTE: Necesita accesibilidad (silla de ruedas)');
    }
  }

  // Caras conocidas
  if (result.faceRecognition.knownFaces.length > 0) {
    const names = result.faceRecognition.knownFaces.map(f => f.nickname).join(', ');
    parts.push(`Personas conocidas: ${names}`);
  }

  // Gestos
  if (result.poseAnalysis?.isPointing) {
    parts.push('Gesto: Señalando hacia algo');
  }

  // Objetos y lugares
  if (result.objectContext.landmarks.length > 0) {
    const landmarks = result.objectContext.landmarks.map(l => l.name).join(', ');
    parts.push(`Lugares cercanos detectados: ${landmarks}`);
  }

  // Objetos relevantes
  const objects = result.objectContext.detectedObjects
    .filter(o => !['person'].includes(o))
    .slice(0, 5);
  if (objects.length > 0) {
    parts.push(`Objetos: ${objects.join(', ')}`);
  }

  return parts.join('. ');
}
