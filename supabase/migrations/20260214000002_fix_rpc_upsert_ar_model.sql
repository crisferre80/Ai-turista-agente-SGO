-- Fix RPC y constraints para persistencia AR
-- Fecha: 2026-02-14
-- Motivo: ON CONFLICT (attraction_id) no puede inferir índices UNIQUE parciales.
--         Además, asegurar permisos/RLS y restringir el RPC a admins.

-- 1) Reemplazar índice parcial por UNIQUE normal (UNIQUE permite múltiples NULL)
DROP INDEX IF EXISTS public.uq_scenes_attraction_id;
CREATE UNIQUE INDEX IF NOT EXISTS uq_scenes_attraction_id
ON public.scenes(attraction_id);

-- 1.1) Consistencia de schema: assets tiene trigger updated_at pero faltaba la columna
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2) Activar RLS y políticas mínimas (lectura pública si is_public, escritura solo admin)
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scene_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- Scenes
DROP POLICY IF EXISTS "scenes_public_read" ON public.scenes;
CREATE POLICY "scenes_public_read" ON public.scenes
  FOR SELECT TO public
  USING (is_public = TRUE);

DROP POLICY IF EXISTS "scenes_admin_write" ON public.scenes;
CREATE POLICY "scenes_admin_write" ON public.scenes
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Scene entities
DROP POLICY IF EXISTS "scene_entities_public_read" ON public.scene_entities;
CREATE POLICY "scene_entities_public_read" ON public.scene_entities
  FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.scenes s
      WHERE s.id = scene_id AND s.is_public = TRUE
    )
  );

DROP POLICY IF EXISTS "scene_entities_admin_write" ON public.scene_entities;
CREATE POLICY "scene_entities_admin_write" ON public.scene_entities
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Assets
DROP POLICY IF EXISTS "assets_public_read" ON public.assets;
CREATE POLICY "assets_public_read" ON public.assets
  FOR SELECT TO public
  USING (
    scene_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.scenes s
      WHERE s.id = scene_id AND s.is_public = TRUE
    )
  );

DROP POLICY IF EXISTS "assets_admin_write" ON public.assets;
CREATE POLICY "assets_admin_write" ON public.assets
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3) Re-declarar el RPC como SECURITY DEFINER + guard de admin
CREATE OR REPLACE FUNCTION public.rpc_upsert_ar_model(
  p_attraction_id uuid,
  p_model_url text,
  p_transform jsonb DEFAULT NULL,
  p_name text DEFAULT NULL
)
RETURNS TABLE(scene_id uuid, asset_id uuid, entity_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scene_id uuid;
  v_asset_id uuid;
  v_entity_id uuid;
  v_transform jsonb;
BEGIN
  -- Guard: solo admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No autorizado: se requiere admin';
  END IF;

  IF p_attraction_id IS NULL THEN
    RAISE EXCEPTION 'p_attraction_id es requerido';
  END IF;

  IF p_model_url IS NULL OR btrim(p_model_url) = '' THEN
    RAISE EXCEPTION 'p_model_url es requerido y no puede ser vacío';
  END IF;

  v_transform := COALESCE(
    p_transform,
    jsonb_build_object(
      'position', jsonb_build_object('x',0,'y',0,'z',0),
      'rotation', jsonb_build_object('x',0,'y',0,'z',0),
      'scale',    jsonb_build_object('x',1,'y',1,'z',1)
    )
  );

  -- Upsert de escena (1 por attraction)
  INSERT INTO public.scenes(attraction_id, name, metadata)
  VALUES (p_attraction_id, COALESCE(p_name, 'Escena AR'), '{}'::jsonb)
  ON CONFLICT (attraction_id)
  DO UPDATE SET
    name = COALESCE(EXCLUDED.name, public.scenes.name),
    updated_at = now()
  RETURNING id INTO v_scene_id;

  -- Asset (por URL) para evitar duplicación infinita
  SELECT a.id
  INTO v_asset_id
  FROM public.assets a
  WHERE a.scene_id = v_scene_id
    AND a.public_url = p_model_url
    AND COALESCE(a.meta->>'kind','') = 'model'
  ORDER BY a.created_at DESC
  LIMIT 1;

  IF v_asset_id IS NULL THEN
    INSERT INTO public.assets(scene_id, public_url, meta)
    VALUES (
      v_scene_id,
      p_model_url,
      jsonb_build_object('kind','model','source','ar-config')
    )
    RETURNING id INTO v_asset_id;
  END IF;

  -- Upsert entity tipo model (una por escena, order_index = 0)
  SELECT e.id
  INTO v_entity_id
  FROM public.scene_entities e
  WHERE e.scene_id = v_scene_id
    AND e.type = 'model'
    AND COALESCE(e.order_index, 0) = 0
  ORDER BY e.created_at DESC
  LIMIT 1;

  IF v_entity_id IS NULL THEN
    INSERT INTO public.scene_entities(scene_id, type, order_index, "transform", payload)
    VALUES (
      v_scene_id,
      'model',
      0,
      v_transform,
      jsonb_build_object(
        'asset_id', v_asset_id,
        'model_url', p_model_url
      )
    )
    RETURNING id INTO v_entity_id;
  ELSE
    UPDATE public.scene_entities
    SET
      "transform" = v_transform,
      payload = COALESCE(payload, '{}'::jsonb) || jsonb_build_object(
        'asset_id', v_asset_id,
        'model_url', p_model_url
      ),
      updated_at = now()
    WHERE id = v_entity_id;
  END IF;

  -- Compatibilidad temporal con el esquema legado
  UPDATE public.attractions
  SET ar_model_url = p_model_url
  WHERE id = p_attraction_id;

  scene_id := v_scene_id;
  asset_id := v_asset_id;
  entity_id := v_entity_id;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_upsert_ar_model(uuid, text, jsonb, text) TO authenticated;
