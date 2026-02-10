-- Crear bucket para contenido AR
INSERT INTO storage.buckets (id, name, public)
VALUES ('ar-content', 'ar-content', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acceso para el bucket ar-content
-- Permitir lectura pública
CREATE POLICY "Public Access for AR Content"
ON storage.objects FOR SELECT
USING (bucket_id = 'ar-content');

-- Permitir subida solo a usuarios autenticados
CREATE POLICY "Authenticated users can upload AR content"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'ar-content' 
  AND auth.role() = 'authenticated'
);

-- Permitir actualización solo a usuarios autenticados
CREATE POLICY "Authenticated users can update AR content"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'ar-content' 
  AND auth.role() = 'authenticated'
);

-- Permitir eliminación solo a usuarios autenticados
CREATE POLICY "Authenticated users can delete AR content"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'ar-content' 
  AND auth.role() = 'authenticated'
);

-- Verificar que las columnas AR existan en la tabla attractions
DO $$ 
BEGIN
    -- Agregar columna has_ar_content si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='attractions' AND column_name='has_ar_content') THEN
        ALTER TABLE attractions ADD COLUMN has_ar_content BOOLEAN DEFAULT false;
    END IF;

    -- Agregar columna ar_model_url si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='attractions' AND column_name='ar_model_url') THEN
        ALTER TABLE attractions ADD COLUMN ar_model_url TEXT;
    END IF;

    -- Agregar columna ar_hotspots si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='attractions' AND column_name='ar_hotspots') THEN
        ALTER TABLE attractions ADD COLUMN ar_hotspots JSONB;
    END IF;

    -- Agregar columna qr_code si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='attractions' AND column_name='qr_code') THEN
        ALTER TABLE attractions ADD COLUMN qr_code TEXT UNIQUE;
    END IF;
END $$;

-- Crear índice para búsqueda rápida por QR code
CREATE INDEX IF NOT EXISTS idx_attractions_qr_code ON attractions(qr_code);
CREATE INDEX IF NOT EXISTS idx_attractions_ar_content ON attractions(has_ar_content) WHERE has_ar_content = true;

-- Comentarios en las columnas
COMMENT ON COLUMN attractions.has_ar_content IS 'Indica si el atractivo tiene contenido de realidad aumentada';
COMMENT ON COLUMN attractions.ar_model_url IS 'URL del modelo 3D en formato GLB o GLTF';
COMMENT ON COLUMN attractions.ar_hotspots IS 'JSON con configuración de hotspots AR (puntos de interés)';
COMMENT ON COLUMN attractions.qr_code IS 'Código QR único para identificar el atractivo al escanear';
