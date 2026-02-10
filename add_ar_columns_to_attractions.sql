-- Script para agregar columnas de Realidad Aumentada a la tabla attractions
-- Ejecutar en el editor SQL de Supabase

-- Agregar columna para URL del modelo 3D (GLTF/GLB/OBJ)
ALTER TABLE attractions
ADD COLUMN IF NOT EXISTS ar_model_url TEXT;

-- Agregar columna para datos JSON de hotspots AR (posiciones, info, videos)
ALTER TABLE attractions
ADD COLUMN IF NOT EXISTS ar_hotspots JSONB DEFAULT '[]'::jsonb;

-- Agregar columna para indicar si el atractivo tiene contenido AR disponible
ALTER TABLE attractions
ADD COLUMN IF NOT EXISTS has_ar_content BOOLEAN DEFAULT FALSE;

-- Agregar columna para código QR único del atractivo
ALTER TABLE attractions
ADD COLUMN IF NOT EXISTS qr_code TEXT UNIQUE;

-- Agregar índice para búsquedas rápidas de lugares con AR
CREATE INDEX IF NOT EXISTS idx_attractions_has_ar 
ON attractions(has_ar_content) 
WHERE has_ar_content = TRUE;

-- Agregar índice para búsquedas por QR
CREATE INDEX IF NOT EXISTS idx_attractions_qr_code 
ON attractions(qr_code) 
WHERE qr_code IS NOT NULL;

-- Ejemplo de estructura de ar_hotspots JSON:
-- {
--   "hotspots": [
--     {
--       "id": "info-1",
--       "type": "info",
--       "position": [0, 1.5, -2],
--       "title": "Historia del Monumento",
--       "description": "Construido en 1810...",
--       "image_url": "https://...",
--       "rotation": [0, 0, 0]
--     },
--     {
--       "id": "video-1",
--       "type": "video",
--       "position": [2, 1, -3],
--       "video_url": "https://www.youtube.com/watch?v=...",
--       "thumbnail_url": "https://...",
--       "title": "Construcción del lugar",
--       "rotation": [0, 45, 0]
--     },
--     {
--       "id": "model-1",
--       "type": "3d_model",
--       "position": [0, 0, -5],
--       "model_url": "https://storage.supabase.co/.../model.glb",
--       "scale": [1, 1, 1],
--       "rotation": [0, 0, 0]
--     }
--   ]
-- }

-- Comentarios sobre las columnas:
-- ar_model_url: URL del modelo 3D principal del atractivo (formato GLTF/GLB recomendado)
-- ar_hotspots: Array JSON con posiciones y contenido de elementos AR (info, videos, modelos adicionales)
-- has_ar_content: Flag booleano para filtrar rápidamente atractivos con contenido AR
-- qr_code: Código único para identificar el atractivo al escanear QR (ej: "ATR-001", UUID, etc.)

COMMENT ON COLUMN attractions.ar_model_url IS 'URL del modelo 3D principal para AR (GLTF/GLB/OBJ)';
COMMENT ON COLUMN attractions.ar_hotspots IS 'Array JSON con hotspots AR: info, videos, modelos 3D adicionales';
COMMENT ON COLUMN attractions.has_ar_content IS 'Indica si el atractivo tiene contenido AR disponible';
COMMENT ON COLUMN attractions.qr_code IS 'Código QR único para identificar el atractivo';
