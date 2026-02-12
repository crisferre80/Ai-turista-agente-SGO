-- ==========================================
-- SCRIPT COMPLETO: AGREGAR COLUMNAS E INSERTAR NEGOCIOS
-- Ejecuta este script completo en Supabase SQL Editor
-- ==========================================

-- PASO 1: AGREGAR COLUMNAS FALTANTES
-- ==========================================

-- Agregar columna is_active
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'is_active') THEN
    ALTER TABLE businesses ADD COLUMN is_active BOOLEAN DEFAULT false;
    RAISE NOTICE '✅ Columna is_active agregada';
  ELSE
    RAISE NOTICE '⚠️ La columna is_active ya existe';
  END IF;
END $$;

-- Agregar columna phone
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'phone') THEN
    ALTER TABLE businesses ADD COLUMN phone TEXT;
    RAISE NOTICE '✅ Columna phone agregada';
  ELSE
    RAISE NOTICE '⚠️ La columna phone ya existe';
  END IF;
END $$;

-- Agregar columna address
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'address') THEN
    ALTER TABLE businesses ADD COLUMN address TEXT;
    RAISE NOTICE '✅ Columna address agregada';
  ELSE
    RAISE NOTICE '⚠️ La columna address ya existe';
  END IF;
END $$;

-- Agregar columna description
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'description') THEN
    ALTER TABLE businesses ADD COLUMN description TEXT;
    RAISE NOTICE '✅ Columna description agregada';
  ELSE
    RAISE NOTICE '⚠️ La columna description ya existe';
  END IF;
END $$;

-- Agregar columna lat
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'lat') THEN
    ALTER TABLE businesses ADD COLUMN lat FLOAT;
    RAISE NOTICE '✅ Columna lat agregada';
  ELSE
    RAISE NOTICE '⚠️ La columna lat ya existe';
  END IF;
END $$;

-- Agregar columna lng
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'lng') THEN
    ALTER TABLE businesses ADD COLUMN lng FLOAT;
    RAISE NOTICE '✅ Columna lng agregada';
  ELSE
    RAISE NOTICE '⚠️ La columna lng ya existe';
  END IF;
END $$;

-- Agregar columna gallery_images (array de URLs)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'gallery_images') THEN
    ALTER TABLE businesses ADD COLUMN gallery_images TEXT[];
    RAISE NOTICE '✅ Columna gallery_images agregada';
  ELSE
    RAISE NOTICE '⚠️ La columna gallery_images ya existe';
  END IF;
END $$;

-- PASO 2: INSERTAR NEGOCIOS
-- ==========================================

-- Eliminar los registros anteriores si existen (opcional)
DELETE FROM businesses WHERE id IN (
    '1779fbe2-97a3-4ace-a054-7220883463f7',
    '516b54e9-b403-400e-b027-4c0dc41d09b9',
    '5cd27775-d56c-4539-b15e-e7522f7e4f31',
    '76b8d55b-ba29-4267-a747-dc77630d8085'
);

-- Insertar negocios con el schema completo
INSERT INTO "public"."businesses" (
    "id", 
    "owner_id", 
    "name",
    "description",
    "website_url", 
    "contact_info",
    "phone",
    "address",
    "category", 
    "is_verified",
    "is_active",
    "created_at", 
    "gallery_images",
    "lat", 
    "lng"
) VALUES 
-- 1. La Voz del Norte diario (Diario/Periódico)
(
    '1779fbe2-97a3-4ace-a054-7220883463f7', 
    '6b170434-fcce-4212-aa2f-108b18605e1f', 
    'La Voz del Norte diario',
    'Diario regional con más de 50 años de trayectoria en Santiago del Estero',
    'https://lavozdn.com.ar', 
    'Contacto: 385-4000000',
    '385-4000000',
    'Av. Belgrano (S) 1912, Santiago del Estero',
    'cultura', 
    true,
    true,
    '2026-01-22 18:25:17.073669+00', 
    ARRAY[]::text[],
    -27.7834,
    -64.2599
),

-- 2. Heladería Limar (Ya tiene coordenadas e imagen)
(
    '516b54e9-b403-400e-b027-4c0dc41d09b9', 
    null, 
    'Heladería Limar',
    'Heladería artesanal con más de 30 sabores únicos y productos de calidad premium',
    'https://heladerialimar.com.ar/', 
    'Helados artesanales, postres y tortas',
    '3856987845',
    'Av. Belgrano, Santiago del Estero',
    'restaurante', 
    true,
    true,
    '2026-01-15 04:40:45.81376+00', 
    ARRAY['https://gcoptrxyfjmekdtxuqns.supabase.co/storage/v1/object/public/images/uploads/1768452050893-0547v.jpg']::text[],
    -27.7863148153177,
    -64.2586906602197
),

-- 3. Asura Santiago (Restaurante/Bar)
(
    '5cd27775-d56c-4539-b15e-e7522f7e4f31', 
    '6d8299d8-99ae-4936-be0f-0b73038e05f7', 
    'Asura Santiago',
    'Restaurante y bar con ambiente moderno, cocina de autor y la mejor carta de tragos',
    null, 
    'Restaurante, bar y eventos',
    null,
    'Centro de Santiago del Estero',
    'restaurante', 
    true,
    true,
    '2026-01-22 18:25:17.073669+00', 
    ARRAY[]::text[],
    -27.7825,
    -64.2605
),

-- 4. Capitán Club (Ya tiene coordenadas e imagen)
(
    '76b8d55b-ba29-4267-a747-dc77630d8085', 
    null, 
    'Capitán Club',
    'Club deportivo y social con restaurante, eventos y actividades recreativas',
    null, 
    'Club, restaurante y eventos sociales',
    null,
    'Santiago del Estero Capital',
    'restaurante', 
    true,
    true,
    '2026-01-21 02:48:42.335237+00', 
    ARRAY['https://gcoptrxyfjmekdtxuqns.supabase.co/storage/v1/object/public/images/uploads/1768963719986-wdqth.jpg']::text[],
    -27.7834,
    -64.2599
);

-- Verificar que se insertaron correctamente con todas las columnas
SELECT 
    id,
    name,
    description,
    phone,
    address,
    category,
    lat,
    lng,
    is_active,
    is_verified,
    array_length(gallery_images, 1) as num_images
FROM businesses 
WHERE id IN (
    '1779fbe2-97a3-4ace-a054-7220883463f7',
    '516b54e9-b403-400e-b027-4c0dc41d09b9',
    '5cd27775-d56c-4539-b15e-e7522f7e4f31',
    '76b8d55b-ba29-4267-a747-dc77630d8085'
)
ORDER BY name;
