'use client';

import { useEffect, useState } from 'react';
import { useXR } from '@react-three/xr';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * ARCameraAccess - Implementación de WebXR Camera Access
 * 
 * Especificación: https://immersive-web.github.io/computer-vision/
 * 
 * Permite acceso a las imágenes de la cámara del dispositivo
 * para funcionalidades de computer vision avanzadas:
 * 
 * - Mixed Reality: Mezclar video real con contenido 3D
 * - Computer Vision: Detección de objetos, reconocimiento, tracking
 * - Image Analysis: Procesamiento de frames para features avanzadas
 * - Background Replacement: Efectos de video en tiempo real
 * 
 * Nota: Requiere permisos explícitos del usuario y no todos
 * los dispositivos/navegadores lo soportan.
 */

export interface CameraFrameData {
  /** Texture con el frame de la cámara */
  texture: THREE.Texture | WebGLTexture;
  /** Width del frame */
  width: number;
  /** Height del frame */
  height: number;
  /** Timestamp del frame */
  timestamp: number;
  /** Transformación de la cámara */
  cameraTransform?: XRRigidTransform;
}

interface ARCameraAccessProps {
  /** Callback cuando se recibe un nuevo frame */
  onCameraFrame?: (frame: CameraFrameData) => void;
  /** Mostrar video de la cámara como background */
  showAsBackground?: boolean;
  /** Aplicar efectos al video */
  videoEffect?: 'none' | 'grayscale' | 'sepia' | 'edge-detect';
  /** Opacidad del video background (0-1) */
  backgroundOpacity?: number;
  /** Habilitar logging detallado */
  debug?: boolean;
}

export function ARCameraAccess({
  showAsBackground = false,
  videoEffect = 'none',
  backgroundOpacity = 1.0,
  debug = false
}: ARCameraAccessProps) {
  const { session } = useXR();
  const { scene } = useThree();
  
  const [isSupported, setIsSupported] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [cameraFrame] = useState<CameraFrameData | null>(null);

  // Verificar soporte de Camera Access
  useEffect(() => {
    if (!session) return;

    const checkSupport = async () => {
      // WebXR Camera Access: verificar soporte
      // Esta feature es experimental y requiere flag en muchos navegadores
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supported = typeof (session as any).requestCameraAccess !== 'undefined' ||
                       // eslint-disable-next-line @typescript-eslint/no-explicit-any
                       typeof (session as any).getCameraTexture !== 'undefined';
      
      setIsSupported(supported);
      
      if (debug) {
        console.log('📷 Camera Access soportado:', supported);
      }

      if (!supported && debug) {
        console.warn('⚠️ Camera Access no disponible');
        console.warn('   Para habilitar en Chrome/Edge: chrome://flags -> enable-webxr-camera-access');
        console.warn('   Requiere HTTPS y permisos de cámara');
      }
    };

    checkSupport();
  }, [session, debug]);

  // Solicitar acceso a la cámara
  useEffect(() => {
    if (!session || !isSupported || hasPermission) return;

    const requestCameraAccess = async () => {
      try {
        // WebXR Camera Access API: requestCameraAccess
        // Solicita permisos al usuario para acceder a frames de cámara
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const granted = await (session as any).requestCameraAccess?.();

        if (granted) {
          setHasPermission(true);
          
          if (debug) {
            console.log('✅ Acceso a cámara concedido');
          }
        } else {
          if (debug) {
            console.warn('⚠️ Acceso a cámara denegado por el usuario');
          }
        }
      } catch (error) {
        console.error('❌ Error solicitando acceso a cámara:', error);
      }
    };

    requestCameraAccess();
  }, [session, isSupported, hasPermission, debug]);

  // Crear background plane si showAsBackground está habilitado
  useEffect(() => {
    if (!showAsBackground || !hasPermission) return;

    // Crear shader material para el background con video de cámara
    const videoMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.999, 1.0); // Renderizar en el fondo
        }
      `,
      fragmentShader: `
        uniform sampler2D cameraTexture;
        uniform float opacity;
        uniform int effect;
        
        varying vec2 vUv;
        
        vec3 grayscale(vec3 color) {
          float gray = dot(color, vec3(0.299, 0.587, 0.114));
          return vec3(gray);
        }
        
        vec3 sepia(vec3 color) {
          return vec3(
            dot(color, vec3(0.393, 0.769, 0.189)),
            dot(color, vec3(0.349, 0.686, 0.168)),
            dot(color, vec3(0.272, 0.534, 0.131))
          );
        }
        
        vec3 edgeDetect(sampler2D tex, vec2 uv, vec2 resolution) {
          vec2 pixelSize = 1.0 / resolution;
          
          // Sobel operator
          float tl = texture2D(tex, uv + vec2(-pixelSize.x, pixelSize.y)).r;
          float t = texture2D(tex, uv + vec2(0.0, pixelSize.y)).r;
          float tr = texture2D(tex, uv + vec2(pixelSize.x, pixelSize.y)).r;
          float l = texture2D(tex, uv + vec2(-pixelSize.x, 0.0)).r;
          float r = texture2D(tex, uv + vec2(pixelSize.x, 0.0)).r;
          float bl = texture2D(tex, uv + vec2(-pixelSize.x, -pixelSize.y)).r;
          float b = texture2D(tex, uv + vec2(0.0, -pixelSize.y)).r;
          float br = texture2D(tex, uv + vec2(pixelSize.x, -pixelSize.y)).r;
          
          float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
          float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;
          
          float edge = length(vec2(gx, gy));
          return vec3(edge);
        }
        
        void main() {
          vec4 cameraColor = texture2D(cameraTexture, vUv);
          vec3 color = cameraColor.rgb;
          
          // Aplicar efectos
          if (effect == 1) { // grayscale
            color = grayscale(color);
          } else if (effect == 2) { // sepia
            color = sepia(color);
          } else if (effect == 3) { // edge-detect
            color = edgeDetect(cameraTexture, vUv, vec2(640.0, 480.0));
          }
          
          gl_FragColor = vec4(color, opacity);
        }
      `,
      uniforms: {
        cameraTexture: { value: null },
        opacity: { value: backgroundOpacity },
        effect: { 
          value: videoEffect === 'grayscale' ? 1 : 
                 videoEffect === 'sepia' ? 2 :
                 videoEffect === 'edge-detect' ? 3 : 0
        }
      },
      transparent: true,
      depthTest: false,
      depthWrite: false
    });

    // Crear fullscreen quad para el background
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, videoMaterial);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1000; // Renderizar primero (background)
    
    scene.add(mesh);

    if (debug) {
      console.log('📺 Video background creado');
    }

    return () => {
      scene.remove(mesh);
      geometry.dispose();
      videoMaterial.dispose();
    };
  }, [showAsBackground, hasPermission, scene, videoEffect, backgroundOpacity, debug]);

  // NO hay useFrame aquí porque Camera Access no está implementado en @react-three/xr
  // Este es un componente placeholder que documenta la API para futuras implementaciones
  
  // En una implementación real, se obtendría el frame de la cámara así:
  // useFrame((state) => {
  //   if (!session || !hasPermission) return;
  //   
  //   const frame = state.gl.xr.getFrame();
  //   if (!frame) return;
  //   
  //   try {
  //     // WebXR Camera Access: getCameraTexture() o getImageBitmap()
  //     const cameraTexture = frame.getCameraTexture?.(view);
  //     
  //     if (cameraTexture) {
  //       const frameData: CameraFrameData = {
  //         texture: cameraTexture,
  //         width: cameraTexture.image?.width || 0,
  //         height: cameraTexture.image?.height || 0,
  //         timestamp: frame.predictedDisplayTime
  //       };
  //       
  //       setCameraFrame(frameData);
  //       onCameraFrame?.(frameData);
  //     }
  //   } catch (error) {
  //     console.warn('Error obteniendo camera frame:', error);
  //   }
  // });

  // Exponer API a través de window
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__arCameraAccess = {
      isSupported,
      hasPermission,
      cameraFrame,
      getCameraFrame: () => cameraFrame
    };

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__arCameraAccess;
    };
  }, [isSupported, hasPermission, cameraFrame]);

  // Log de advertencia sobre implementación incompleta
  useEffect(() => {
    if (debug && isSupported && hasPermission) {
      console.warn('⚠️ Camera Access API está en desarrollo');
      console.warn('   Este componente está preparado pero la feature aún no está');
      console.warn('   implementada completamente en @react-three/xr');
      console.warn('   Consulta: https://github.com/pmndrs/xr/issues');
    }
  }, [debug, isSupported, hasPermission]);

  return null;
}

// Hook para acceder a camera access
export function useARCameraAccess() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).__arCameraAccess as {
    isSupported: boolean;
    hasPermission: boolean;
    cameraFrame: CameraFrameData | null;
    getCameraFrame: () => CameraFrameData | null;
  } | undefined;
}
