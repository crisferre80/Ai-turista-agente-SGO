-- Configurar admin@cristian.com como admin completo
-- Este script crea el perfil si no existe y lo convierte en admin

-- Paso 1: Confirmar email y marcar como admin en auth.users
UPDATE auth.users 
SET email_confirmed_at = NOW(),
    raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'admin@cristian.com';

-- Paso 2: Crear el perfil en la tabla profiles (INSERT si no existe)
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

-- Verificar que todo funcionó
SELECT 
    u.id,
    u.email,
    u.email_confirmed_at,
    u.confirmed_at,
    u.raw_user_meta_data->>'role' as metadata_role,
    p.name,
    p.role as profile_role,
    CASE 
        WHEN p.role = 'admin' AND u.email_confirmed_at IS NOT NULL 
        THEN '✅ OK - Listo para usar'
        ELSE '❌ Error - Revisar configuración'
    END as status
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE u.email = 'admin@cristian.com';
