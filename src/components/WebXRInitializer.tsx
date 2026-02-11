'use client';

import { useEffect } from 'react';

/**
 * Componente que inicializa WebXR polyfill y configuraciones necesarias
 * Solo se debe usar en páginas que requieran AR
 */
export function WebXRInitializer() {
  
  useEffect(() => {
    // Inicializar WebXR polyfill si es necesario
    const initWebXR = async () => {
      try {
        // Verificar si necesitamos el polyfill
        if (!('xr' in navigator)) {
          console.log('🔄 Iniciando WebXR polyfill...');
          
          // El polyfill ya se importa en webxr-config.ts
          // Aquí solo verificamos que se haya cargado correctamente
          await new Promise(resolve => setTimeout(resolve, 100));
          
          if ('xr' in navigator) {
            console.log('✅ WebXR polyfill inicializado');
          } else {
            console.warn('⚠️ WebXR polyfill no se pudo cargar');
          }
        } else {
          console.log('✅ WebXR nativo disponible');
        }

        // Configurar eventos globales para AR
        setupARDOMEvents();
        
      } catch (error) {
        console.error('❌ Error inicializando WebXR:', error);
      }
    };

    initWebXR();

    // Cleanup
    return () => {
      cleanupARDOMEvents();
    };
  }, []);

  return null; // No renderiza nada
}

/**
 * Configurar eventos DOM necesarios para AR
 */
function setupARDOMEvents() {
  // Prevenir zoom en dispositivos móviles durante AR
  const preventZoom = (e: TouchEvent) => {
    if (e.touches.length > 1) {
      e.preventDefault();
    }
  };

  // Configurar meta viewport para AR
  const viewport = document.querySelector('meta[name=viewport]');
  if (viewport) {
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
  }

  // Evitar selección de texto durante AR
  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';
  
  // Configurar eventos touch
  document.addEventListener('touchstart', preventZoom, { passive: false });
  
  console.log('🎮 AR DOM events configurados');
}

/**
 * Limpiar eventos DOM de AR
 */
function cleanupARDOMEvents() {
  // Restaurar viewport
  const viewport = document.querySelector('meta[name=viewport]');
  if (viewport) {
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
  }

  // Restaurar selección de texto
  document.body.style.userSelect = '';
  document.body.style.webkitUserSelect = '';
  
  // Remover event listeners
  document.removeEventListener('touchstart', () => {});
  
  console.log('🧹 AR DOM events limpiados');
}

export default WebXRInitializer;