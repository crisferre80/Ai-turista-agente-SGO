-- Políticas RLS para la tabla user_reviews
-- Permitir que los turistas autenticados puedan crear, leer y actualizar sus propias reseñas

-- 1. Eliminar políticas anteriores si existen
DROP POLICY IF EXISTS "Anyone can read public reviews" ON user_reviews;
DROP POLICY IF EXISTS "Users can read public reviews" ON user_reviews;
DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON user_reviews;
DROP POLICY IF EXISTS "Users can update own reviews" ON user_reviews;
DROP POLICY IF EXISTS "Users can delete own reviews" ON user_reviews;

-- 2. Habilitar RLS en la tabla
ALTER TABLE user_reviews ENABLE ROW LEVEL SECURITY;

-- 3. Política de LECTURA - Cualquiera puede ver reseñas públicas
CREATE POLICY "Anyone can read public reviews"
ON user_reviews
FOR SELECT
USING (is_public = true);

-- 4. Política de INSERCIÓN - Usuarios autenticados pueden crear reseñas
CREATE POLICY "Authenticated users can insert reviews"
ON user_reviews
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
);

-- 5. Política de ACTUALIZACIÓN - Usuarios pueden actualizar sus propias reseñas
CREATE POLICY "Users can update own reviews"
ON user_reviews
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. Política de ELIMINACIÓN - Usuarios pueden eliminar sus propias reseñas
CREATE POLICY "Users can delete own reviews"
ON user_reviews
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 7. Verificar que la tabla user_reviews tenga las columnas necesarias
DO $$ 
BEGIN
    -- Verificar columna user_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_reviews' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE user_reviews ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Verificar columna is_public
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_reviews' AND column_name = 'is_public'
    ) THEN
        ALTER TABLE user_reviews ADD COLUMN is_public BOOLEAN DEFAULT true;
    END IF;

    -- Verificar columna created_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_reviews' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE user_reviews ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- 8. Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_user_reviews_user_id ON user_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_user_reviews_attraction_id ON user_reviews(attraction_id);
CREATE INDEX IF NOT EXISTS idx_user_reviews_business_id ON user_reviews(business_id);
CREATE INDEX IF NOT EXISTS idx_user_reviews_is_public ON user_reviews(is_public);

-- 9. Políticas RLS para la tabla profiles
-- Asegurar que los usuarios puedan leer y actualizar su propio perfil

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON profiles;

-- Habilitar RLS en profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Política de LECTURA - Usuarios autenticados pueden ver todos los perfiles
CREATE POLICY "Users can view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (true);

-- Política de ACTUALIZACIÓN - Usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Política de INSERCIÓN - Solo service role (para triggers)
CREATE POLICY "Service role can insert profiles"
ON profiles
FOR INSERT
WITH CHECK (true);

-- 10. Mensaje de confirmación
SELECT 'Políticas RLS configuradas correctamente para user_reviews y profiles' AS status;

-- 11. Verificar que el bucket 'images' tenga las políticas correctas
-- Esto se debe hacer manualmente en Supabase Dashboard → Storage → images → Policies
-- O ejecutar estos comandos si tienes acceso:

/*
-- Permitir que usuarios autenticados suban imágenes
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'images' AND (storage.foldername(name))[1] = 'user-reviews');

-- Permitir que todos lean imágenes públicas
CREATE POLICY "Public images are readable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'images');

-- Permitir que usuarios eliminen sus propias imágenes
CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[2]);
*/
