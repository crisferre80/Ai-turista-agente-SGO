'use client';

import { useEffect, useState, useCallback } from 'react';
import { detectWebXRSupport, getARDeviceInfo, createARSession } from '@/lib/webxr-config';

interface WebXRCapabilities {
  supportsAR: boolean;
  supportsVR: boolean;
  supportsHitTest: boolean;
  supportsLighting: boolean;
}

export function useWebXR() {
  const [xrSession, setXrSession] = useState<XRSession | null>(null);
  const [isXRSupported, setIsXRSupported] = useState(false);
  const [capabilities, setCapabilities] = useState<WebXRCapabilities>({
    supportsAR: false,
    supportsVR: false,
    supportsHitTest: false,
    supportsLighting: false,
  });
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verificar capacidades WebXR al montar
  useEffect(() => {
    const checkWebXRSupport = async () => {
      try {
        const detection = await detectWebXRSupport();
        const deviceInfo = getARDeviceInfo();

        setCapabilities({
          supportsAR: detection.supportsAR,
          supportsVR: detection.supportsVR,
          supportsHitTest: detection.supportsAR, // Hit test generalmente viene con AR
          supportsLighting: detection.supportsAR, // Light estimation también
        });

        setIsXRSupported(detection.supportsAR || detection.supportsVR);

        console.log('🔍 WebXR Capabilities:', {
          webXR: detection.hasWebXR,
          ar: detection.supportsAR,
          vr: detection.supportsVR,
          https: detection.isHTTPS,
          device: deviceInfo
        });

      } catch (error) {
        console.error('Error checking WebXR support:', error);
        setError('Error verificando soporte WebXR');
      }
    };

    checkWebXRSupport();
  }, []);

  // Iniciar sesión AR
  const startARSession = useCallback(async (): Promise<boolean> => {
    try {
      if (!capabilities.supportsAR) {
        setError('AR no es compatible con este dispositivo/navegador');
        return false;
      }

      console.log('🚀 Iniciando sesión WebXR AR real...');

      const session = await createARSession({
        optionalFeatures: ['camera-access', 'dom-overlay'],
      });

      if (!session) {
        setError('No se pudo crear la sesión AR');
        return false;
      }

      console.log('✅ Sesión AR real iniciada:', session);

      // Configurar eventos de la sesión
      session.addEventListener('end', () => {
        console.log('🛑 Sesión AR terminada');
        setXrSession(null);
        setIsSessionActive(false);
      });

      session.addEventListener('inputsourceschange', (event) => {
        console.log('🎮 Input sources changed:', event);
      });

      setXrSession(session);
      setIsSessionActive(true);
      setError(null);
      
      return true;

    } catch (error) {
      console.error('❌ Error iniciando sesión AR:', error);
      setError(`Error iniciando AR: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      return false;
    }
  }, [capabilities.supportsAR]);

  // Terminar sesión
  const endSession = useCallback(async () => {
    if (xrSession) {
      try {
        await xrSession.end();
      } catch (error) {
        console.error('Error terminando sesión:', error);
      }
    }
  }, [xrSession]);

  return {
    // Estado
    xrSession,
    isXRSupported,
    capabilities,
    isSessionActive,
    error,
    
    // Acciones
    startARSession,
    endSession,
  };
}

// Hook para obtener información de dispositivo
export function useXRDeviceInfo() {
  const [deviceInfo, setDeviceInfo] = useState<{
    isARCore: boolean;
    isARKit: boolean;
    userAgent: string;
    platform: string;
  }>({
    isARCore: false,
    isARKit: false,
    userAgent: '',
    platform: '',
  });

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    
    // Detectar ARCore (Android)
    const isAndroid = /Android/i.test(userAgent);
    const hasARCore = isAndroid && 'xr' in navigator;
    
    // Detectar ARKit (iOS)
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const hasARKit = isIOS && 'xr' in navigator;

    // Usar callback para evitar cascada de renders
    setTimeout(() => {
      setDeviceInfo({
        isARCore: hasARCore,
        isARKit: hasARKit,
        userAgent,
        platform,
      });
    }, 0);

    console.log('📱 Device Info:');
    console.log('ARCore (Android):', hasARCore);
    console.log('ARKit (iOS):', hasARKit);
    console.log('User Agent:', userAgent);

  }, []);

  return deviceInfo;
}