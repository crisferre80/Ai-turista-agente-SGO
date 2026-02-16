'use client';

import { useEffect, useRef, useState } from 'react';
import { useXR } from '@react-three/xr';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * ARLightEstimation - Implementación de WebXR Light Estimation
 * 
 * Especificación: https://immersive-web.github.io/lighting-estimation/
 * 
 * Permite obtener información de iluminación del entorno real
 * para aplicarla a objetos virtuales, logrando realismo.
 * 
 * Features disponibles:
 * - Light Probe: Mapa de iluminación ambiental (HDR cube map)
 * - Primary Light: Dirección e intensidad de la luz principal
 * - Reflection Probe: Para reflejos realistas en materiales
 */

export interface LightEstimationData {
  /** Intensidad de luz ambiental (0-1) */
  ambientIntensity?: number;
  /** Color de luz ambiental (RGB) */
  ambientColor?: THREE.Color;
  /** Dirección de la luz principal (Vector3 normalizado) */
  primaryLightDirection?: THREE.Vector3;
  /** Intensidad de la luz principal */
  primaryLightIntensity?: number;
  /** Color de la luz principal */
  primaryLightColor?: THREE.Color;
  /** Environment map para reflejos */
  environmentMap?: THREE.CubeTexture;
  /** Coeficientes de esféricos harmónicos para iluminación */
  sphericalHarmonicsCoefficients?: Float32Array;
}

interface ARLightEstimationProps {
  /** Callback cuando se actualiza la iluminación */
  onLightUpdate?: (data: LightEstimationData) => void;
  /** Aplicar automáticamente a la escena */
  autoApply?: boolean;
  /** Intensidad multiplicadora (para ajustar) */
  intensityScale?: number;
  /** Habilitar logging detallado */
  debug?: boolean;
}

export function ARLightEstimation({
  onLightUpdate,
  autoApply = true,
  intensityScale = 1.0,
  debug = false
}: ARLightEstimationProps) {
  const { session } = useXR();
  const { scene } = useThree();
  
  const [isSupported, setIsSupported] = useState(false);
  const [lightData, setLightData] = useState<LightEstimationData>({});
  
  // WebXR Light Estimation types no están en TypeScript estándar aún
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lightProbeRef = useRef<any>(null);
  const directionalLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);

  // Verificar soporte de Light Estimation
  useEffect(() => {
    if (!session) return;

    const checkSupport = async () => {
      // WebXR Light Estimation: verificar soporte
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supported = typeof (session as any).requestLightProbe !== 'undefined';
      
      setIsSupported(supported);
      
      if (debug) {
        console.log('💡 Light Estimation soportada:', supported);
      }

      if (!supported && debug) {
        console.warn('⚠️ Light Estimation no disponible en este dispositivo');
      }
    };

    checkSupport();
  }, [session, debug]);

  // Solicitar Light Probe
  useEffect(() => {
    if (!session || !isSupported) return;

    const requestLightProbe = async () => {
      try {
        // WebXR Light Estimation API: requestLightProbe
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lightProbe = await (session as any).requestLightProbe?.({
          // Opciones del light probe
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          reflectionFormat: (session as any).preferredReflectionFormat || 'srgba8'
        });

        if (lightProbe) {
          lightProbeRef.current = lightProbe;
          
          if (debug) {
            console.log('✅ Light Probe configurado');
          }
        }
      } catch (error) {
        console.error('❌ Error solicitando light probe:', error);
      }
    };

    requestLightProbe();

    return () => {
      lightProbeRef.current = null;
    };
  }, [session, isSupported, debug]);

  // Crear luces en la escena si autoApply está habilitado
  useEffect(() => {
    if (!autoApply) return;

    // Crear luz direccional para simular sol/luz principal
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(0, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scene.add(directionalLight as any);
    directionalLightRef.current = directionalLight;

    // Crear luz ambiental
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scene.add(ambientLight as any);
    ambientLightRef.current = ambientLight;

    if (debug) {
      console.log('💡 Luces AR creadas en la escena');
    }

    return () => {
      if (directionalLightRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        scene.remove(directionalLightRef.current as any);
        directionalLightRef.current.dispose();
      }
      if (ambientLightRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        scene.remove(ambientLightRef.current as any);
      }
    };
  }, [autoApply, scene, debug]);

  // Actualizar iluminación cada frame
  useFrame((state) => {
    if (!session || !isSupported || !lightProbeRef.current) return;

    const frame = state.gl.xr.getFrame();
    if (!frame) return;

    try {
      // WebXR Light Estimation: getLightEstimate del frame
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lightEstimate = (frame as any).getLightEstimate?.(lightProbeRef.current);

      if (!lightEstimate) return;

      const updatedData: LightEstimationData = {};

      // Obtener dirección de luz principal (Primary Light Direction)
      const primaryLightDirection = lightEstimate.primaryLightDirection;
      if (primaryLightDirection) {
        updatedData.primaryLightDirection = new THREE.Vector3(
          primaryLightDirection.x,
          primaryLightDirection.y,
          primaryLightDirection.z
        );
      }

      // Obtener intensidad de luz principal (Primary Light Intensity)
      const primaryLightIntensity = lightEstimate.primaryLightIntensity;
      if (primaryLightIntensity !== undefined) {
        updatedData.primaryLightIntensity = primaryLightIntensity * intensityScale;
      }

      // Obtener coeficientes de spherical harmonics para luz ambiental
      const shCoefficients = lightEstimate.sphericalHarmonicsCoefficients;
      if (shCoefficients) {
        updatedData.sphericalHarmonicsCoefficients = shCoefficients;
        
        // Calcular intensidad ambiental aproximada de SH coefficients
        // El coeficiente [0] representa la iluminación constante (DC term)
        const ambientIntensity = Math.sqrt(
          shCoefficients[0] * shCoefficients[0] +
          shCoefficients[1] * shCoefficients[1] +
          shCoefficients[2] * shCoefficients[2]
        ) / Math.PI;
        
        updatedData.ambientIntensity = ambientIntensity * intensityScale;
      }

      // Aplicar a luces si autoApply está habilitado
      if (autoApply) {
        // Actualizar luz direccional
        if (directionalLightRef.current && updatedData.primaryLightDirection) {
          directionalLightRef.current.position.copy(updatedData.primaryLightDirection);
          directionalLightRef.current.position.multiplyScalar(5);
          
          if (updatedData.primaryLightIntensity !== undefined) {
            directionalLightRef.current.intensity = updatedData.primaryLightIntensity;
          }
        }

        // Actualizar luz ambiental
        if (ambientLightRef.current && updatedData.ambientIntensity !== undefined) {
          ambientLightRef.current.intensity = updatedData.ambientIntensity;
        }
      }

      setLightData(updatedData);
      onLightUpdate?.(updatedData);

    } catch (error) {
      if (debug) {
        console.warn('⚠️ Error obteniendo light estimate:', error);
      }
    }
  });

  // Aplicar environment map si está disponible
  useEffect(() => {
    if (!autoApply || !lightData.environmentMap) return;

    // Aplicar environment map a todos los materiales de la escena
    scene.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) {
        const mesh = object as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          mesh.material.forEach((mat: any) => {
            if (mat.envMap !== lightData.environmentMap) {
              mat.envMap = lightData.environmentMap || null;
              mat.needsUpdate = true;
            }
          });
        } else if (mesh.material) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mat = mesh.material as any;
          if (mat.envMap !== lightData.environmentMap) {
            mat.envMap = lightData.environmentMap || null;
            mat.needsUpdate = true;
          }
        }
      }
    });

    if (debug) {
      console.log('🌍 Environment map aplicado a la escena');
    }
  }, [autoApply, lightData.environmentMap, scene, debug]);

  // Exponer datos de iluminación a través de window
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__arLightEstimation = {
      isSupported,
      lightData,
      getLightData: () => lightData
    };

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__arLightEstimation;
    };
  }, [isSupported, lightData]);

  // Este componente no renderiza nada visible
  return null;
}

// Hook para acceder a datos de iluminación
export function useARLightEstimation() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).__arLightEstimation as {
    isSupported: boolean;
    lightData: LightEstimationData;
    getLightData: () => LightEstimationData;
  } | undefined;
}
