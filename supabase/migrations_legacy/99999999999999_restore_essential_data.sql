-- ==========================================
-- SCRIPT DE RECUPERACIÓN DE DATOS
-- Ejecutar después de db reset para restaurar información esencial
-- ==========================================

-- 1. CONFIGURAR ADMIN
-- ==========================================
-- Configurar admin@cristian.com como admin completo
UPDATE auth.users
SET email_confirmed_at = NOW(),
    raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'admin@cristian.com';

INSERT INTO profiles (id, name, role, created_at, updated_at)
SELECT
    id,
    'Admin Cristian',
    'admin',
    NOW(),
    NOW()
FROM auth.users
WHERE email = 'admin@cristian.com'
ON CONFLICT (id) DO UPDATE
SET role = 'admin',
    updated_at = NOW();

-- 2. INSERTAR NEGOCIOS
-- ==========================================
INSERT INTO "public"."businesses" ("id", "owner_id", "name", "website_url", "contact_info", "category", "is_verified", "created_at", "image_url", "lat", "lng", "is_active", "phone", "address", "description") VALUES
('516b54e9-b403-400e-b027-4c0dc41d09b9', null, 'Heladería Limar', 'https://heladerialimar.com.ar/', '3856987845', 'restaurante', false, '2026-01-15 04:40:45.81376+00', 'https://gcoptrxyfjmekdtxuqns.supabase.co/storage/v1/object/public/images/uploads/1768452050893-0547v.jpg', '-27.7863148153177', '-64.2586906602197', true, '3856987845', 'Santiago del Estero', 'Heladería tradicional con helados artesanales'),
('76b8d55b-ba29-4267-a747-dc77630d8085', null, 'Capitán Club', '', '', 'restaurante', false, '2026-01-21 02:48:42.335237+00', 'https://gcoptrxyfjmekdtxuqns.supabase.co/storage/v1/object/public/images/uploads/1768963719986-wdqth.jpg', '-27.7834', '-64.2599', true, '', 'Centro', 'Club nocturno y restaurante')
ON CONFLICT (id) DO NOTHING;

-- 3. INSERTAR ATRACTIVOS TURÍSTICOS CON AR
-- ==========================================
-- Catedral con contenido AR
INSERT INTO attractions (id, name, description, lat, lng, image_url, category, has_ar_content, ar_model_url, ar_hotspots, qr_code, created_at) VALUES
('catedral-sgo-001', 'Catedral Basílica de Santiago del Estero', 'La Basílica Catedral de Santiago del Estero es el templo principal de la ciudad y uno de los más antiguos de Argentina.', -27.7834, -64.2599, 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1768455560/istockphoto-1063378272-612x612_vby7gq.jpg', 'histórico', true, 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF/DamagedHelmet.gltf', '{
  "hotspots": [
    {
      "id": "info-1",
      "type": "info",
      "position": {"x": 0, "y": 1.5, "z": -2},
      "title": "Historia de la Catedral",
      "description": "La Basílica Catedral de Santiago del Estero es el templo principal de la ciudad y uno de los más antiguos de Argentina. Fue construida entre 1867 y 1877.",
      "content_url": "https://res.cloudinary.com/dhvrrxejo/image/upload/v1768455560/istockphoto-1063378272-612x612_vby7gq.jpg"
    },
    {
      "id": "info-2",
      "type": "info",
      "position": {"x": 2, "y": 1, "z": -3},
      "title": "Arquitectura",
      "description": "El templo presenta un estilo neoclásico italiano con influencias románicas. Su fachada cuenta con dos torres simétricas y un atrio con columnas.",
      "rotation": {"x": 0, "y": 45, "z": 0}
    }
  ],
  "primitives": [],
  "modelTransform": {
    "position": {"x": 0, "y": 0, "z": 0},
    "rotation": {"x": 0, "y": 0, "z": 0},
    "scale": {"x": 1, "y": 1, "z": 1}
  }
}'::jsonb, 'ATR-CATEDRAL-SGO-001', NOW())
ON CONFLICT (id) DO NOTHING;

-- 4. CONFIGURAR PLANES DE SUSCRIPCIÓN
-- ==========================================
INSERT INTO plans (id, name, description, price, features, is_active, created_at) VALUES
('free', 'Plan Gratuito', 'Plan básico para explorar la app', 0, '["Acceso básico", "Hasta 5 reseñas", "Mapas básicos"]'::jsonb, true, NOW()),
('premium', 'Plan Premium', 'Plan completo con todas las funciones', 999, '["Acceso completo", "Reseñas ilimitadas", "AR avanzado", "Soporte prioritario"]'::jsonb, true, NOW())
ON CONFLICT (id) DO NOTHING;

-- 5. CONFIGURAR CATEGORÍAS
-- ==========================================
INSERT INTO categories (id, name, description, icon, color, is_active) VALUES
('historico', 'Histórico', 'Sitios históricos y monumentos', '🏛️', '#8B4513', true),
('naturaleza', 'Naturaleza', 'Parques, reservas y espacios naturales', '🌳', '#228B22', true),
('restaurante', 'Restaurantes', 'Lugares para comer y beber', '🍽️', '#FF6347', true),
('compras', 'Compras', 'Centros comerciales y tiendas', '🛍️', '#9370DB', true),
('cultura', 'Cultura', 'Museos, teatros y eventos culturales', '🎭', '#DAA520', true)
ON CONFLICT (id) DO NOTHING;

-- 6. VERIFICACIÓN FINAL
-- ==========================================
SELECT
    'Admin configurado:' as check_type,
    COUNT(*) as count
FROM profiles
WHERE role = 'admin'
UNION ALL
SELECT
    'Negocios insertados:',
    COUNT(*)
FROM businesses
UNION ALL
SELECT
    'Atractivos con AR:',
    COUNT(*)
FROM attractions
WHERE has_ar_content = true
UNION ALL
SELECT
    'Planes activos:',
    COUNT(*)
FROM plans
WHERE is_active = true
UNION ALL
SELECT
    'Categorías activas:',
    COUNT(*)
FROM categories
WHERE is_active = true;