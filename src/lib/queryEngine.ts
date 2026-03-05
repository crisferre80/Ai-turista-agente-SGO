/**
 * Query Engine - Sistema centralizado de consultas para Santi
 * 
 * Prioridad de búsqueda:
 * 1. FAQs predefinidas (instantáneas, sin LLM)
 * 2. Búsqueda en base de datos local con scoring inteligente
 * 3. Fallback a LLM solo si no hay coincidencias
 */

import faqsData from '@/data/faqs.json';

export type QuerySource = 'faq' | 'local' | 'llm' | 'none';

export interface QueryResult {
  reply: string;
  source: QuerySource;
  placeId?: string | null;
  placeName?: string | null;
  score?: number;
  confidence: 'high' | 'medium' | 'low';
  matchedKeywords?: string[];
}

interface FAQ {
  keywords: string[];
  reply: string;
  placeId: string | null;
  placeName: string | null;
}

interface FAQsStructure {
  [locale: string]: {
    [key: string]: FAQ;
  };
}

const faqs = faqsData as FAQsStructure;

/**
 * Normaliza texto: remueve acentos, caracteres especiales y convierte a minúsculas
 */
function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrae palabras significativas (filtrado de stop words)
 */
function extractKeywords(text: string): string[] {
  const commonWords = new Set([
    'donde', 'puedo', 'quiero', 'como', 'cual', 'para', 'con', 'sin', 
    'sobre', 'desde', 'hasta', 'entre', 'hay', 'esta', 'son', 'tiene', 
    'hacer', 'lugar', 'lugares', 'sitio', 'sitios', 'que', 'del', 'las', 
    'los', 'una', 'uno', 'debe', 'pueda', 'seria', 'the', 'and', 'for',
    'with', 'from', 'this', 'that', 'what', 'where', 'when', 'how'
  ]);
  
  const normalized = normalizeText(text);
  return normalized
    .split(/\s+/)
    .filter(w => w.length > 2 && !commonWords.has(w));
}

/**
 * Busca en FAQs predefinidas
 */
function searchFAQs(query: string, locale: string = 'es'): QueryResult | null {
  const normalizedQuery = normalizeText(query);
  const queryKeywords = extractKeywords(query);
  
  const localeFAQs = faqs[locale] || faqs['es'];
  
  let bestMatch: { faq: FAQ; score: number; matchedKeywords: string[] } | null = null;
  let bestScore = 0;
  
  for (const [key, faq] of Object.entries(localeFAQs)) {
    let score = 0;
    const matchedKeywords: string[] = [];
    
    // Buscar coincidencias en keywords de la FAQ
    for (const keyword of faq.keywords) {
      const normalizedKeyword = normalizeText(keyword);
      
      // Coincidencia exacta en la query
      if (normalizedQuery.includes(normalizedKeyword)) {
        score += 10;
        matchedKeywords.push(keyword);
      }
      
      // Coincidencia en palabras extraídas
      if (queryKeywords.some(qk => normalizedKeyword.includes(qk))) {
        score += 5;
        if (!matchedKeywords.includes(keyword)) {
          matchedKeywords.push(keyword);
        }
      }
    }
    
    // Bonus si el key de la FAQ está en la query
    if (normalizedQuery.includes(normalizeText(key))) {
      score += 15;
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { faq, score, matchedKeywords };
    }
  }
  
  // Threshold: necesitamos al menos score de 10 para considerar una FAQ como válida
  if (bestMatch && bestScore >= 10) {
    console.log(`✅ FAQ Match encontrada: score ${bestScore}, keywords: ${bestMatch.matchedKeywords.join(', ')}`);
    return {
      reply: bestMatch.faq.reply,
      source: 'faq',
      placeId: bestMatch.faq.placeId,
      placeName: bestMatch.faq.placeName,
      score: bestScore,
      confidence: bestScore >= 20 ? 'high' : bestScore >= 15 ? 'medium' : 'low',
      matchedKeywords: bestMatch.matchedKeywords
    };
  }
  
  console.log(`❌ No se encontró FAQ adecuada (mejor score: ${bestScore})`);
  return null;
}

/**
 * Motor de consultas principal
 * @param query - Consulta del usuario
 * @param locale - Idioma (es, en, pt, fr)
 * @returns Resultado de la búsqueda
 */
export async function querySanti(
  query: string,
  locale: string = 'es'
): Promise<QueryResult> {
  console.log('🔍 QueryEngine: Procesando consulta:', query);
  console.log('🌐 Locale:', locale);
  
  // PASO 1: Buscar en FAQs (respuesta instantánea)
  const faqResult = searchFAQs(query, locale);
  
  if (faqResult && faqResult.confidence === 'high') {
    console.log('⚡ Respuesta instantánea desde FAQ');
    return faqResult;
  }
  
  // Si hay un match medio de FAQ, lo guardamos como candidato
  // pero seguimos buscando en BD local por si hay algo mejor
  const candidateResult = faqResult;
  
  // PASO 2: Buscar en base de datos local
  // (Esta lógica será manejada por el algoritmo existente en /api/chat
  // solo retornamos null para que continúe con la búsqueda local)
  
  console.log('🔄 No hay FAQ de alta confianza, delegando a búsqueda en BD local');
  
  // Si tenemos un candidato de FAQ con confianza media/baja,
  // lo retornamos pero con source 'none' para que el chat API
  // pueda decidir si usarlo o buscar en BD
  if (candidateResult) {
    return {
      ...candidateResult,
      source: 'none', // Indica que no es definitivo
      confidence: 'low'
    };
  }
  
  return {
    reply: '',
    source: 'none',
    confidence: 'low'
  };
}

/**
 * Verifica si una consulta es sobre una ubicación específica
 */
export function isLocationQuery(query: string): boolean {
  const locationKeywords = [
    'donde estoy', 'dónde estoy', 'mi ubicacion', 'mi ubicación',
    'ubicacion actual', 'ubicación actual', 'estoy en',
    'donde me encuentro', 'dónde me encuentro',
    'where am i', 'my location', 'current location'
  ];
  
  const normalized = normalizeText(query);
  return locationKeywords.some(keyword => normalized.includes(normalizeText(keyword)));
}

/**
 * Verifica si una consulta es sobre rutas/direcciones
 */
export function isRouteQuery(query: string): boolean {
  const routeKeywords = [
    'como llego', 'cómo llego', 'como ir', 'cómo ir',
    'ruta', 'camino', 'direcciones', 'indicaciones',
    'how to get', 'directions', 'route', 'way to'
  ];
  
  const normalized = normalizeText(query);
  return routeKeywords.some(keyword => normalized.includes(normalizeText(keyword)));
}

/**
 * Obtiene estadísticas de uso de FAQs (útil para analytics)
 */
export function getFAQStats(locale: string = 'es'): {
  totalFAQs: number;
  categories: string[];
} {
  const localeFAQs = faqs[locale] || faqs['es'];
  return {
    totalFAQs: Object.keys(localeFAQs).length,
    categories: Object.keys(localeFAQs)
  };
}
