"use client";

import { useGLTF } from '@react-three/drei';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';

// Ensure the DefaultLoadingManager ignores empty texture URLs from exporters
// Many exporters include empty strings which trigger "Couldn't load texture "" errors.
const _PLACEHOLDER_1x1_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=';
try {
  // Avoid re-registering if already set by another module
  if (typeof THREE.DefaultLoadingManager?.setURLModifier === 'function') {
    // Only set once per page load
    // We store a symbol on the manager to mark we've applied the modifier
    const marker = '__empty_url_modifier_applied__';
    const managerAsRecord = THREE.DefaultLoadingManager as unknown as Record<string, unknown>;
    if (managerAsRecord[marker] !== true) {
      THREE.DefaultLoadingManager.setURLModifier((url) => {
        try {
          const raw = String(url ?? '');
          const trimmed = raw.trim();
          if (trimmed === '') return _PLACEHOLDER_1x1_PNG;
          return raw;
        } catch {
          return url;
        }
      });
      managerAsRecord[marker] = true;
    }
  }
} catch {
  // noop - defensive
}

// Hook que encapsula useGLTF para centralizar futuros cambios
export function useModel(url: string) {
  // useGLTF suspends while loading; callers should wrap in <Suspense>
  const gltf = useGLTF(url) as unknown as GLTF;
  return gltf;
}

// Carga imperativa (útil en componentes no-suspense / efectos)
export async function loadGLTF(url: string): Promise<GLTF> {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const THREE = await import('three');

  // LoadingManager para interceptar URLs vacías en texturas y reemplazarlas
  // por un placeholder 1x1 PNG data URI. Muchos exporters dejan campos
  // vacíos que provocan "Couldn't load texture " errors en consola.
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    try {
      const raw = String(url ?? '');
      const trimmed = raw.trim();
      if (trimmed === '') return _PLACEHOLDER_1x1_PNG;
      return raw;
    } catch {
      return url;
    }
  });

  return await new Promise<GLTF>((resolve, reject) => {
    const loader = new GLTFLoader(manager);
    loader.load(
      url,
      (gltf) => resolve(gltf as GLTF),
      undefined,
      (err) => reject(err)
    );
  });
}

const modelLoader = {
  useModel,
  loadGLTF,
};

export default modelLoader;
