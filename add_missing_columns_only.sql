-- Script simplificado: SOLO agregar columnas faltantes a la tabla businesses
-- Ejecutar en Supabase SQL Editor

-- Agregar lat y lng si no existen
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='businesses' AND column_name='lat') THEN
        ALTER TABLE businesses ADD COLUMN lat FLOAT;
        RAISE NOTICE 'Columna lat agregada';
    ELSE
        RAISE NOTICE 'Columna lat ya existe';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='businesses' AND column_name='lng') THEN
        ALTER TABLE businesses ADD COLUMN lng FLOAT;
        RAISE NOTICE 'Columna lng agregada';
    ELSE
        RAISE NOTICE 'Columna lng ya existe';
    END IF;
END $$;

-- Verificar qué columnas tiene ahora la tabla
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'businesses'
ORDER BY ordinal_position;
