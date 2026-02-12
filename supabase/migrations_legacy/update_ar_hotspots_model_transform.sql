-- Script para actualizar registros existentes de ar_hotspots que no tienen modelTransform
-- Agrega modelTransform por defecto a los registros que lo necesitan

-- Solo ejecutar si la tabla existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attractions') THEN

    -- Primero, convertir arrays a objetos (caso donde ar_hotspots era solo un array de hotspots)
    UPDATE public.attractions
    SET ar_hotspots = jsonb_build_object(
      'hotspots', ar_hotspots,
      'primitives', '[]'::jsonb,
      'modelTransform', '{
        "position": {"x": 0, "y": 0, "z": 0},
        "rotation": {"x": 0, "y": 0, "z": 0},
        "scale": {"x": 1, "y": 1, "z": 1}
      }'::jsonb
    )
    WHERE ar_hotspots IS NOT NULL
      AND jsonb_typeof(ar_hotspots) = 'array';

    -- Luego, agregar modelTransform a objetos que no lo tienen
    UPDATE public.attractions
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
      AND jsonb_typeof(ar_hotspots) = 'object'
      AND ar_hotspots->>'modelTransform' IS NULL;

    -- Verificar que se actualizaron correctamente
    RAISE NOTICE 'Migración completada. Registros actualizados: %',
      (SELECT COUNT(*) FROM public.attractions WHERE ar_hotspots IS NOT NULL);

  ELSE
    RAISE NOTICE 'La tabla public.attractions no existe. Saltando migración.';
  END IF;
END $$;