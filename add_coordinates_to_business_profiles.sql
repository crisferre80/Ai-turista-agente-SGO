-- Script para agregar columnas de coordenadas a business_profiles
-- Ejecutar en Supabase SQL Editor

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

-- Verificar las columnas de business_profiles
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'business_profiles'
ORDER BY ordinal_position;

-- Opcional: Si tienes datos en la tabla 'businesses' con coordenadas,
-- puedes migrarlos a business_profiles basándote en algún campo común
-- (descomenta si necesitas migrar datos existentes)
/*
UPDATE business_profiles bp
SET 
    lat = b.lat,
    lng = b.lng
FROM businesses b
WHERE bp.name = b.name
  AND bp.lat IS NULL
  AND b.lat IS NOT NULL;
*/
