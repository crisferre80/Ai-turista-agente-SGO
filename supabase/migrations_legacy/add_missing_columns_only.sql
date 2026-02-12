-- Script simplificado: SOLO agregar columnas faltantes a las tablas businesses y business_profiles
-- Ejecutar en Supabase SQL Editor

-- ====================
-- TABLA: businesses
-- ====================

-- Agregar lat y lng si no existen
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='businesses' AND column_name='lat') THEN
        ALTER TABLE businesses ADD COLUMN lat FLOAT;
        RAISE NOTICE 'Columna lat agregada a businesses';
    ELSE
        RAISE NOTICE 'Columna lat ya existe en businesses';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='businesses' AND column_name='lng') THEN
        ALTER TABLE businesses ADD COLUMN lng FLOAT;
        RAISE NOTICE 'Columna lng agregada a businesses';
    ELSE
        RAISE NOTICE 'Columna lng ya existe en businesses';
    END IF;
END $$;

-- ====================
-- TABLA: business_profiles
-- ====================

-- Agregar lat y lng a business_profiles si no existen
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_profiles' AND column_name='lat') THEN
        ALTER TABLE business_profiles ADD COLUMN lat FLOAT;
        RAISE NOTICE 'Columna lat agregada a business_profiles';
    ELSE
        RAISE NOTICE 'Columna lat ya existe en business_profiles';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_profiles' AND column_name='lng') THEN
        ALTER TABLE business_profiles ADD COLUMN lng FLOAT;
        RAISE NOTICE 'Columna lng agregada a business_profiles';
    ELSE
        RAISE NOTICE 'Columna lng ya existe en business_profiles';
    END IF;
END $$;

-- ====================
-- VERIFICACIÓN
-- ====================

-- Verificar qué columnas tiene ahora la tabla businesses
SELECT 'businesses' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'businesses'
ORDER BY ordinal_position;

-- Verificar qué columnas tiene ahora la tabla business_profiles
SELECT 'business_profiles' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'business_profiles'
ORDER BY ordinal_position;
