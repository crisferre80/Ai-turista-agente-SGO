-- SCRIPT DE MIGRACIÓN: Migrar datos de profiles y businesses a business_profiles

-- Paso 1: Crear la tabla si no existe
-- (Ejecutar create_business_profiles_table.sql primero)

-- Paso 1.5: Permitir NULL en email para migración
ALTER TABLE business_profiles ALTER COLUMN email DROP NOT NULL;

-- Paso 2: Migrar datos existentes
INSERT INTO business_profiles (
  auth_id, name, email, avatar_url, bio, role, created_at,
  description, website_url, contact_info, phone, address, category, plan,
  is_verified, is_active, gallery_images, payment_status, payment_method,
  mercadopago_id, subscription_end, lat, lng
)
SELECT
  p.id as auth_id,
  COALESCE(b.name, p.name) as name,
  NULL as email, -- Se actualizará después con datos de auth.users si es necesario
  p.avatar_url,
  NULL as bio,
  p.role,
  p.created_at,
  b.description,
  b.website_url,
  b.contact_info,
  b.phone,
  b.address,
  b.category,
  COALESCE(b.plan, 'basic') as plan,
  COALESCE(b.is_verified, false) as is_verified,
  COALESCE(b.is_active, false) as is_active,
  b.gallery_images,
  COALESCE(b.payment_status, 'pending') as payment_status,
  NULL as payment_method, -- No existe en businesses
  NULL as mercadopago_id, -- No existe en businesses
  NULL as subscription_end, -- Puede no existir en businesses
  b.lat,
  b.lng
FROM profiles p
LEFT JOIN businesses b ON b.owner_id = p.id
WHERE p.role = 'business'
AND NOT EXISTS (
  SELECT 1 FROM business_profiles bp WHERE bp.auth_id = p.id
);

-- Paso 3: Verificar la migración
SELECT
  'Migración completada' as status,
  COUNT(*) as registros_migrados
FROM business_profiles;

-- Paso 4: (Opcional) Actualizar payment_method y mercadopago_id desde payments
-- UPDATE business_profiles
-- SET payment_method = p.payment_method,
--     mercadopago_id = p.mercadopago_id
-- FROM payments p
-- WHERE business_profiles.id = p.business_id
-- AND p.status = 'approved'
-- AND business_profiles.payment_method IS NULL;

-- Paso 5: (Opcional) Actualizar emails desde auth.users si es necesario
UPDATE business_profiles
SET email = au.email
FROM auth.users au
WHERE business_profiles.auth_id = au.id
AND business_profiles.email IS NULL;

-- Paso 5.5: Insertar registro específico si no existe
INSERT INTO "public"."business_profiles" ("id", "auth_id", "name", "email", "avatar_url", "bio", "role", "created_at", "description", "website_url", "contact_info", "phone", "address", "category", "plan", "is_verified", "is_active", "gallery_images", "payment_status", "payment_method", "mercadopago_id", "subscription_end") VALUES ('010de02d-bafa-4cfa-a485-bf8e449e8b48', '04952214-20a0-4bcd-84c4-868b5a317c9a', 'Peluqueria LOLO', 'cristoferre80@gmail.com', null, null, 'business', '2026-01-28 03:31:36.150194+00', 'buen negocio y muy buenos cortes!!', 'https://peluquerialolo.com', null, '3856547897', 'Maipu 538', 'otro', 'pro', 'false', 'false', ARRAY[], 'pending', null, null, null) ON CONFLICT (id) DO NOTHING;

-- Paso 6: Restaurar NOT NULL en email
ALTER TABLE business_profiles ALTER COLUMN email SET NOT NULL;
-- DROP TABLE businesses;
-- DROP TABLE profiles; -- Solo si no hay otros roles usando profiles

-- Nota: Asegúrate de que todos los datos se hayan migrado correctamente antes de eliminar las tablas antiguas.