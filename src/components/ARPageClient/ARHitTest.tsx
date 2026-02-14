'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useXR } from '@react-three/xr';
import * as THREE from 'three';

interface HitTestResult {
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  transform: XRRigidTransform;
}

interface ARHitTestProps {
  onHitTest?: (result: HitTestResult | null) => void;
  onPlace?: (result: HitTestResult) => void;
  showReticle?: boolean;
  children?: React.ReactNode;
  autoPlace?: boolean;
  singlePlacement?: boolean;
}

export function ARHitTest({ 
  onHitTest, 
  onPlace, 
  showReticle = true,
  children,
  autoPlace = false,
  singlePlacement = true
}: ARHitTestProps) {
  const { session } = useXR();
  const { } = useThree();
  
  const hitTestSourceRef = useRef<XRHitTestSource | null>(null);
  const localRefSpaceRef = useRef<XRReferenceSpace | null>(null);
  const reticleRef = useRef<THREE.Mesh>(null);
  const [hitResult, setHitResult] = useState<HitTestResult | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);
  const [hasPlaced, setHasPlaced] = useState(false);
  const autoPlaceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Configurar hit test source cuando se inicia la sesión
  const setupHitTestSource = useCallback(async () => {
    if (!session) return;

    try {
      // Obtener tanto el reference space 'viewer' para el hit test source
      // como el reference space local para resolver las poses una sola vez.
      const viewerRef = await session.requestReferenceSpace('viewer');
      try {
        localRefSpaceRef.current = await session.requestReferenceSpace('local');
      } catch (e) {
        // algunos runtimes pueden no soportar 'local' explícitamente; dejar null y usar viewer como fallback
        console.warn('No se pudo obtener referenceSpace "local", usando "viewer" como fallback', e);
        localRefSpaceRef.current = null;
      }

      if (session.requestHitTestSource) {
        const hitTestSource = await session.requestHitTestSource({ space: viewerRef });
        hitTestSourceRef.current = hitTestSource || null;
      }
      console.log('✅ Hit test source configurado');
      
    } catch (error) {
      console.error('❌ Error configurando hit test:', error);
    }
  }, [session]);

  // Configurar hit test cuando sesión está activa
  useEffect(() => {
    if (session && !hitTestSourceRef.current) {
      setupHitTestSource();
    }

    return () => {
      if (hitTestSourceRef.current) {
        hitTestSourceRef.current.cancel();
        hitTestSourceRef.current = null;
      }
      localRefSpaceRef.current = null;
    };
  }, [session, setupHitTestSource]);

  // Realizar hit test cada frame
  useFrame((state) => {
    if (!session || !hitTestSourceRef.current) return;

    const frame = state.gl.xr.getFrame();
    if (!frame) return;

    try {
      const hitTestResults = frame.getHitTestResults(hitTestSourceRef.current);

      if (hitTestResults.length > 0) {
        const hit = hitTestResults[0];
        const refSpace = localRefSpaceRef.current || undefined;
        // Si no tenemos un reference space local disponible, no intentamos resolver la pose.
        const pose = refSpace ? hit.getPose(refSpace) : undefined;

        if (pose) {
          const matrix = new THREE.Matrix4().fromArray(pose.transform.matrix as Float32Array);
          const position = new THREE.Vector3().setFromMatrixPosition(matrix);
          const rotation = new THREE.Quaternion().setFromRotationMatrix(matrix);

          const result: HitTestResult = {
            position,
            rotation,
            transform: pose.transform
          };

          setHitResult(result);
          onHitTest?.(result);

          if (reticleRef.current) {
            reticleRef.current.position.copy(position);
            reticleRef.current.quaternion.copy(rotation);
            reticleRef.current.visible = true;
          }
        }
      } else {
        setHitResult(null);
        onHitTest?.(null);
        
        if (reticleRef.current) {
          reticleRef.current.visible = false;
        }
      }

    } catch (error) {
      console.warn('⚠️ Error en hit test frame:', error);
    }
  });

  // Manejar colocación de objeto
  const handlePlace = useCallback(() => {
    if (!hitResult || isPlacing) return;
    if (singlePlacement && hasPlaced) return;

    setIsPlacing(true);
    
    try {
      onPlace?.(hitResult);
      setHasPlaced(true);
      
      console.log('✅ Objeto colocado en:', {
        position: hitResult.position.toArray(),
        rotation: hitResult.rotation.toArray()
      });
      
    } catch (error) {
      console.error('Error colocando objeto:', error);
    } finally {
      setTimeout(() => setIsPlacing(false), 500);
    }
  }, [hitResult, isPlacing, onPlace, singlePlacement, hasPlaced]);
  
  // Colocación automática cuando se detecta una superficie
  useEffect(() => {
    if (!autoPlace || !hitResult || hasPlaced || isPlacing) return;
    
    autoPlaceTimerRef.current = setTimeout(() => {
      handlePlace();
    }, 1000);
    
    return () => {
      if (autoPlaceTimerRef.current) {
        clearTimeout(autoPlaceTimerRef.current);
      }
    };
  }, [autoPlace, hitResult, hasPlaced, isPlacing, handlePlace]);

  // Configurar eventos de input (tap para colocar)
  useEffect(() => {
    if (!session || autoPlace) return;

    const onSelectStart = () => handlePlace();
    
    session.addEventListener('selectstart', onSelectStart);
    
    return () => {
      session.removeEventListener('selectstart', onSelectStart);
    };
  }, [session, handlePlace, autoPlace]);

  return (
    <group>
      {/* Reticle de hit testing */}
      {showReticle && !hasPlaced && (
        <mesh ref={reticleRef} visible={false}>
          <ringGeometry args={[0.15, 0.2, 32]} />
          <meshBasicMaterial 
            color="#ffffff" 
            transparent 
            opacity={0.7}
            side={THREE.DoubleSide}
          />
          <mesh>
            <circleGeometry args={[0.05, 32]} />
            <meshBasicMaterial 
              color="#00ff00" 
              transparent 
              opacity={0.8}
            />
          </mesh>
        </mesh>
      )}

      {/* Objeto en preview */}
      {hitResult && !hasPlaced && !isPlacing && children && (
        <group
          position={hitResult.position}
          quaternion={hitResult.rotation}
        >
          <group scale={[0.8, 0.8, 0.8]}>
            {children}
          </group>
        </group>
      )}
    </group>
  );
}

export function ARReticle({ 
  visible = true, 
  color = "#00ff00",
  size = 0.2 
}: { 
  visible?: boolean; 
  color?: string;
  size?: number;
}) {
  return (
    <mesh visible={visible}>
      <ringGeometry args={[size * 0.7, size, 32]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.6}
        side={THREE.DoubleSide}
      />
      
      <mesh>
        <circleGeometry args={[size * 0.15, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.9}
        />
      </mesh>
      
      <mesh>
        <ringGeometry args={[size * 0.5, size * 0.6, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.3}
        />
      </mesh>
    </mesh>
  );
}

export default ARHitTest;
