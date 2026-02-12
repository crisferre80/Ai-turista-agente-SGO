-- Script para actualizar registros existentes de ar_hotspots que no tienen modelTransform
-- Agrega modelTransform por defecto a los registros que lo necesitan

UPDATE attractions
SET ar_hotspots = jsonb_set(
  ar_hotspots,
  '{modelTransform}',
  '{
    "position": {"x": 0, "y": 0, "z": 0},
    "rotation": {"x": 0, "y": 0, "z": 0},
    "scale": {"x": 1, "y": 1, "z": 1}
  }'::jsonb
)
WHERE ar_hotspots IS NOT NULL
  AND ar_hotspots->>'modelTransform' IS NULL;

-- Verificar que se actualizaron correctamente
SELECT
  id,
  name,
  ar_hotspots->'modelTransform' as model_transform
FROM attractions
WHERE ar_hotspots IS NOT NULL
ORDER BY id;