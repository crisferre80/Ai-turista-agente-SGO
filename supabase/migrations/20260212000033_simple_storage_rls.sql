-- SQL DIRECTO PARA CONFIGURAR RLS EN SUPABASE DASHBOARD
-- Copia y pega esto en el SQL Editor de Supabase

-- Habilitar RLS en storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ELIMINAR políticas existentes si las hay
DROP POLICY IF EXISTS "Public read access for all buckets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to all buckets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update all buckets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from all buckets" ON storage.objects;

-- Política de LECTURA PÚBLICA para TODOS los buckets (lo que permite ver desde panel admin)
CREATE POLICY "Public read access for all buckets" ON storage.objects
FOR SELECT USING (true);

-- Políticas de ESCRITURA AUTENTICADA (solo usuarios logueados pueden subir/editar/borrar)
CREATE POLICY "Authenticated users can upload to all buckets" ON storage.objects
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update all buckets" ON storage.objects
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete from all buckets" ON storage.objects
FOR DELETE USING (auth.role() = 'authenticated');

-- Asegurar que los buckets están marcados como públicos
UPDATE storage.buckets
SET public = true
WHERE id IN ('images', 'audios', 'email-images', 'ar-content');