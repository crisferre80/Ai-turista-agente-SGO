-- ==========================================
-- AGREGAR COLUMNAS FALTANTES A LA TABLA BUSINESSES
-- Ejecuta este script PRIMERO en Supabase SQL Editor
-- ==========================================

-- 1. Agregar columna is_active (para activar/desactivar negocios)
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'businesses' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE businesses ADD COLUMN is_active BOOLEAN DEFAULT false;
    RAISE NOTICE '✅ Columna is_active agregada';
  ELSE
    RAISE NOTICE '⚠️ La columna is_active ya existe';
  END IF;
END $$;

-- 2. Agregar columna phone (teléfono del negocio)
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'businesses' AND column_name = 'phone'
  ) THEN
    ALTER TABLE businesses ADD COLUMN phone TEXT;
    RAISE NOTICE '✅ Columna phone agregada';
  ELSE
    RAISE NOTICE '⚠️ La columna phone ya existe';
  END IF;
END $$;

-- 3. Agregar columna address (dirección física)
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'businesses' AND column_name = 'address'
  ) THEN
    ALTER TABLE businesses ADD COLUMN address TEXT;
    RAISE NOTICE '✅ Columna address agregada';
  ELSE
    RAISE NOTICE '⚠️ La columna address ya existe';
  END IF;
END $$;

-- 4. Agregar columna description (descripción del negocio)
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'businesses' AND column_name = 'description'
  ) THEN
    ALTER TABLE businesses ADD COLUMN description TEXT;
    RAISE NOTICE '✅ Columna description agregada';
  ELSE
    RAISE NOTICE '⚠️ La columna description ya existe';
  END IF;
END $$;

-- 5. Verificar que todas las columnas se agregaron correctamente
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'businesses' 
  AND table_schema = 'public'
  AND column_name IN ('is_active', 'phone', 'address', 'description', 'lat', 'lng', 'gallery_images')
ORDER BY column_name;

-- 6. OPCIONAL: Activar todos los negocios existentes
-- Descomenta la siguiente línea si quieres activar todos los negocios actuales
-- UPDATE businesses SET is_active = true WHERE is_active IS NULL OR is_active = false;
