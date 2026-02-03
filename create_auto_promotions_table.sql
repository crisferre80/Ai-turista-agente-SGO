-- Crear tabla para promociones automáticas
CREATE TABLE IF NOT EXISTS auto_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id VARCHAR(255), -- ID del negocio como string
    business_name VARCHAR(255), -- Nombre del negocio almacenado directamente
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    frequency_type VARCHAR(20) NOT NULL DEFAULT 'daily' CHECK (frequency_type IN ('hourly', 'daily', 'custom')),
    frequency_value INTEGER NOT NULL DEFAULT 1 CHECK (frequency_value > 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    start_time TIME,
    end_time TIME,
    days_of_week JSONB DEFAULT '[]'::jsonb, -- Array de números 0-6 (0=domingo)
    priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    last_executed TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Verificar y corregir el tipo de business_id si es necesario
DO $$
BEGIN
    -- Verificar si la columna existe y es de tipo UUID
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'auto_promotions' 
        AND column_name = 'business_id' 
        AND data_type = 'uuid'
    ) THEN
        -- Cambiar el tipo de UUID a VARCHAR
        ALTER TABLE auto_promotions ALTER COLUMN business_id TYPE VARCHAR(255) USING business_id::VARCHAR;
        RAISE NOTICE 'Cambiado business_id de UUID a VARCHAR(255)';
    END IF;
END $$;

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_auto_promotions_active ON auto_promotions(is_active);
CREATE INDEX IF NOT EXISTS idx_auto_promotions_priority ON auto_promotions(priority DESC);
CREATE INDEX IF NOT EXISTS idx_auto_promotions_frequency ON auto_promotions(frequency_type, frequency_value);
CREATE INDEX IF NOT EXISTS idx_auto_promotions_business ON auto_promotions(business_id);
CREATE INDEX IF NOT EXISTS idx_auto_promotions_last_executed ON auto_promotions(last_executed);
CREATE INDEX IF NOT EXISTS idx_auto_promotions_business_name ON auto_promotions(business_name);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_auto_promotions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS auto_promotions_updated_at ON auto_promotions;
CREATE TRIGGER auto_promotions_updated_at
    BEFORE UPDATE ON auto_promotions
    FOR EACH ROW
    EXECUTE PROCEDURE update_auto_promotions_updated_at();

-- Habilitar RLS (Row Level Security)
ALTER TABLE auto_promotions ENABLE ROW LEVEL SECURITY;

-- Política para que solo usuarios autenticados puedan acceder
CREATE POLICY "Auto promotions authenticated access" ON auto_promotions
    FOR ALL USING (auth.uid() IS NOT NULL);

-- Insertar algunas promociones de ejemplo
INSERT INTO auto_promotions (business_name, title, message, frequency_type, frequency_value, priority, is_active) 
VALUES 
    ('Restaurante El Buen Sabor', 'Promoción almuerzo', '¡Che! No te pierdas el menú del día en El Buen Sabor. ¡Tienen platos caseros buenísimos a precios increíbles!', 'daily', 2, 7, false),
    ('Hotel Plaza Santiago', 'Promoción hospedaje', '¿Buscás dónde quedarte? El Hotel Plaza Santiago tiene las mejores habitaciones del centro, ¡y con desayuno incluido!', 'daily', 1, 6, false),
    ('Café Central', 'Promoción merienda', 'Para una merienda perfecta, pasá por Café Central. ¡Tienen las mejores facturas y café de la ciudad!', 'daily', 3, 5, false)
ON CONFLICT DO NOTHING;

-- Ver las promociones creadas
SELECT 
    ap.*
FROM auto_promotions ap
ORDER BY ap.priority DESC, ap.created_at DESC;