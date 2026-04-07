/**
 * Reconocimiento facial con MediaPipe
 * Genera embeddings y compara con caras almacenadas en Supabase
 */

import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import type { FaceEmbedding, FaceRecognitionResult, FaceEmbeddingRecord } from '@/types/vision';
import { supabase } from '@/lib/supabase';

const SIMILARITY_THRESHOLD = 0.7; // Umbral para considerar una cara como "conocida"

/**
 * Extrae embeddings de caras detectadas
 */
export function extractFaceEmbeddings(
  faceResult: FaceLandmarkerResult | null
): FaceEmbedding[] {
  if (!faceResult || !faceResult.faceLandmarks || faceResult.faceLandmarks.length === 0) {
    return [];
  }

  const embeddings: FaceEmbedding[] = [];

  faceResult.faceLandmarks.forEach((landmarks) => {
    // Generar embedding simplificado de puntos clave
    const keyPoints = [
      1,   // Centro entre ojos
      4,   // Barbilla
      33,  // Ojo izquierdo exterior
      133, // Ojo izquierdo interior
      362, // Ojo derecho exterior
      263, // Ojo derecho interior
      61,  // Comisura labio izquierda
      291, // Comisura labio derecha
    ];

    const embedding: number[] = [];
    keyPoints.forEach(pointIdx => {
      if (landmarks[pointIdx]) {
        embedding.push(
          landmarks[pointIdx].x,
          landmarks[pointIdx].y,
          landmarks[pointIdx].z || 0
        );
      }
    });

    // Normalizar embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    const normalized = embedding.map(val => val / (magnitude || 1));

    // Calcular bounding box aproximado
    const xs = landmarks.map(l => l.x);
    const ys = landmarks.map(l => l.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    embeddings.push({
      embedding: normalized,
      boundingBox: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      },
      confidence: 0.8, // MediaPipe no da confidence por cara, usar valor por defecto
    });
  });

  return embeddings;
}

/**
 * Calcula similaridad coseno entre dos embeddings
 */
function calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length || embedding1.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
  }

  return dotProduct; // Ya están normalizados, así que esto es la similaridad coseno
}

/**
 * Busca caras conocidas comparando con embeddings almacenados
 */
export async function recognizeFaces(
  embeddings: FaceEmbedding[]
): Promise<FaceRecognitionResult> {
  if (embeddings.length === 0) {
    return {
      knownFaces: [],
      unknownFaces: [],
      totalFaces: 0,
    };
  }

  try {
    // Obtener todos los embeddings almacenados
    const { data: storedEmbeddings, error } = await supabase
      .from('face_embeddings')
      .select('*')
      .order('last_seen', { ascending: false })
      .limit(100); // Limitar a las 100 caras más recientes

    if (error) {
      console.error('Error obteniendo embeddings:', error);
      return {
        knownFaces: [],
        unknownFaces: embeddings,
        totalFaces: embeddings.length,
      };
    }

    const knownFaces: FaceRecognitionResult['knownFaces'] = [];
    const unknownFaces: FaceEmbedding[] = [];

    // Comparar cada cara detectada con las almacenadas
    for (const detectedFace of embeddings) {
      let bestMatch: FaceEmbeddingRecord | null = null;
      let bestSimilarity = 0;

      for (const storedFace of (storedEmbeddings || [])) {
        const similarity = calculateCosineSimilarity(
          detectedFace.embedding,
          storedFace.embedding
        );

        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = storedFace;
        }
      }

      if (bestMatch && bestSimilarity >= SIMILARITY_THRESHOLD) {
        // Cara conocida encontrada
        knownFaces.push({
          id: bestMatch.id,
          nickname: bestMatch.nickname || 'Visitante',
          visits: bestMatch.visit_count,
          lastSeen: new Date(bestMatch.last_seen),
          similarity: bestSimilarity,
        });

        // Actualizar last_seen y visit_count
        await supabase
          .from('face_embeddings')
          .update({
            last_seen: new Date().toISOString(),
            visit_count: bestMatch.visit_count + 1,
          })
          .eq('id', bestMatch.id);
      } else {
        // Cara desconocida, guardar como nueva
        unknownFaces.push(detectedFace);

        // Opcionalmente, almacenar nueva cara
        await supabase.from('face_embeddings').insert({
          embedding: detectedFace.embedding,
          first_seen: new Date().toISOString(),
          last_seen: new Date().toISOString(),
          visit_count: 1,
          nickname: null, // Sin nombre aún
        });
      }
    }

    return {
      knownFaces,
      unknownFaces,
      totalFaces: embeddings.length,
    };
  } catch (err) {
    console.error('Error en reconocimiento facial:', err);
    return {
      knownFaces: [],
      unknownFaces: embeddings,
      totalFaces: embeddings.length,
    };
  }
}

/**
 * Elimina una cara de la base de datos (GDPR compliance)
 */
export async function forgetFace(faceId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('face_embeddings')
      .delete()
      .eq('id', faceId);

    if (error) {
      console.error('Error eliminando cara:', error);
      return false;
    }

    console.log('✅ Cara eliminada:', faceId);
    return true;
  } catch (err) {
    console.error('Error en forgetFace:', err);
    return false;
  }
}

/**
 * Purga caras antiguas (no vistas en X días)
 */
export async function purgeOldFaces(daysOld: number = 90): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { data, error } = await supabase
      .from('face_embeddings')
      .delete()
      .lt('last_seen', cutoffDate.toISOString())
      .select('id');

    if (error) {
      console.error('Error purgando caras antiguas:', error);
      return 0;
    }

    const count = data?.length || 0;
    console.log(`🗑️ Purgadas ${count} caras no vistas en ${daysOld} días`);
    return count;
  } catch (err) {
    console.error('Error en purgeOldFaces:', err);
    return 0;
  }
}
