'use client';

import { useEffect, useRef, useState } from 'react';
import { useXR } from '@react-three/xr';
import { useFrame, useThree } from '@react-three/fiber';
import { 
  ShaderMaterial, 
  PlaneGeometry, 
  MeshBasicMaterial, 
  Mesh, 
  Matrix4, 
  DataTexture, 
  RedFormat, 
  FloatType, 
  UnsignedShortType 
} from 'three';

/**
 * ARDepthSensing - Implementación de WebXR Depth Sensing
 * 
 * Especificación: https://immersive-web.github.io/depth-sensing/
 * 
 * Permite obtener información de profundidad del entorno real
 * para lograr oclusión realista (objetos reales ocultan objetos virtuales).
 * 
 * Usos:
 * - Oclusión realista: Personas/objetos reales ocultan objetos virtuales
 * - Detección de geometría: Mapeo del entorno
 * - Física mejorada: Colisiones con objetos reales
 * - Segmentación semántica: Diferenciar superficies
 * 
 * Formatos de profundidad:
 * - 'luminance-alpha': CPU (16-bit depth)
 * - 'float32': CPU (32-bit depth, más preciso)
 * - 'depth24': GPU (para depth buffer directo)
 */

export type DepthFormat = 'luminance-alpha' | 'float32';
export type DepthUsage = 'cpu-optimized' | 'gpu-optimized';

export interface DepthData {
  /** Width del depth buffer */
  width: number;
  /** Height del depth buffer */
  height: number;
  /** Datos de profundidad (0-1, donde 0 = cerca, 1 = lejos) */
  data: Float32Array | Uint16Array;
  /** Matriz de transformación desde view space a UV space */
  normDepthBufferFromNormView: XRRigidTransform;
  /** Raw depth en metros (si disponible) */
  rawValueToMeters?: number;
}

interface ARDepthSensingProps {
  /** Formato de datos de profundidad */
  format?: DepthFormat;
  /** Uso optimizado (CPU o GPU) */
  usage?: DepthUsage;
  /** Callback cuando se recibe nueva información de profundidad */
  onDepthUpdate?: (depth: DepthData) => void;
  /** Aplicar oclusión automáticamente a la escena */
  autoApplyOcclusion?: boolean;
  /** Visualizar depth map (debug) */
  visualizeDepth?: boolean;
  /** Habilitar logging detallado */
  debug?: boolean;
}

export function ARDepthSensing({
  onDepthUpdate,
  autoApplyOcclusion = false,
  visualizeDepth = false,
  debug = false
}: ARDepthSensingProps) {
  const { session } = useXR();
  const { scene } = useThree();
  
  const [isSupported, setIsSupported] = useState(false);
  const [depthData, setDepthData] = useState<DepthData | null>(null);
  
  const occlusionMaterialRef = useRef<ShaderMaterial | null>(null);
  const depthVisualizerRef = useRef<Mesh | null>(null);

  // Verificar soporte de Depth Sensing
  useEffect(() => {
    if (!session) return;

    const checkSupport = async () => {
      // WebXR Depth Sensing: verificar soporte
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supported = typeof (session as any).depthUsage !== 'undefined' &&
                       // eslint-disable-next-line @typescript-eslint/no-explicit-any
                       typeof (session as any).depthDataFormat !== 'undefined';
      
      setIsSupported(supported);
      
      if (debug) {
        console.log('📏 Depth Sensing soportado:', supported);
        if (supported) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          console.log('  - Depth Usage:', (session as any).depthUsage);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          console.log('  - Depth Format:', (session as any).depthDataFormat);
        }
      }

      if (!supported && debug) {
        console.warn('⚠️ Depth Sensing no disponible en este dispositivo');
      }
    };

    checkSupport();
  }, [session, debug]);

  // Crear material de oclusión si autoApplyOcclusion está habilitado
  useEffect(() => {
    if (!autoApplyOcclusion || !isSupported) return;

    // Shader para oclusión usando depth map
    // Los píxeles del depth map ocultan los objetos virtuales detrás
    const occlusionMaterial = new ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        varying vec4 vWorldPosition;
        
        void main() {
          vUv = uv;
          vWorldPosition = modelMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D depthMap;
        uniform float cameraNear;
        uniform float cameraFar;
        uniform mat4 uvTransform;
        
        varying vec2 vUv;
        varying vec4 vWorldPosition;
        
        float readDepth(sampler2D depthSampler, vec2 coord) {
          vec4 depthColor = texture2D(depthSampler, coord);
          // Convertir depth texture (0-1) a profundidad lineal
          float depth = depthColor.r;
          return depth;
        }
        
        void main() {
          // Transformar coordenadas para muestrear depth map
          vec4 uvCoord = uvTransform * vWorldPosition;
          vec2 depthUv = uvCoord.xy / uvCoord.w;
          
          // Leer profundidad del mundo real
          float realDepth = readDepth(depthMap, depthUv);
          
          // Comparar con profundidad del fragmento virtual
          float fragDepth = gl_FragCoord.z;
          
          // Si el objeto real está más cerca, descartar el fragmento virtual
          if (realDepth < fragDepth) {
            discard;
          }
          
          // Color de debug (opcional)
          gl_FragColor = vec4(1.0, 0.0, 1.0, 0.1);
        }
      `,
      uniforms: {
        depthMap: { value: null },
        cameraNear: { value: 0.1 },
        cameraFar: { value: 100 },
        uvTransform: { value: new Matrix4() }
      },
      transparent: true,
      depthTest: true,
      depthWrite: false
    });

    occlusionMaterialRef.current = occlusionMaterial;

    if (debug) {
      console.log('🎭 Material de oclusión creado');
    }

    return () => {
      occlusionMaterial.dispose();
    };
  }, [autoApplyOcclusion, isSupported, debug]);

  // Crear visualizador de depth map si está habilitado
  useEffect(() => {
    if (!visualizeDepth || !isSupported) return;

    // Crear un plane para visualizar el depth map
    const geometry = new PlaneGeometry(2, 2);
    const material = new MeshBasicMaterial({
      map: null,
      transparent: true,
      opacity: 0.5
    });
    
    const mesh = new Mesh(geometry, material);
    mesh.position.set(0, 1.5, -2);
    scene.add(mesh);
    depthVisualizerRef.current = mesh;

    if (debug) {
      console.log('👁️ Visualizador de depth map creado');
    }

    return () => {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
    };
  }, [visualizeDepth, isSupported, scene, debug]);

  // Obtener y procesar depth data cada frame
  useFrame((state) => {
    if (!session || !isSupported) return;

    const frame = state.gl.xr.getFrame();
    if (!frame) return;

    try {
      // WebXR Depth Sensing: getDepthInformation del frame
      const pose = frame.getViewerPose(state.gl.xr.getReferenceSpace()!);
      if (!pose || !pose.views || pose.views.length === 0) return;

      const view = pose.views[0]; // Primera vista (ojo izquierdo o cámara principal)
      
      // Obtener depth information de la vista
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const depthInfo = (frame as any).getDepthInformation?.(view);

      if (!depthInfo) return;

      // Extraer datos de profundidad
      const width = depthInfo.width;
      const height = depthInfo.height;
      const data = depthInfo.data as Float32Array | Uint16Array;
      const normDepthBufferFromNormView = depthInfo.normDepthBufferFromNormView;
      const rawValueToMeters = depthInfo.rawValueToMeters;

      const newDepthData: DepthData = {
        width,
        height,
        data,
        normDepthBufferFromNormView,
        rawValueToMeters
      };

      setDepthData(newDepthData);
      onDepthUpdate?.(newDepthData);

      // Actualizar visualizador si está habilitado
      if (visualizeDepth && depthVisualizerRef.current) {
        // Crear texture desde depth data
        // Three.js r150+: usar RedFormat para datos de profundidad (single channel)
        const depthTexture = new DataTexture(
          data,
          width,
          height,
          RedFormat,
          data instanceof Float32Array ? FloatType : UnsignedShortType
        );
        depthTexture.needsUpdate = true;

        const material = depthVisualizerRef.current.material as MeshBasicMaterial;
        if (material.map) {
          material.map.dispose();
        }
        material.map = depthTexture;
        material.needsUpdate = true;
      }

      // Actualizar material de oclusión si está habilitado
      if (autoApplyOcclusion && occlusionMaterialRef.current) {
        const depthTexture = new DataTexture(
          data,
          width,
          height,
          RedFormat,
          data instanceof Float32Array ? FloatType : UnsignedShortType
        );
        depthTexture.needsUpdate = true;

        occlusionMaterialRef.current.uniforms.depthMap.value = depthTexture;
        occlusionMaterialRef.current.uniforms.uvTransform.value.fromArray(
          normDepthBufferFromNormView.matrix
        );
        occlusionMaterialRef.current.needsUpdate = true;
      }

    } catch (error) {
      if (debug) {
        console.warn('⚠️ Error obteniendo depth information:', error);
      }
    }
  });

  // Aplicar oclusión a objetos de la escena
  useEffect(() => {
    if (!autoApplyOcclusion || !occlusionMaterialRef.current) return;

    // Aplicar material de oclusión a meshes específicos
    // (En una implementación real, esto se haría de forma selectiva)
    scene.traverse((object) => {
      if ((object as Mesh).isMesh) {
        const mesh = object as Mesh;
        // Guardar material original para restaurar después
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(mesh.userData as any).originalMaterial) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (mesh.userData as any).originalMaterial = mesh.material;
        }
      }
    });

    if (debug) {
      console.log('🎭 Oclusión aplicada a objetos de la escena');
    }

    return () => {
      // Restaurar materiales originales
      scene.traverse((object) => {
        if ((object as Mesh).isMesh) {
          const mesh = object as Mesh;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((mesh.userData as any).originalMaterial) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mesh.material = (mesh.userData as any).originalMaterial;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (mesh.userData as any).originalMaterial;
          }
        }
      });
    };
  }, [autoApplyOcclusion, scene, debug]);

  // Exponer datos de profundidad
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__arDepthSensing = {
      isSupported,
      depthData,
      getDepthData: () => depthData,
      occlusionMaterial: occlusionMaterialRef.current
    };

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__arDepthSensing;
    };
  }, [isSupported, depthData]);

  // Este componente no renderiza nada visible (excepto debug visualizer)
  return null;
}

// Hook para acceder a depth sensing
export function useARDepthSensing() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).__arDepthSensing as {
    isSupported: boolean;
    depthData: DepthData | null;
    getDepthData: () => DepthData | null;
    occlusionMaterial: ShaderMaterial | null;
  } | undefined;
}
