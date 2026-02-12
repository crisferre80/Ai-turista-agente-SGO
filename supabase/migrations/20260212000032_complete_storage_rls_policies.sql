-- Políticas RLS completas para todos los buckets de Storage
-- Permite lectura pública y escritura autenticada desde el panel de administración

-- Habilitar RLS en storage.objects si no está habilitado
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- POLÍTICAS PARA TODOS LOS BUCKETS
-- ===========================================

-- Política de lectura pública para todos los buckets
CREATE POLICY "Public read access for all buckets" ON storage.objects
FOR SELECT USING (true);

-- Política de subida autenticada para todos los buckets
CREATE POLICY "Authenticated users can upload to all buckets" ON storage.objects
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Política de actualización autenticada para todos los buckets
CREATE POLICY "Authenticated users can update all buckets" ON storage.objects
FOR UPDATE USING (auth.role() = 'authenticated');

-- Política de borrado autenticado para todos los buckets
CREATE POLICY "Authenticated users can delete from all buckets" ON storage.objects
FOR DELETE USING (auth.role() = 'authenticated');

-- ===========================================
-- POLÍTICAS ESPECÍFICAS POR BUCKET (si se necesitan más restrictivas)
-- ===========================================

-- Políticas específicas para bucket 'images'
DROP POLICY IF EXISTS "Public read access for images bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to images bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update images bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from images bucket" ON storage.objects;

CREATE POLICY "Public read access for images bucket" ON storage.objects
FOR SELECT USING (bucket_id = 'images');

CREATE POLICY "Authenticated users can upload to images bucket" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update images bucket" ON storage.objects
FOR UPDATE USING (bucket_id = 'images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete from images bucket" ON storage.objects
FOR DELETE USING (bucket_id = 'images' AND auth.role() = 'authenticated');

-- Políticas específicas para bucket 'audios'
DROP POLICY IF EXISTS "Public read access for audios bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to audios bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update audios bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from audios bucket" ON storage.objects;

CREATE POLICY "Public read access for audios bucket" ON storage.objects
FOR SELECT USING (bucket_id = 'audios');

CREATE POLICY "Authenticated users can upload to audios bucket" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'audios' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update audios bucket" ON storage.objects
FOR UPDATE USING (bucket_id = 'audios' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete from audios bucket" ON storage.objects
FOR DELETE USING (bucket_id = 'audios' AND auth.role() = 'authenticated');

-- Políticas específicas para bucket 'email-images'
DROP POLICY IF EXISTS "Public read access for email-images bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to email-images bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update email-images bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from email-images bucket" ON storage.objects;

CREATE POLICY "Public read access for email-images bucket" ON storage.objects
FOR SELECT USING (bucket_id = 'email-images');

CREATE POLICY "Authenticated users can upload to email-images bucket" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'email-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update email-images bucket" ON storage.objects
FOR UPDATE USING (bucket_id = 'email-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete from email-images bucket" ON storage.objects
FOR DELETE USING (bucket_id = 'email-images' AND auth.role() = 'authenticated');

-- Políticas específicas para bucket 'ar-content'
DROP POLICY IF EXISTS "Public read access for ar-content bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to ar-content bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update ar-content bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from ar-content bucket" ON storage.objects;

CREATE POLICY "Public read access for ar-content bucket" ON storage.objects
FOR SELECT USING (bucket_id = 'ar-content');

CREATE POLICY "Authenticated users can upload to ar-content bucket" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'ar-content' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update ar-content bucket" ON storage.objects
FOR UPDATE USING (bucket_id = 'ar-content' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete from ar-content bucket" ON storage.objects
FOR DELETE USING (bucket_id = 'ar-content' AND auth.role() = 'authenticated');

-- ===========================================
-- VERIFICACIÓN DE BUCKETS
-- ===========================================

-- Asegurar que los buckets existen y están marcados como públicos
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('images', 'images', true),
  ('audios', 'audios', true),
  ('email-images', 'email-images', true),
  ('ar-content', 'ar-content', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ===========================================
-- MENSAJE DE CONFIRMACIÓN
-- ===========================================

-- Este SQL configura políticas RLS que permiten:
-- ✅ Lectura pública de todos los buckets (visible desde panel admin)
-- ✅ Escritura solo para usuarios autenticados
-- ✅ Gestión completa desde la interfaz de administración