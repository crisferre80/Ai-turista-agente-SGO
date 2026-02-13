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
  normalized.hotspots = normalized.hotspots.map(h => {
    const pos = vecToObj(h.position);
    const rot = h.rotation ? vecToObj(h.rotation) : undefined;
    const scl = h.scale ? vecToObj(h.scale) : undefined;
    return {
      ...h,
      position: { x: Number(pos.x), y: Number(pos.y), z: Number(pos.z) },
      rotation: rot ? { x: Number(rot.x), y: Number(rot.y), z: Number(rot.z) } : undefined,
      scale: scl ? { x: Number(scl.x), y: Number(scl.y), z: Number(scl.z) } : undefined
    };
  });

  normalized.primitives = (normalized.primitives || []).map(p => {
    const pos = vecToObj(p.position);
    const rot = vecToObj(p.rotation);
    const scl = vecToObj(p.scale);
    return {
      ...p,
      position: { x: Number(pos.x), y: Number(pos.y), z: Number(pos.z) },
      rotation: { x: Number(rot.x), y: Number(rot.y), z: Number(rot.z) },
      scale: { x: Number(scl.x), y: Number(scl.y), z: Number(scl.z) }
    };
  });

  const mt = normalized.modelTransform;
  const mtPos = vecToObj(mt.position);
  const mtRot = vecToObj(mt.rotation);
  const mtScl = vecToObj(mt.scale);
  normalized.modelTransform = {
    position: { x: Number(mtPos.x), y: Number(mtPos.y), z: Number(mtPos.z) },
    rotation: { x: Number(mtRot.x), y: Number(mtRot.y), z: Number(mtRot.z) },
    scale: { x: Number(mtScl.x), y: Number(mtScl.y), z: Number(mtScl.z) }
  };

  return normalized;
}
