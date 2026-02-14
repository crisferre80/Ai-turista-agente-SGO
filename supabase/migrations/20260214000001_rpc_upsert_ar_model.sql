-- RPC: Upsert modelo AR en scenes/assets/scene_entities
-- Fecha: 2026-02-14
-- Objetivo: dejar de depender solo de attractions.ar_model_url y persistir el modelo 3D
--           en el esquema normalizado (scenes / scene_entities / assets).

-- 1 escena por attraction
CREATE UNIQUE INDEX IF NOT EXISTS uq_scenes_attraction_id
ON public.scenes(attraction_id)
WHERE attraction_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.rpc_upsert_ar_model(
  p_attraction_id uuid,
  p_model_url text,
  p_transform jsonb DEFAULT NULL,
  p_name text DEFAULT NULL
)
RETURNS TABLE(scene_id uuid, asset_id uuid, entity_id uuid)
LANGUAGE plpgsql
AS $$
DECLARE
  v_scene_id uuid;
  v_asset_id uuid;
  v_entity_id uuid;
  v_transform jsonb;
BEGIN
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
  DO UPDATE SET name = COALESCE(EXCLUDED.name, public.scenes.name), updated_at = now()
  RETURNING id INTO v_scene_id;

  -- Upsert-ish de asset (por URL) para no duplicar infinitamente
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

  -- Upsert de entity tipo model (una por escena, order_index = 0)
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
