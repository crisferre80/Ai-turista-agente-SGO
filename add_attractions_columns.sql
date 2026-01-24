-- Script para agregar columnas faltantes a la tabla attractions
-- Ejecutar en Supabase SQL Editor

-- Agregar gallery_urls y video_urls si no existen
DO $$
BEGIN
    -- Columna gallery_urls (text array)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'attractions' AND column_name = 'gallery_urls'
    ) THEN
        ALTER TABLE attractions ADD COLUMN gallery_urls TEXT[];
        RAISE NOTICE 'Columna gallery_urls agregada a attractions';
    ELSE
        RAISE NOTICE 'Columna gallery_urls ya existe en attractions';
    END IF;

    -- Columna video_urls (text array)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'attractions' AND column_name = 'video_urls'
    ) THEN
        ALTER TABLE attractions ADD COLUMN video_urls TEXT[];
        RAISE NOTICE 'Columna video_urls agregada a attractions';
    ELSE
        RAISE NOTICE 'Columna video_urls ya existe en attractions';
    END IF;
END $$;

-- Verificar las columnas de la tabla attractions
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'attractions'
ORDER BY ordinal_position;