import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Valida que la API key de Gemini tenga el formato correcto
 * Las claves de Google AI suelen empezar con 'AIza' y tener ~39 caracteres
 */
function validateGeminiApiKey(key: string | undefined): boolean {
  if (!key) return false;
  // Validación básica: debe tener al menos 30 caracteres y empezar con caracteres alfanuméricos
  if (key.length < 30) return false;
  if (key === 'key_not_set' || key === 'tu-gemini-api-key') return false;
  return true;
}

/**
 * Sanitiza una API key para logs (muestra solo los primeros 8 caracteres)
 */
function sanitizeApiKey(key: string): string {
  return key.substring(0, 8) + '...' + key.substring(key.length - 4);
}

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error('[GEMINI] ⚠️  GEMINI_API_KEY no está configurada en las variables de entorno.');
    console.error('[GEMINI] Por favor, agrega GEMINI_API_KEY a tu archivo .env.local');
} else if (!validateGeminiApiKey(apiKey)) {
    console.error('[GEMINI] ⚠️  GEMINI_API_KEY tiene un formato inválido o es una clave de ejemplo.');
    console.error('[GEMINI] Verifica que hayas configurado una clave API válida de Google AI Studio.');
} else {
    console.log('[GEMINI] ✓ API key configurada:', sanitizeApiKey(apiKey));
}

// Inicializar con la clave (o un placeholder si no está disponible)
const genAI = new GoogleGenerativeAI(apiKey || "key_not_set");

export const getGeminiModel = (modelName: string = 'gemini-2.0-flash-exp') => {
    if (!validateGeminiApiKey(apiKey)) {
        throw new Error('GEMINI_API_KEY no está configurada o es inválida. Configura una clave válida en .env.local');
    }
    return genAI.getGenerativeModel({ model: modelName });
};

export const isGeminiConfigured = () => validateGeminiApiKey(apiKey);

export default genAI;
