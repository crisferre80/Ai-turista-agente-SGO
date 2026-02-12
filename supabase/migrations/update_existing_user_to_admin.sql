-- Actualizar usuario existente a admin
-- Script que elimina trigger problemático

-- Paso 1: Eliminar el trigger problemático que busca tabla 'businesses'
DROP TRIGGER IF EXISTS handle_business_profile_trigger ON profiles;
DROP FUNCTION IF EXISTS handle_business_profile() CASCADE;

-- Paso 2: Actualizar auth.users
UPDATE auth.users 
SET email_confirmed_at = NOW(),
    raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'cristianferreyra8076@gmail.com';

-- Paso 3: Actualizar perfil a admin directamente
UPDATE profiles 
SET role = 'admin' 
WHERE id = '5884ca0b-593a-483f-919e-589fafe8d94a';

-- Verificar que todo funcionó
SELECT 
    u.id,
    u.email,
    u.email_confirmed_at,
    u.raw_user_meta_data->>'role' as metadata_role,
    p.name,
    p.role as profile_role,
    'OK - Usuario es admin ahora' as status
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE u.email = 'cristianferreyra8076@gmail.com';
