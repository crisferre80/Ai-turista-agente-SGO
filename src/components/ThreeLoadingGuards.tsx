"use client";

import * as THREE from 'three';

const PLACEHOLDER_1x1_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=';

function isEmptyUrl(url: unknown) {
  return typeof url !== 'string' || url.trim() === '';
}

function patchThreeEmptyTextureGuards() {
  const globalKey = '__three_empty_texture_url_guard_applied__';
  const globalAsRecord = globalThis as unknown as Record<string, unknown>;
  if (globalAsRecord[globalKey] === true) return;

  // 1) LoadingManager URL modifier (covers most loaders, including GLTFLoader internals)
  try {
    const manager = THREE.DefaultLoadingManager as unknown as {
      setURLModifier?: (fn: (url: string) => string) => void;
      urlModifier?: ((url: string) => string) | undefined;
    };

    if (typeof manager.setURLModifier === 'function') {
      const prev = manager.urlModifier;
      const wrapped = (url: string) => {
        try {
          const nextUrl = typeof prev === 'function' ? prev(url) : url;
          if (isEmptyUrl(nextUrl)) return PLACEHOLDER_1x1_PNG;
          return nextUrl;
        } catch {
          if (isEmptyUrl(url)) return PLACEHOLDER_1x1_PNG;
          return url;
        }
      };
      manager.setURLModifier(wrapped);
    }
  } catch {
    // noop
  }

  // 2) Directly patch ImageLoader / ImageBitmapLoader to catch any bypass cases
  try {
    const imageLoaderProto = (THREE as unknown as { ImageLoader?: { prototype?: unknown } }).ImageLoader
      ?.prototype as unknown as Record<string, unknown> | undefined;

    if (imageLoaderProto && imageLoaderProto.__emptyUrlPatched__ !== true) {
      const originalLoad = imageLoaderProto.load as
        | ((url: string, onLoad?: unknown, onProgress?: unknown, onError?: unknown) => unknown)
        | undefined;

      if (typeof originalLoad === 'function') {
        imageLoaderProto.load = function (url: string, onLoad?: unknown, onProgress?: unknown, onError?: unknown) {
          const safeUrl = isEmptyUrl(url) ? PLACEHOLDER_1x1_PNG : url;
          return originalLoad.call(this, safeUrl, onLoad, onProgress, onError);
        };
        imageLoaderProto.__emptyUrlPatched__ = true;
      }
    }
  } catch {
    // noop
  }

  try {
    const imageBitmapLoaderProto = (THREE as unknown as { ImageBitmapLoader?: { prototype?: unknown } })
      .ImageBitmapLoader?.prototype as unknown as Record<string, unknown> | undefined;

    if (imageBitmapLoaderProto && imageBitmapLoaderProto.__emptyUrlPatched__ !== true) {
      const originalLoad = imageBitmapLoaderProto.load as
        | ((url: string, onLoad?: unknown, onProgress?: unknown, onError?: unknown) => unknown)
        | undefined;

      if (typeof originalLoad === 'function') {
        imageBitmapLoaderProto.load = function (url: string, onLoad?: unknown, onProgress?: unknown, onError?: unknown) {
          const safeUrl = isEmptyUrl(url) ? PLACEHOLDER_1x1_PNG : url;
          return originalLoad.call(this, safeUrl, onLoad, onProgress, onError);
        };
        imageBitmapLoaderProto.__emptyUrlPatched__ = true;
      }
    }
  } catch {
    // noop
  }

  globalAsRecord[globalKey] = true;
}

// Aplicar inmediatamente al cargar el módulo (antes de cualquier render)
patchThreeEmptyTextureGuards();

export default function ThreeLoadingGuards() {
  return null;
}
