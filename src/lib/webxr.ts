/**
 * Servicio para detectar capacidades WebXR y AR del dispositivo
 */

import type { WebXRCapabilities } from '@/types/ar';

// Polyfill para WebXR si no está disponible
if (typeof window !== 'undefined') {
  import('webxr-polyfill').then((WebXRPolyfill) => {
    if (!navigator.xr) {
      new WebXRPolyfill.default();
    }
  }).catch(() => {
    console.warn('No se pudo cargar WebXR polyfill');
  });
}

/**
 * Detecta si el navegador soporta WebXR y realidad aumentada
 */
export async function detectWebXRCapabilities(): Promise<WebXRCapabilities> {
  const capabilities: WebXRCapabilities = {
    isSupported: false,
    isSecureContext: false,
    hasCamera: false,
  };

  // Verificar si estamos en un contexto del navegador
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return capabilities;
  }

  // Verificar contexto seguro (HTTPS)
  capabilities.isSecureContext = window.isSecureContext;

  // Verificar acceso a la cámara
  try {
    if (navigator.mediaDevices) {
      capabilities.hasCamera = true;
    }
  } catch (error) {
    console.warn('No se pudo detectar la cámara:', error);
  }

  // Verificar soporte de WebXR
  if ('xr' in navigator && navigator.xr) {
    try {
      // Intentar verificar soporte de AR inmersivo
      const isARSupported = await navigator.xr.isSessionSupported('immersive-ar');
      
      if (isARSupported) {
        capabilities.isSupported = true;
        capabilities.arMode = 'immersive-ar';
      } else {
        // Fallback a modo inline si immersive-ar no está disponible
        const isInlineSupported = await navigator.xr.isSessionSupported('inline');
        if (isInlineSupported) {
          capabilities.isSupported = true;
          capabilities.arMode = 'inline';
        }
      }
    } catch (error) {
      console.warn('Error al verificar soporte WebXR:', error);
      
      // Fallback: asumir soporte inline en dispositivos móviles modernos
      if (isMobileDevice() && capabilities.isSecureContext && capabilities.hasCamera) {
        capabilities.isSupported = true;
        capabilities.arMode = 'inline';
      }
    }
  }

  return capabilities;
}

/**
 * Verifica si estamos en un dispositivo móvil
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent || navigator.vendor || (window as Window & { opera?: string }).opera || '';
  
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
    userAgent.toLowerCase()
  );
}

/**
 * Solicita permisos de cámara para AR
 */
export async function requestCameraPermission(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
    return false;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }, // Cámara trasera
      audio: false,
    });

    // Detener el stream inmediatamente, solo necesitamos verificar permisos
    stream.getTracks().forEach(track => track.stop());
    
    return true;
  } catch (error) {
    console.error('Error al solicitar permisos de cámara:', error);
    return false;
  }
}

/**
 * Obtiene información detallada sobre las capacidades del dispositivo
 */
export async function getDeviceInfo(): Promise<{
  isMobile: boolean;
  isSecure: boolean;
  hasCamera: boolean;
  hasGyroscope: boolean;
  hasAccelerometer: boolean;
  userAgent: string;
}> {
  const info = {
    isMobile: isMobileDevice(),
    isSecure: typeof window !== 'undefined' ? window.isSecureContext : false,
    hasCamera: false,
    hasGyroscope: false,
    hasAccelerometer: false,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
  };

  // Verificar cámara
  if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      info.hasCamera = devices.some(device => device.kind === 'videoinput');
    } catch (error) {
      console.warn('No se pudo enumerar dispositivos:', error);
    }
  }

  // Verificar sensores de movimiento
  if (typeof window !== 'undefined') {
    info.hasGyroscope = 'DeviceOrientationEvent' in window;
    info.hasAccelerometer = 'DeviceMotionEvent' in window;
  }

  return info;
}

/**
 * Verifica si el dispositivo cumple con los requisitos mínimos para AR
 */
export async function meetsARRequirements(): Promise<{
  meets: boolean;
  missing: string[];
}> {
  const missing: string[] = [];
  const capabilities = await detectWebXRCapabilities();
  const deviceInfo = await getDeviceInfo();

  if (!capabilities.isSecureContext) {
    missing.push('Contexto seguro (HTTPS)');
  }

  if (!capabilities.hasCamera) {
    missing.push('Acceso a la cámara');
  }

  if (!capabilities.isSupported) {
    missing.push('Soporte WebXR');
  }

  if (!deviceInfo.hasGyroscope && !deviceInfo.hasAccelerometer) {
    missing.push('Sensores de movimiento (giroscopio/acelerómetro)');
  }

  return {
    meets: missing.length === 0,
    missing,
  };
}
