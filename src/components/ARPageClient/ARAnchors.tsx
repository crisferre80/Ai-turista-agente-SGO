'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useXR } from '@react-three/xr';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * ARAnchors - Implementación de WebXR Anchors API
 * 
 * Especificación: https://immersive-web.github.io/anchors/
 * 
 * Los anchors permiten persistir objetos en posiciones del mundo real
 * que el sistema puede ajustar dinámicamente según mejora el tracking.
 * 
 * Tipos de anchors:
 * - Persistent Anchors: Se guardan entre sesiones
 * - Free-floating Anchors: Solo duran la sesión actual
 * - Plane Anchors: Anclados a superficies detectadas
 * - Hit Test Anchors: Creados desde resultados de hit testing
 */

export interface ARAnchorData {
  id: string;
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  anchorSpace?: XRAnchor;
  lastUpdated: number;
}

interface ARAnchorsProps {
  /** Callback cuando se crea un nuevo anchor */
  onAnchorCreated?: (anchor: ARAnchorData) => void;
  /** Callback cuando un anchor se actualiza */
  onAnchorUpdated?: (anchor: ARAnchorData) => void;
  /** Callback cuando un anchor se elimina */
  onAnchorDeleted?: (anchorId: string) => void;
  /** Habilitar logging detallado */
  debug?: boolean;
}

export function ARAnchors({
  onAnchorCreated,
  onAnchorUpdated,
  onAnchorDeleted,
  debug = false
}: ARAnchorsProps) {
  const { session } = useXR();
  const anchorsRef = useRef<Map<XRAnchor, ARAnchorData>>(new Map());
  const [isSupported, setIsSupported] = useState(false);
  const localRefSpaceRef = useRef<XRReferenceSpace | null>(null);

  // Verificar soporte de Anchors API
  useEffect(() => {
    if (!session) return;

    const checkSupport = async () => {
      // WebXR Anchors API: verificar si el dispositivo soporta anchors
       
      const supported = !!session.requestHitTestSource && 
                       // eslint-disable-next-line @typescript-eslint/no-explicit-any
                       typeof (session as any).requestHitTestSourceForTransientInput !== 'undefined';
      
      setIsSupported(supported);
      
      if (debug) {
        console.log('🔗 Anchors API soportada:', supported);
      }
    };

    checkSupport();
  }, [session, debug]);

  // Configurar reference space
  useEffect(() => {
    if (!session || !isSupported) return;

    const setupReferenceSpace = async () => {
      try {
        // Usar local-floor para AR (origen en el suelo)
        localRefSpaceRef.current = await session.requestReferenceSpace('local-floor');
        
        if (debug) {
          console.log('✅ Reference space configurado para Anchors: local-floor');
        }
      } catch (error) {
        console.warn('⚠️ Error configurando reference space para anchors:', error);
      }
    };

    setupReferenceSpace();

    return () => {
      localRefSpaceRef.current = null;
    };
  }, [session, isSupported, debug]);

  // Crear anchor desde un XRHitTestResult
  const createAnchorFromHitTest = useCallback(async (hitTestResult: XRHitTestResult): Promise<ARAnchorData | null> => {
    if (!session || !isSupported || !localRefSpaceRef.current) {
      console.warn('⚠️ No se puede crear anchor: sesión no disponible o no soportada');
      return null;
    }

    try {
      // WebXR Anchors API: createAnchor desde XRHitTestResult
      // Esto permite anclar objetos en superficies detectadas
      
      // Verificar que createAnchor está disponible
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof (hitTestResult as any).createAnchor !== 'function') {
        console.warn('⚠️ createAnchor no está disponible en este dispositivo');
        return null;
      }
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anchor = await (hitTestResult as any).createAnchor();
      
      if (!anchor) {
        console.warn('⚠️ No se pudo crear anchor desde hit test result');
        return null;
      }

      // Crear datos del anchor
      const anchorData: ARAnchorData = {
        id: crypto.randomUUID(),
        position: new THREE.Vector3(),
        rotation: new THREE.Quaternion(),
        anchorSpace: anchor,
        lastUpdated: Date.now()
      };

      // Guardar anchor
      anchorsRef.current.set(anchor, anchorData);

      if (debug) {
        console.log('🔗 Anchor creado desde hit test:', anchorData.id);
      }

      onAnchorCreated?.(anchorData);

      return anchorData;
    } catch (error) {
      console.error('❌ Error creando anchor:', error);
      return null;
    }
  }, [session, isSupported, debug, onAnchorCreated]);

  // Crear anchor desde pose manualmente
  const createAnchorFromPose = useCallback(async (
    position: THREE.Vector3,
    rotation: THREE.Quaternion
  ): Promise<ARAnchorData | null> => {
    if (!session || !isSupported || !localRefSpaceRef.current) {
      console.warn('⚠️ No se puede crear anchor: sesión no disponible');
      return null;
    }

    try {
      // Crear XRRigidTransform desde position y rotation
      const transform = new XRRigidTransform(
        { x: position.x, y: position.y, z: position.z, w: 1 },
        { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w }
      );

      // WebXR Anchors API: createAnchor con pose específica
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anchor = await (session as any).createAnchor?.(transform, localRefSpaceRef.current);

      if (!anchor) {
        console.warn('⚠️ createAnchor no está disponible en esta sesión');
        return null;
      }

      const anchorData: ARAnchorData = {
        id: crypto.randomUUID(),
        position: position.clone(),
        rotation: rotation.clone(),
        anchorSpace: anchor,
        lastUpdated: Date.now()
      };

      anchorsRef.current.set(anchor, anchorData);

      if (debug) {
        console.log('🔗 Anchor creado desde pose:', anchorData.id);
      }

      onAnchorCreated?.(anchorData);

      return anchorData;
    } catch (error) {
      console.error('❌ Error creando anchor desde pose:', error);
      return null;
    }
  }, [session, isSupported, debug, onAnchorCreated]);

  // Eliminar anchor
  const deleteAnchor = useCallback((anchorId: string) => {
    let deleted = false;

    anchorsRef.current.forEach((data, anchor) => {
      if (data.id === anchorId) {
        // WebXR Anchors API: delete para eliminar el anchor
        anchor.delete();
        anchorsRef.current.delete(anchor);
        deleted = true;

        if (debug) {
          console.log('🗑️ Anchor eliminado:', anchorId);
        }

        onAnchorDeleted?.(anchorId);
      }
    });

    if (!deleted) {
      console.warn('⚠️ Anchor no encontrado para eliminar:', anchorId);
    }
  }, [debug, onAnchorDeleted]);

  // Limpiar todos los anchors
  const clearAllAnchors = useCallback(() => {
    anchorsRef.current.forEach((data, anchor) => {
      anchor.delete();
      onAnchorDeleted?.(data.id);
    });

    anchorsRef.current.clear();

    if (debug) {
      console.log('🧹 Todos los anchors eliminados');
    }
  }, [debug, onAnchorDeleted]);

  // Actualizar posiciones de anchors cada frame
  useFrame((state) => {
    if (!session || !isSupported || !localRefSpaceRef.current) return;

    const frame = state.gl.xr.getFrame();
    if (!frame) return;

    // WebXR Anchors API: frame.trackedAnchors proporciona todos los anchors activos
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const frameAnchors = (frame as any).trackedAnchors as Set<XRAnchor> | undefined;
    
    if (!frameAnchors) return;

    // Actualizar cada anchor con su nueva pose
    frameAnchors.forEach((anchor) => {
      const anchorData = anchorsRef.current.get(anchor);
      if (!anchorData) return;

      try {
        // Obtener pose actualizada del anchor
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pose = (frame as any).getPose?.(anchor.anchorSpace, localRefSpaceRef.current!);
        
        if (pose) {
          const matrix = new THREE.Matrix4().fromArray(pose.transform.matrix);
          anchorData.position.setFromMatrixPosition(matrix);
          anchorData.rotation.setFromRotationMatrix(matrix);
          anchorData.lastUpdated = Date.now();

          // Notificar actualización
          onAnchorUpdated?.(anchorData);
        }
      } catch (error) {
        if (debug) {
          console.warn('⚠️ Error actualizando anchor:', error);
        }
      }
    });

    // Eliminar anchors que ya no están tracked
    anchorsRef.current.forEach((data, anchor) => {
      if (!frameAnchors.has(anchor)) {
        anchorsRef.current.delete(anchor);
        onAnchorDeleted?.(data.id);
        
        if (debug) {
          console.log('🔗 Anchor perdido (tracking):', data.id);
        }
      }
    });
  });

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      clearAllAnchors();
    };
  }, [clearAllAnchors]);

  // Exponer API a través de ref imperativo
  useEffect(() => {
    // Guardar API en window para acceso desde otros componentes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__arAnchorsAPI = {
      createAnchorFromHitTest,
      createAnchorFromPose,
      deleteAnchor,
      clearAllAnchors,
      getAllAnchors: () => Array.from(anchorsRef.current.values()),
      isSupported
    };

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__arAnchorsAPI;
    };
  }, [createAnchorFromHitTest, createAnchorFromPose, deleteAnchor, clearAllAnchors, isSupported]);

  // Este componente no renderiza nada visible
  return null;
}

// Hook para usar la API de anchors desde otros componentes
export function useARAnchors() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).__arAnchorsAPI as {
    createAnchorFromHitTest: (hitTestResult: XRHitTestResult) => Promise<ARAnchorData | null>;
    createAnchorFromPose: (position: THREE.Vector3, rotation: THREE.Quaternion) => Promise<ARAnchorData | null>;
    deleteAnchor: (anchorId: string) => void;
    clearAllAnchors: () => void;
    getAllAnchors: () => ARAnchorData[];
    isSupported: boolean;
  } | undefined;
}
