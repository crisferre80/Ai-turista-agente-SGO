import type { ARData, ARHotspot, ARHotspotType } from '@/types/ar';

const defaultModelTransform = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 }
};

type PossiblyVector = unknown;

function vecToObj(v: PossiblyVector): { x: number; y: number; z: number } {
  if (v === null || v === undefined) return { x: 0, y: 0, z: 0 };

  // Array-like [x,y,z]
  if (Array.isArray(v)) {
    const [a = 0, b = 0, c = 0] = v as Array<unknown>;
    return { x: Number(a) || 0, y: Number(b) || 0, z: Number(c) || 0 };
  }

  // Object-like { x, y, z }
  if (typeof v === 'object') {
    const r = v as Record<string, unknown>;
    return {
      x: Number(r.x as unknown as number) || 0,
      y: Number(r.y as unknown as number) || 0,
      z: Number(r.z as unknown as number) || 0
    };
  }

  // Fallback: try to coerce a scalar (unlikely) into z-axis
  const n = Number(v as unknown as number);
  return { x: n || 0, y: 0, z: 0 };
}

function normalizeHotspot(raw: unknown): ARHotspot {
  const r = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
  const rawType = String(r.type ?? 'info') as unknown as string;
  const type = (['info', 'image', 'video', '3d_model', 'audio'].includes(rawType) ? rawType : 'info') as ARHotspotType;

  const base: Partial<ARHotspot> = {
    id: String(r.id ?? `hot_${Date.now()}`),
    type,
    position: vecToObj(r.position),
    rotation: r.rotation ? vecToObj(r.rotation) : undefined,
    scale: r.scale ? vecToObj(r.scale) : undefined
  };

  // Fill type-specific minimum fields so the returned object matches ARHotspot union
  if (type === 'video') {
    return {
      ...base,
      type: 'video',
      video_url: String(r.video_url ?? r.content_url ?? ''),
      title: String(r.title ?? '')
    } as ARHotspot;
  }

  if (type === '3d_model') {
    return {
      ...base,
      type: '3d_model',
      model_url: String(r.model_url ?? ''),
    } as ARHotspot;
  }

  if (type === 'audio') {
    return {
      ...base,
      type: 'audio',
      audio_url: String(r.audio_url ?? ''),
      title: String(r.title ?? '')
    } as ARHotspot;
  }

  // Default to info/image-like hotspot
  return {
    ...base,
    type: type as 'info' | 'image',
    title: String(r.title ?? ''),
    description: String(r.description ?? ''),
    image_url: String(r.image_url ?? r.content_url ?? '') || undefined
  } as ARHotspot;
}

export function normalizeARData(raw: unknown): ARData {
  // null/undefined -> defaults
  if (!raw) return { hotspots: [], primitives: [], modelTransform: defaultModelTransform };

  // If legacy array (previous format), treat as hotspots array
  if (Array.isArray(raw)) {
    return {
      hotspots: (raw as Array<unknown>).map(h => normalizeHotspot(h)),
      primitives: [],
      modelTransform: defaultModelTransform
    };
  }

  // If object, ensure keys exist and normalize nested vectors
  const obj = (typeof raw === 'object' && raw !== null) ? (raw as Record<string, unknown>) : {};
  const hotspots = Array.isArray(obj.hotspots) ? (obj.hotspots as Array<unknown>).map(h => normalizeHotspot(h)) : [];
  const primitives = Array.isArray(obj.primitives) ? (obj.primitives as Array<Record<string, unknown>>).map((p) => ({
    id: String(p.id ?? `prim_${Date.now()}`),
    type: (['box', 'sphere', 'cylinder', 'cone', 'plane'].includes(p.type as string) ? p.type as 'box' | 'sphere' | 'cylinder' | 'cone' | 'plane' : 'box'),
    position: vecToObj(p.position),
    rotation: vecToObj(p.rotation),
    scale: vecToObj(p.scale) || { x: 1, y: 1, z: 1 },
    color: String(p.color ?? '#667eea')
  })) : [];

  const mt = obj.modelTransform as Record<string, unknown> | undefined;
  const modelTransform = mt
    ? {
        position: vecToObj(mt.position),
        rotation: vecToObj(mt.rotation),
        scale: vecToObj(mt.scale) || { x: 1, y: 1, z: 1 }
      }
    : defaultModelTransform;

  return { hotspots, primitives, modelTransform };
}

export function canonicalizeARDataForSave(raw: unknown): ARData {
  // Reuse normalize but also ensure primitive numbers and plain objects
  const normalized = normalizeARData(raw);
  // Force numeric casts
  normalized.hotspots = normalized.hotspots.map(h => ({
    ...h,
    position: { x: Number(h.position.x), y: Number(h.position.y), z: Number(h.position.z) },
    rotation: h.rotation ? { x: Number(h.rotation.x), y: Number(h.rotation.y), z: Number(h.rotation.z) } : undefined,
    scale: h.scale ? { x: Number(h.scale.x), y: Number(h.scale.y), z: Number(h.scale.z) } : undefined
  }));

  normalized.primitives = normalized.primitives.map(p => ({
    ...p,
    position: { x: Number(p.position.x), y: Number(p.position.y), z: Number(p.position.z) },
    rotation: { x: Number(p.rotation.x), y: Number(p.rotation.y), z: Number(p.rotation.z) },
    scale: { x: Number(p.scale.x), y: Number(p.scale.y), z: Number(p.scale.z) }
  }));

  normalized.modelTransform = {
    position: { x: Number(normalized.modelTransform.position.x), y: Number(normalized.modelTransform.position.y), z: Number(normalized.modelTransform.position.z) },
    rotation: { x: Number(normalized.modelTransform.rotation.x), y: Number(normalized.modelTransform.rotation.y), z: Number(normalized.modelTransform.rotation.z) },
    scale: { x: Number(normalized.modelTransform.scale.x), y: Number(normalized.modelTransform.scale.y), z: Number(normalized.modelTransform.scale.z) }
  };

  return normalized;
}
