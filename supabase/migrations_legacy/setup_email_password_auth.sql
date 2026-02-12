-- Script para habilitar autenticación tradicional con email y contraseña
-- Esto permite persistencia de sesión sin necesidad de magic links cada vez

-- 1. Verificar que la autenticación por email/password esté habilitada
-- Esto se hace desde el dashboard de Supabase:
-- Authentication > Providers > Email (debe estar habilitado)

-- 2. Configurar políticas de autenticación
-- Las sesiones persisten por defecto en localStorage con Supabase

-- 3. Configurar tiempo de expiración de sesiones (opcional)
-- Por defecto: 1 hora (3600 segundos)
-- Esto se configura en: Authentication > Settings
-- - JWT Expiry: 3600 (1 hora)
-- - Refresh Token Lifetime: 604800 (7 días)

-- 4. Verificar que RLS esté habilitado en profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 5. Asegurar que existan las políticas básicas
-- Política de lectura pública
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
CREATE POLICY "Profiles are viewable by everyone" 
ON profiles FOR SELECT 
TO authenticated 
USING (true);

-- Política de inserción (solo para el propio usuario)
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" 
ON profiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- Política de actualización (solo para el propio usuario)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Política de eliminación (solo para el propio usuario)
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;
CREATE POLICY "Users can delete own profile" 
ON profiles FOR DELETE 
TO authenticated 
USING (auth.uid() = id);

-- 6. Verificar las políticas creadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles';

-- NOTA IMPORTANTE:
-- Para cambiar de Magic Links a Email/Password tradicional, 
-- necesitas modificar el código del frontend en:
-- - src/app/login/page.tsx
-- Cambiar de signInWithOtp() a signInWithPassword() y signUp()
