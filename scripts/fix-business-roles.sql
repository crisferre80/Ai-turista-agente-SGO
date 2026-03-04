-- ============================================
-- SCRIPT PARA ARREGLAR ROLES DE NEGOCIOS
-- ============================================
-- Este script corrige los perfiles que están en business_profiles
-- pero tienen role='tourist' en la tabla profiles

-- 1. Verificar el problema actual
SELECT 
    p.id,
    p.name,
    p.email,
    p.role as role_en_profiles,
    bp.id as business_profile_exists
FROM profiles p
LEFT JOIN business_profiles bp ON p.id = bp.auth_id
WHERE bp.auth_id IS NOT NULL
  AND p.role != 'business';

-- 2. Mostrar cuántos negocios tienen role incorrecto
SELECT 
    COUNT(*) as negocios_con_role_incorrecto
FROM profiles p
INNER JOIN business_profiles bp ON p.id = bp.auth_id
WHERE p.role != 'business';

-- 3. CORREGIR: Actualizar role a 'business' para todos los que están en business_profiles
UPDATE profiles p
SET role = 'business'
FROM business_profiles bp
WHERE p.id = bp.auth_id
  AND p.role != 'business';

-- 4. Verificar que se corrigió
SELECT 
    p.id,
    p.name,
    p.email,
    p.role as role_actualizado,
    bp.plan,
    bp.is_active
FROM profiles p
INNER JOIN business_profiles bp ON p.id = bp.auth_id
ORDER BY p.created_at DESC;

-- 5. Actualizar metadata de auth.users para que coincida
-- (Esto requiere privilegios en la tabla auth.users, ejecutar desde Supabase Dashboard)
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "business"}'::jsonb
WHERE id IN (
    SELECT bp.auth_id 
    FROM business_profiles bp
);

-- ============================================
-- RESUMEN DE LA ARQUITECTURA CORRECTA:
-- ============================================
-- 
-- TURISTAS:
--   - Se registran solo en 'profiles' con role='tourist'
--   - NO tienen entrada en 'business_profiles'
--
-- NEGOCIOS:
--   - Se registran en 'profiles' con role='business'
--   - SE DEBE crear entrada en 'business_profiles' con todos los datos del negocio
--   - 'businesses' es solo una VIEW de 'business_profiles'
--
-- LÓGICA DE REGISTRO (Frontend):
--   1. auth.signUp() con options.data.role='business'
--   2. Trigger automático crea perfil en 'profiles' con role='business'
--   3. Frontend actualiza 'profiles' con avatar y nombre
--   4. Frontend crea entrada en 'business_profiles'
--
-- LÓGICA DE LOGIN (Frontend):
--   1. Verificar si existe en 'business_profiles' → redirigir a /business/profile
--   2. Si no, verificar role en 'profiles' → redirigir según role
-- ============================================
