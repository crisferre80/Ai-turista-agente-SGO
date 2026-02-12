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
}

export function ARHitTest({ 
  onHitTest, 
  onPlace, 
  showReticle = true,
  children 
}: ARHitTestProps) {
  const { session } = useXR();
  const { } = useThree();
  
  const hitTestSourceRef = useRef<XRHitTestSource | null>(null);
  const reticleRef = useRef<THREE.Mesh>(null);
  const [hitResult, setHitResult] = useState<HitTestResult | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);
  const [placedObjects, setPlacedObjects] = useState<HitTestResult[]>([]);

  // Configurar hit test source cuando se inicia la sesión
  const setupHitTestSource = useCallback(async () => {
    if (!session) return;

    try {
      // Solicitar referencia space
      const referenceSpace = await session.requestReferenceSpace('viewer');
      
      // Crear hit test source desde el viewer space
      if (session.requestHitTestSource) {
        const hitTestSource = await session.requestHitTestSource({ space: referenceSpace });
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
    };
  }, [session, setupHitTestSource]);

  // Realizar hit test cada frame
  useFrame((state) => {
    if (!session || !hitTestSourceRef.current) return;

    const frame = state.gl.xr.getFrame();
    if (!frame) return;

    try {
      // Obtener hit test results
      const hitTestResults = frame.getHitTestResults(hitTestSourceRef.current);
      
      if (hitTestResults.length > 0) {
        const hit = hitTestResults[0];
        // Crear referencia space para el hit test
        const referenceSpace = session.requestReferenceSpace('local');
        Promise.resolve(referenceSpace).then(refSpace => {
          const pose = hit.getPose(refSpace);
          
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

            // Posicionar reticle
            if (reticleRef.current) {
              reticleRef.current.position.copy(position);
              reticleRef.current.quaternion.copy(rotation);
              reticleRef.current.visible = true;
            }
          }
        }).catch(err => console.warn('Error en hit test:', err));
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

    setIsPlacing(true);
    
    try {
      // Agregar objeto a los objetos colocados
      setPlacedObjects(prev => [...prev, hitResult]);
      onPlace?.(hitResult);
      
      console.log('✅ Objeto colocado en:', {
        position: hitResult.position.toArray(),
        rotation: hitResult.rotation.toArray()
      });
      
    } catch (error) {
      console.error('Error colocando objeto:', error);
    } finally {
      setTimeout(() => setIsPlacing(false), 500);
    }
  }, [hitResult, isPlacing, onPlace]);

  // Configurar eventos de input (tap para colocar)
  useEffect(() => {
    if (!session) return;

    const onSelectStart = () => handlePlace();
    
    session.addEventListener('selectstart', onSelectStart);
    
    return () => {
      session.removeEventListener('selectstart', onSelectStart);
    };
  }, [session, handlePlace]);

  return (
    <group>
      {/* Reticle de hit testing */}
      {showReticle && (
        <mesh ref={reticleRef} visible={false}>
          <ringGeometry args={[0.15, 0.2, 32]} />
          <meshBasicMaterial 
            color="#ffffff" 
            transparent 
            opacity={0.7}
            side={THREE.DoubleSide}
          />
          {/* Círculo interior */}
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

      {/* Renderizar objetos colocados */}
      {placedObjects.map((placed, index) => (
        <group
          key={index}
          position={placed.position}
          quaternion={placed.rotation}
        >
          {children}
        </group>
      ))}

      {/* Objeto en la posición de hit test (preview) */}
      {hitResult && !isPlacing && (
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

// Componente reticle personalizable
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
      
      {/* Centro del reticle */}
      <mesh>
        <circleGeometry args={[size * 0.15, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.9}
        />
      </mesh>
      
      {/* Animación de pulso */}
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