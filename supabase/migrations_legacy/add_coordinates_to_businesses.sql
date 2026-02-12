-- ==========================================
-- AGREGAR COLUMNAS DE COORDENADAS A BUSINESSES
-- Ejecuta este script en Supabase SQL Editor
-- ==========================================

-- Agregar lat (latitud) si no existe
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'lat') THEN
    ALTER TABLE businesses ADD COLUMN lat FLOAT;
    RAISE NOTICE 'Columna lat agregada a la tabla businesses';
  ELSE
    RAISE NOTICE 'La columna lat ya existe en la tabla businesses';
  END IF;
END $$;

-- Agregar lng (longitud) si no existe
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'lng') THEN
    ALTER TABLE businesses ADD COLUMN lng FLOAT;
    RAISE NOTICE 'Columna lng agregada a la tabla businesses';
  ELSE
    RAISE NOTICE 'La columna lng ya existe en la tabla businesses';
  END IF;
END $$;

-- Verificar que las columnas se agregaron correctamente
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'businesses' 
  AND table_schema = 'public'
  AND column_name IN ('lat', 'lng')
ORDER BY column_name;
