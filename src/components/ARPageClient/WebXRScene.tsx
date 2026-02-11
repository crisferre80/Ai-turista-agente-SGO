'use client';

import React, { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { XR, ARButton, createXRStore } from '@react-three/xr';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { ARHitTest } from './ARHitTest';
import ARScene from './ARScene';
import type { ARData } from '@/types/ar';

type Attraction = {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  category?: string;
  lat?: number;
  lng?: number;
  has_ar_content?: boolean;
  ar_model_url?: string;
  ar_hotspots?: ARData;
  qr_code?: string;
};

interface WebXRSceneProps {
  attraction: Attraction;
  onClose: () => void;
}

// Componente principal de la escena WebXR
export function WebXRScene({ attraction, onClose }: WebXRSceneProps) {
  const [placedObjects, setPlacedObjects] = useState<Array<{
    position: THREE.Vector3;
    rotation: THREE.Quaternion;
    id: string;
  }>>([]);
  
  const [isPlacing, setIsPlacing] = useState(true);
  const store = createXRStore();

  const handlePlace = (result: { position: THREE.Vector3; rotation: THREE.Quaternion }) => {
    console.log('📍 Colocando objeto en posición real:', result.position.toArray());
    
    setPlacedObjects(prev => [...prev, {
      ...result,
      id: `placed_${Date.now()}`
    }]);
    
    setIsPlacing(false);
  };

  return (
    <div className="relative w-full h-full bg-black">
      {/* Botón AR nativo de WebXR */}
      <div className="absolute top-4 left-4 right-4 z-50 flex justify-between items-start">
        <div className="bg-black/70 text-white p-2 rounded text-xs">
          <div className="text-green-400">🟢 WebXR AR Real</div>
          <div>Objetos: {placedObjects.length}</div>
        </div>
        
        <button
          onClick={onClose}
          className="bg-red-500/80 hover:bg-red-600 text-white p-2 rounded-full"
          aria-label="Cerrar AR"
        >
          ✕
        </button>
      </div>
      
      {/* Botón de AR - se oculta automáticamente cuando no hay soporte */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50">
        <ARButton
          store={store}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-full shadow-lg transition-all duration-200 transform hover:scale-105"
          onError={(error) => {
            console.error('WebXR AR Error:', error);
          }}
        >
          {isPlacing ? '🎯 Iniciar AR' : '🔄 Reiniciar AR'}
        </ARButton>
      </div>

      {/* Canvas WebXR */}
      <Canvas
        camera={{ position: [0, 1.6, 6], fov: 75 }}
        gl={{ 
          antialias: true,
          preserveDrawingBuffer: true,
          powerPreference: 'high-performance'
        }}
        style={{ 
          width: '100%',
          height: '100%'
        }}
        onCreated={() => {
          console.log('✅ WebXR Canvas creado');
        }}
      >
        {/* Envolvedor XR - habilita WebXR en el Canvas */}
        <XR store={store}>
          {/* Iluminación */}
          <ambientLight intensity={0.4} />
          <directionalLight 
            position={[5, 5, 5]} 
            intensity={0.8} 
            castShadow 
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <pointLight position={[-5, 5, -5]} intensity={0.4} />

          {/* Entorno */}
          <Environment preset="city" />

          {/* Hit Testing - permite colocar objetos en superficies reales */}
          <ARHitTest onPlace={handlePlace} showReticle={isPlacing}>
            <Suspense fallback={<LoadingModel />}>
              <ARObjectModel 
                attraction={attraction}
                scale={0.3}
              />
            </Suspense>
          </ARHitTest>

          {/* Objetos ya colocados en el mundo */}
          {placedObjects.map((obj) => (
            <group
              key={obj.id}
              position={obj.position}
              quaternion={obj.rotation}
            >
              <Suspense fallback={null}>
                <ARObjectModel 
                  attraction={attraction}
                  scale={0.3}
                  isPlaced={true}
                />
              </Suspense>
            </group>
          ))}

          {/* Componente de información AR */}
          <ARInfoDisplay />

        </XR>
      </Canvas>

      {/* Instrucciones */}
      <div className="absolute bottom-24 left-4 right-4 z-40">
        <div className="bg-black/80 text-white p-3 rounded-lg text-sm max-w-md mx-auto">
          <p className="font-semibold mb-2">
            {isPlacing ? '🎯 Modo de colocación' : '✅ Objeto colocado'}
          </p>
          {isPlacing ? (
            <ul className="space-y-1 text-xs">
              <li>• Presiona &quot;Iniciar AR&quot; para comenzar</li>
              <li>• Apunta la cámara hacia una superficie plana</li>
              <li>• Toca la pantalla para colocar el objeto</li>
            </ul>
          ) : (
            <ul className="space-y-1 text-xs">
              <li>• Muévete alrededor para ver el objeto desde diferentes ángulos</li>
              <li>• El objeto está anclado al mundo real</li>
              <li>• Usa &quot;Reiniciar AR&quot; para colocar más objetos</li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// Modelo AR del objeto principal
function ARObjectModel({ 
  attraction, 
  scale = 1,
  isPlaced = false 
}: { 
  attraction: Attraction;
  scale?: number;
  isPlaced?: boolean;
}) {
  // Si hay modelo 3D, usar ARScene existente
  if (attraction.ar_model_url) {
    return (
      <group scale={[scale, scale, scale]}>
        <ARScene
          attraction={{
            id: attraction.id,
            name: attraction.name,
            description: attraction.description,
            lat: attraction.lat || 0,
            lng: attraction.lng || 0,
            image_url: attraction.image_url,
            ar_model_url: attraction.ar_model_url,
            ar_hotspots: attraction.ar_hotspots,
            has_ar_content: true,
            qr_code: attraction.qr_code,
            category: attraction.category,
          }}
          showGrid={false}
          disableOrbitControls={true}
          anchorPosition={[0, 0, 0]}
          isAnchored={isPlaced}
        />
      </group>
    );
  }

  // Modelo placeholder con información del atractivo
  return (
    <group scale={[scale, scale, scale]}>
      {/* Modelo principal */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1, 1.5, 1]} />
        <meshStandardMaterial 
          color={isPlaced ? "#00ff88" : "#4A90E2"}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>
      
      {/* Etiqueta con nombre */}
      <mesh position={[0, 1, 0]}>
        <planeGeometry args={[1.5, 0.4]} />
        <meshBasicMaterial 
          color="#ffffff"
          alphaTest={0.1}
        />
      </mesh>
    </group>
  );
}

// Componente de loading
function LoadingModel() {
  return (
    <mesh>
      <sphereGeometry args={[0.2, 16, 16]} />
      <meshBasicMaterial color="#666" wireframe />
    </mesh>
  );
}

// Panel de información AR
function ARInfoDisplay() {
  return (
    <group position={[0, 2, -2]}>
      <mesh>
        <planeGeometry args={[3, 1]} />
        <meshBasicMaterial 
          color="#000000"
          transparent
          opacity={0.8}
        />
      </mesh>
    </group>
  );
}

export default WebXRScene;