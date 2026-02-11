/**
 * Configuración global de WebXR y funciones de utilidad
 */
'use client';

// Importar polyfill de WebXR para mayor compatibilidad
import 'webxr-polyfill';

// Tipos extendidos para WebXR
declare global {
  interface Navigator {
    xr?: XRSystem;
  }
  
  interface XRSystem {
    isSessionSupported(sessionMode: XRSessionMode): Promise<boolean>;
    requestSession(sessionMode: XRSessionMode, options?: XRSessionInit): Promise<XRSession>;
  }
}

export const WEBXR_CONFIG = {
  // Modos de sesión soportados
  SESSION_MODES: {
    AR: 'immersive-ar' as XRSessionMode,
    VR: 'immersive-vr' as XRSessionMode,
    INLINE: 'inline' as XRSessionMode,
  },
  
  // Features requeridas para AR
  AR_FEATURES: {
    REQUIRED: ['local-floor'] as XRReferenceSpaceType[],
    OPTIONAL: ['hit-test', 'light-estimation', 'anchors', 'camera-access'] as string[],
  },
  
  // Configuración de hit testing
  HIT_TEST: {
    ENTITY_TYPES: ['plane', 'point', 'mesh'] as XRHitTestTrackableType[],
    SPACE: 'viewer' as XRReferenceSpaceType,
  },
} as const;

/**
 * Detecta si el dispositivo soporta WebXR
 */
export async function detectWebXRSupport(): Promise<{
  hasWebXR: boolean;
  supportsAR: boolean;
  supportsVR: boolean;
  userAgent: string;
  isHTTPS: boolean;
}> {
  const userAgent = navigator.userAgent;
  const isHTTPS = location.protocol === 'https:';
  
  let hasWebXR = false;
  let supportsAR = false;
  let supportsVR = false;

  try {
    if ('xr' in navigator && navigator.xr) {
      hasWebXR = true;
      
      // Test AR support
      supportsAR = await navigator.xr.isSessionSupported(WEBXR_CONFIG.SESSION_MODES.AR);
      
      // Test VR support  
      supportsVR = await navigator.xr.isSessionSupported(WEBXR_CONFIG.SESSION_MODES.VR);
    }
  } catch (error) {
    console.warn('Error detecting WebXR support:', error);
  }

  console.log('🔍 WebXR Detection Results:');
  console.log('HTTPS:', isHTTPS);
  console.log('WebXR Available:', hasWebXR);
  console.log('AR Supported:', supportsAR);
  console.log('VR Supported:', supportsVR);
  console.log('User Agent:', userAgent);

  return {
    hasWebXR,
    supportsAR,
    supportsVR,
    userAgent,
    isHTTPS,
  };
}

/**
 * Obtiene información del dispositivo AR
 */
export function getARDeviceInfo() {
  const userAgent = navigator.userAgent.toLowerCase();
  
  const deviceInfo = {
    isMobile: /mobile|android|iphone|ipad/.test(userAgent),
    isAndroid: /android/.test(userAgent),
    isIOS: /iphone|ipad/.test(userAgent),
    isChrome: /chrome/.test(userAgent),
    isEdge: /edge/.test(userAgent),
    isSamsung: /samsung/.test(userAgent),
    
    // Detectar ARCore (Android)
    hasARCore: /android/.test(userAgent) && 'xr' in navigator,
    
    // Detectar ARKit (iOS)  
    hasARKit: /iphone|ipad/.test(userAgent) && 'xr' in navigator,
    
    // Detectar características específicas
    hasWebGL: (() => {
      try {
        const canvas = document.createElement('canvas');
        return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
      } catch {
        return false;
      }
    })(),
    
    hasDeviceMotion: 'DeviceMotionEvent' in window,
    hasDeviceOrientation: 'DeviceOrientationEvent' in window,
  };

  console.log('📱 Device AR Info:', deviceInfo);
  return deviceInfo;
}

/**
 * Configurar session de WebXR con configuración óptima
 */
export async function createARSession(options: {
  requiredFeatures?: string[];
  optionalFeatures?: string[];
}): Promise<XRSession | null> {
  
  if (!navigator.xr) {
    throw new Error('WebXR no está disponible');
  }

  const sessionInit: XRSessionInit = {
    requiredFeatures: [
      ...WEBXR_CONFIG.AR_FEATURES.REQUIRED,
      ...(options.requiredFeatures || [])
    ],
    optionalFeatures: [
      ...WEBXR_CONFIG.AR_FEATURES.OPTIONAL,
      ...(options.optionalFeatures || [])
    ],
  };

  try {
    console.log('🚀 Creating AR session with config:', sessionInit);
    const session = await navigator.xr.requestSession(
      WEBXR_CONFIG.SESSION_MODES.AR, 
      sessionInit
    );
    
    console.log('✅ AR session created successfully');
    return session;
    
  } catch (error) {
    console.error('❌ Failed to create AR session:', error);
    throw error;
  }
}