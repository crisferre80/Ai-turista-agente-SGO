/**
 * Extrae el mensaje de error de manera robusta
 * Maneja: Error objects, strings, objetos con message, etc.
 */
export function getErrorMessage(error: unknown): string {
  // Si es un string, retornar directamente
  if (typeof error === 'string') {
    return error;
  }

  // Si es un Error object
  if (error instanceof Error) {
    return error.message;
  }

  // Si es un objeto con mensaje
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }

  // Si es un objeto con error property (como Supabase)
  if (error && typeof error === 'object' && 'error' in error) {
    const errorProp = (error as { error: unknown }).error;
    if (typeof errorProp === 'string') return errorProp;
    if (errorProp && typeof errorProp === 'object' && 'message' in errorProp) {
      return String((errorProp as { message: unknown }).message);
    }
  }

  // Fallback
  return 'Error desconocido. Por favor intenta de nuevo.';
}

/**
 * Log de error con mensaje descriptivo
 */
export function logError(context: string, error: unknown): void {
  const message = getErrorMessage(error);
  console.error(`❌ ${context}:`, error);
  console.error(`📝 Mensaje:`, message);
}
