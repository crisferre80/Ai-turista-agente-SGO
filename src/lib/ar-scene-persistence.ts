"use client";

import type { SupabaseClient } from '@supabase/supabase-js';

export type ARTransform = {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
};

export async function loadARModelFromScene(params: {
  supabase: SupabaseClient;
  attractionId: string;
}): Promise<{ transform: ARTransform | null; modelUrl: string | null }> {
  const { supabase, attractionId } = params;

  const { data: scene, error: sceneError } = await supabase
    .from('scenes')
    .select('id')
    .eq('attraction_id', attractionId)
    .maybeSingle();

  if (sceneError || !scene?.id) {
    return { transform: null, modelUrl: null };
  }

  const { data: entity, error: entityError } = await supabase
    .from('scene_entities')
    .select('transform,payload,updated_at,created_at')
    .eq('scene_id', scene.id)
    .eq('type', 'model')
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (entityError || !entity) {
    return { transform: null, modelUrl: null };
  }

  const payload = (entity as unknown as { payload?: unknown }).payload as
    | { model_url?: string | null }
    | null
    | undefined;

  const modelUrl = payload?.model_url ?? null;
  const transform = (entity as unknown as { transform?: ARTransform | null }).transform ?? null;
  return { transform, modelUrl };
}

export async function saveARModelToScene(params: {
  supabase: SupabaseClient;
  attractionId: string;
  modelUrl: string;
  transform: ARTransform;
  sceneName?: string;
}) {
  const { supabase, attractionId, modelUrl, transform, sceneName } = params;

  const { data, error } = await supabase.rpc('rpc_upsert_ar_model', {
    p_attraction_id: attractionId,
    p_model_url: modelUrl,
    p_transform: transform,
    p_name: sceneName ?? null,
  });

  if (error) throw error;
  return (data as unknown as Array<{ scene_id: string; asset_id: string; entity_id: string }> | null)?.[0] ?? null;
}
