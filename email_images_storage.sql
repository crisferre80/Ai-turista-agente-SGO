-- Crear bucket para imágenes de email
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-images', 'email-images', true);

-- Políticas para el bucket de imágenes de email
CREATE POLICY "Email images are publicly accessible" ON storage.objects
FOR SELECT USING (bucket_id = 'email-images');

CREATE POLICY "Users can upload email images" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'email-images');

CREATE POLICY "Users can update their email images" ON storage.objects
FOR UPDATE USING (bucket_id = 'email-images');

CREATE POLICY "Users can delete their email images" ON storage.objects
FOR DELETE USING (bucket_id = 'email-images');