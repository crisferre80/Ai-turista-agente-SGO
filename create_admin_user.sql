-- Crear usuario admin real en Supabase Auth
-- REEMPLAZA 'tu_email_admin@gmail.com' con tu email real
-- REEMPLAZA 'tu_contraseña_segura' con una contraseña fuerte

-- Paso 1: Crear el usuario en auth.users (esto lo hace Supabase automáticamente cuando usas signUp)
-- Paso 2: Marcar el email como confirmado
-- Paso 3: Crear el perfil con role 'admin'

-- IMPORTANTE: Este script es solo de referencia.
-- Para crear el admin, ejecuta estos pasos:

-- OPCIÓN 1: Desde la app (Recomendado)
-- 1. En el login, ingresa tu email: admin@miapp.com
-- 2. Contraseña: (tu contraseña segura)
-- 3. Click en "Registrate como Negocio"
-- 4. Una vez creada la cuenta, ejecuta este SQL para hacerla admin:

UPDATE auth.users 
SET email_confirmed_at = NOW(),
    raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'cristianferreyra8076@gmail.com'; -- REEMPLAZA con tu email

-- Crear o actualizar perfil con role admin
INSERT INTO profiles (id, name, role)
SELECT id, 'Admin', 'admin' 
FROM auth.users 
WHERE email = 'cristianferreyra8076@gmail.com' -- REEMPLAZA con tu email
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- Verificar que el admin fue creado
SELECT 
    u.id,
    u.email,
    u.email_confirmed_at,
    u.raw_user_meta_data->>'role' as metadata_role,
    p.role as profile_role,
    p.name
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE u.email = 'admin@miapp.com'; -- REEMPLAZA con tu email
