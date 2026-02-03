-- Script de migración para corregir el tipo de business_id
-- Ejecuta solo este archivo si ya tienes la tabla auto_promotions creada

-- Verificar y corregir el tipo de business_id
DO $$
BEGIN
    -- Verificar si la tabla existe
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'auto_promotions') THEN
        -- Verificar si la columna business_id es de tipo UUID
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'auto_promotions' 
            AND column_name = 'business_id' 
            AND data_type = 'uuid'
        ) THEN
            -- Cambiar el tipo de UUID a VARCHAR
            ALTER TABLE auto_promotions ALTER COLUMN business_id TYPE VARCHAR(255) USING business_id::VARCHAR;
            RAISE NOTICE 'business_id cambiado exitosamente de UUID a VARCHAR(255)';
        ELSE
            RAISE NOTICE 'business_id ya es VARCHAR o no existe';
        END IF;
    ELSE
        RAISE NOTICE 'La tabla auto_promotions no existe. Ejecuta primero create_auto_promotions_table.sql';
    END IF;
END $$;

-- Verificar el resultado
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'auto_promotions' 
AND column_name = 'business_id';