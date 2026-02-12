-- SQL para configurar RLS en storage.objects
-- Ejecutar en Supabase Dashboard o via psql

-- 1) Habilitar RLS en storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 2) Eliminar políticas existentes si las hay (nombres seguros)
DROP POLICY IF EXISTS "Public read access for all buckets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to all buckets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update all buckets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from all buckets" ON storage.objects;

-- 3) Política de LECTURA PÚBLICA para TODOS los buckets
CREATE POLICY "Public read access for all buckets" ON storage.objects
FOR SELECT USING (true);

-- 4) Políticas de ESCRITURA: solo usuarios autenticados (auth.uid() IS NOT NULL)
CREATE POLICY "Authenticated users can upload to all buckets" ON storage.objects
FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can update all buckets" ON storage.objects
FOR UPDATE USING ((SELECT auth.uid()) IS NOT NULL)
WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can delete from all buckets" ON storage.objects
FOR DELETE USING ((SELECT auth.uid()) IS NOT NULL);