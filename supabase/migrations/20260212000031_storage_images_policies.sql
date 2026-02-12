-- Políticas de Storage para bucket 'images' - permitir lectura pública y escritura autenticada

-- Habilitar RLS en storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura pública de imágenes (GET)

CREATE POLICY "Public read access for images bucket" ON storage.objects
FOR SELECT USING (bucket_id = 'images');

-- Política para permitir subida autenticada (INSERT)
CREATE POLICY "Authenticated users can upload to images bucket" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'images'
  AND auth.role() = 'authenticated'
);

-- Política para permitir actualización autenticada (UPDATE)
CREATE POLICY "Authenticated users can update images bucket" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'images'
  AND auth.role() = 'authenticated'
);

-- Política para permitir borrado autenticado (DELETE)
CREATE POLICY "Authenticated users can delete from images bucket" ON storage.objects
FOR DELETE USING (
  bucket_id = 'images'
  AND auth.role() = 'authenticated'
);

-- Verificar que el bucket 'images' existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO UPDATE SET public = true;