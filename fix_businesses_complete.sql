-- Script completo para arreglar la tabla businesses
-- Ejecutar TODO este script de una vez en Supabase SQL Editor

-- 1. Agregar todas las columnas faltantes (si no existen)
DO $$ 
BEGIN
    -- Columna is_active (boolean)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE businesses ADD COLUMN is_active BOOLEAN DEFAULT true;
        RAISE NOTICE 'Columna is_active agregada';
    ELSE
        RAISE NOTICE 'Columna is_active ya existe';
    END IF;

    -- Columna phone (text)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' AND column_name = 'phone'
    ) THEN
        ALTER TABLE businesses ADD COLUMN phone TEXT;
        RAISE NOTICE 'Columna phone agregada';
    ELSE
        RAISE NOTICE 'Columna phone ya existe';
    END IF;

    -- Columna address (text)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' AND column_name = 'address'
    ) THEN
        ALTER TABLE businesses ADD COLUMN address TEXT;
        RAISE NOTICE 'Columna address agregada';
    ELSE
        RAISE NOTICE 'Columna address ya existe';
    END IF;

    -- Columna description (text)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' AND column_name = 'description'
    ) THEN
        ALTER TABLE businesses ADD COLUMN description TEXT;
        RAISE NOTICE 'Columna description agregada';
    ELSE
        RAISE NOTICE 'Columna description ya existe';
    END IF;

    -- Columna lat (double precision)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' AND column_name = 'lat'
    ) THEN
        ALTER TABLE businesses ADD COLUMN lat DOUBLE PRECISION;
        RAISE NOTICE 'Columna lat agregada';
    ELSE
        RAISE NOTICE 'Columna lat ya existe';
    END IF;

    -- Columna lng (double precision)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' AND column_name = 'lng'
    ) THEN
        ALTER TABLE businesses ADD COLUMN lng DOUBLE PRECISION;
        RAISE NOTICE 'Columna lng agregada';
    ELSE
        RAISE NOTICE 'Columna lng ya existe';
    END IF;

    -- Columna gallery_images (text array)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' AND column_name = 'gallery_images'
    ) THEN
        ALTER TABLE businesses ADD COLUMN gallery_images TEXT[];
        RAISE NOTICE 'Columna gallery_images agregada';
    ELSE
        RAISE NOTICE 'Columna gallery_images ya existe';
    END IF;

    -- Columna is_verified (boolean)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' AND column_name = 'is_verified'
    ) THEN
        ALTER TABLE businesses ADD COLUMN is_verified BOOLEAN DEFAULT false;
        RAISE NOTICE 'Columna is_verified agregada';
    ELSE
        RAISE NOTICE 'Columna is_verified ya existe';
    END IF;

    -- Columna payment_status (text)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' AND column_name = 'payment_status'
    ) THEN
        ALTER TABLE businesses ADD COLUMN payment_status TEXT;
        RAISE NOTICE 'Columna payment_status agregada';
    ELSE
        RAISE NOTICE 'Columna payment_status ya existe';
    END IF;

END $$;

-- 2. Eliminar registros existentes si los hay (para evitar duplicados)
DELETE FROM businesses WHERE name IN (
    'La Voz del Norte diario',
    'Heladería Limar',
    'Asura Santiago',
    'Capitán Club'
);

-- 3. Insertar los 4 negocios con sintaxis correcta (sin comillas en booleanos y números)
INSERT INTO businesses (
    id,
    owner_id,
    name,
    website_url,
    contact_info,
    category,
    is_verified,
    created_at,
    lat,
    lng,
    is_active,
    phone,
    address,
    description,
    gallery_images
) VALUES 
(
    '1779fbe2-97a3-4ace-a054-7220883463f7',
    '6b170434-fcce-4212-aa2f-108b18605e1f',
    'La Voz del Norte diario',
    'https://lavozdn.com.ar',
    'Contacto: 385-4000000',
    'cultura',
    true,
    '2026-01-22 18:25:17.073669+00',
    -27.7834,
    -64.2599,
    true,
    '385-4000000',
    'Av. Belgrano (S) 1912, Santiago del Estero',
    'Diario regional con más de 50 años de trayectoria en Santiago del Estero',
    ARRAY[]::TEXT[]
),
(
    '516b54e9-b403-400e-b027-4c0dc41d09b9',
    NULL,
    'Heladería Limar',
    'https://heladerialimar.com.ar/',
    'Helados artesanales, postres y tortas',
    'restaurante',
    true,
    '2026-01-15 04:40:45.81376+00',
    -27.7863148153177,
    -64.2586906602197,
    true,
    '3856987845',
    'Av. Belgrano, Santiago del Estero',
    'Heladería artesanal con más de 30 sabores únicos y productos de calidad premium',
    ARRAY['https://gcoptrxyfjmekdtxuqns.supabase.co/storage/v1/object/public/images/uploads/1768452050893-0547v.jpg']::TEXT[]
),
(
    '5cd27775-d56c-4539-b15e-e7522f7e4f31',
    '6d8299d8-99ae-4936-be0f-0b73038e05f7',
    'Asura Santiago',
    NULL,
    'Restaurante, bar y eventos',
    'restaurante',
    true,
    '2026-01-22 18:25:17.073669+00',
    -27.7825,
    -64.2605,
    true,
    NULL,
    'Centro de Santiago del Estero',
    'Restaurante y bar con ambiente moderno, cocina de autor y la mejor carta de tragos',
    ARRAY[]::TEXT[]
),
(
    '76b8d55b-ba29-4267-a747-dc77630d8085',
    NULL,
    'Capitán Club',
    NULL,
    'Club, restaurante y eventos sociales',
    'restaurante',
    true,
    '2026-01-21 02:48:42.335237+00',
    -27.7834,
    -64.2599,
    true,
    NULL,
    'Santiago del Estero Capital',
    'Club deportivo y social con restaurante, eventos y actividades recreativas',
    ARRAY['https://gcoptrxyfjmekdtxuqns.supabase.co/storage/v1/object/public/images/uploads/1768963719986-wdqth.jpg']::TEXT[]
);

-- 4. Verificar que se insertaron correctamente
SELECT 
    id,
    name,
    lat,
    lng,
    is_active,
    COALESCE(array_length(gallery_images, 1), 0) as num_images,
    phone,
    address
FROM businesses
WHERE name IN (
    'La Voz del Norte diario',
    'Heladería Limar',
    'Asura Santiago',
    'Capitán Club'
)
ORDER BY name;
