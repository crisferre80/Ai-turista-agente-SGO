/**
 * Sanitizar nombres de archivo para Supabase Storage
 * Remueve caracteres especiales, acentos, espacios y caracteres inválidos
 */
export function sanitizeFileName(fileName: string): string {
  // Remover extensión temporalmente
  const lastDotIndex = fileName.lastIndexOf('.');
  const name = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
  const ext = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '';

  // Normalizar acentos (ó -> o, é -> e, etc.)
  const normalized = name
    .normalize('NFD') // Descomponer caracteres acentuados
    .replace(/[\u0300-\u036f]/g, ''); // Remover diacríticos

  // Remover caracteres especiales, mantener solo alfanuméricos, guiones, guiones bajos
  const sanitized = normalized
    .replace(/[^\w\s-]/g, '') // Remover caracteres especiales
    .replace(/\s+/g, '-') // Reemplazar espacios con guiones
    .replace(/-+/g, '-') // Remover guiones múltiples
    .toLowerCase() // Convertir a minúsculas
    .slice(0, 100); // Limitar a 100 caracteres

  return sanitized + ext;
}

/**
 * Generar nombre único para archivo
 * Formato: timestamp-random-nombreSanitizado.ext
 */
export function generateUniqueFileName(originalFileName: string): string {
  const sanitized = sanitizeFileName(originalFileName);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  
  // Si el nombre sanitizado está vacío, usar solo timestamp y random
  if (!sanitized || sanitized === '') {
    return `${timestamp}-${random}`;
  }

  // Extraer extensión
  const ext = sanitized.includes('.') ? sanitized.substring(sanitized.lastIndexOf('.')) : '';
  const nameWithoutExt = ext ? sanitized.substring(0, sanitized.lastIndexOf('.')) : sanitized;

  return `${timestamp}-${random}-${nameWithoutExt}${ext}`;
}
