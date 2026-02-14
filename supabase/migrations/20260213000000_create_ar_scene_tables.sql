-- Migration: Crear tablas para persistencia AR
-- Fecha: 2026-02-13
-- Notas: Mantener `attractions.ar_hotspots` como copia legada hasta migración completa.

-- Requiere extensión pgcrypto para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabla principal de escenas (una escena por attraction o agrupación)
CREATE TABLE IF NOT EXISTS public.scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attraction_id uuid REFERENCES public.attractions(id) ON DELETE CASCADE,
  name text,
  metadata jsonb,
  is_public boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Entidades dentro de una escena (hotspots, primitivas, modelos, anchors)
CREATE TABLE IF NOT EXISTS public.scene_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id uuid NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('hotspot','primitive','anchor','model','group')),
  order_index integer DEFAULT 0,
  "transform" jsonb NOT NULL,
  payload jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Referencias a archivos/activos (GLB, imágenes, vídeos)
CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id uuid REFERENCES public.scenes(id) ON DELETE SET NULL,
  bucket text,
  path text,
  public_url text,
  meta jsonb,
  created_at timestamptz DEFAULT now()
);

-- Indexes y GIN para consultas por propiedades
CREATE INDEX IF NOT EXISTS idx_scene_entities_scene_id ON public.scene_entities(scene_id);
CREATE INDEX IF NOT EXISTS idx_assets_scene_id ON public.assets(scene_id);
CREATE INDEX IF NOT EXISTS idx_scene_entities_transform_gin ON public.scene_entities USING gin ("transform");
CREATE INDEX IF NOT EXISTS idx_scene_entities_payload_gin ON public.scene_entities USING gin (payload);
CREATE INDEX IF NOT EXISTS idx_scenes_metadata_gin ON public.scenes USING gin (metadata);

-- Trigger: actualizar updated_at en UPDATE
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scenes_set_updated_at
BEFORE UPDATE ON public.scenes
FOR EACH ROW EXECUTE PROCEDURE public.trigger_set_updated_at();

CREATE TRIGGER scene_entities_set_updated_at
BEFORE UPDATE ON public.scene_entities
FOR EACH ROW EXECUTE PROCEDURE public.trigger_set_updated_at();

CREATE TRIGGER assets_set_updated_at
BEFORE UPDATE ON public.assets
FOR EACH ROW EXECUTE PROCEDURE public.trigger_set_updated_at();

-- End migration
