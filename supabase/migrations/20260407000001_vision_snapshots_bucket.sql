-- Crear bucket para almacenar snapshots de análisis de visión
-- NOTA: El bucket debe crearse manualmente en Supabase Dashboard -> Storage
-- Configuración del bucket:
--   - Name: vision-snapshots
--   - Public: true
--   - Allowed MIME types: image/jpeg, image/png
--   - Max file size: 5MB

-- Si ya existe el bucket, las políticas se aplicarán automáticamente
-- Si no existe, crear manualmente antes de ejecutar las políticas

-- Verificar si el bucket existe (solo para información)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'vision-snapshots') THEN
    RAISE NOTICE 'El bucket "vision-snapshots" no existe. Créalo manualmente en Supabase Dashboard -> Storage';
  END IF;
END $$;

-- Políticas de seguridad para el bucket
-- Solo admins pueden subir imágenes
DROP POLICY IF EXISTS "Admins can upload vision snapshots" ON storage.objects;
CREATE POLICY "Admins can upload vision snapshots"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vision-snapshots' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Todos pueden ver las imágenes (bucket público)
DROP POLICY IF EXISTS "Anyone can view vision snapshots" ON storage.objects;
CREATE POLICY "Anyone can view vision snapshots"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'vision-snapshots');

-- Admins pueden eliminar snapshots viejos
DROP POLICY IF EXISTS "Admins can delete vision snapshots" ON storage.objects;
CREATE POLICY "Admins can delete vision snapshots"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vision-snapshots' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- INSTRUCCIONES PARA CREAR EL BUCKET MANUALMENTE:
-- 1. Ve a Supabase Dashboard -> Storage
-- 2. Click en "New bucket"
-- 3. Configura:
--    - Name: vision-snapshots
--    - Public bucket: Activado (checked)
--    - File size limit: 5 MB
--    - Allowed MIME types: image/jpeg, image/png, image/webp
-- 4. Las políticas de arriba se aplicarán automáticamente
