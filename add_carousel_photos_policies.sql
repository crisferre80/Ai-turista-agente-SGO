-- Limpiar políticas existentes y crear nuevas
DROP POLICY IF EXISTS "Carousel photos select" ON carousel_photos;
DROP POLICY IF EXISTS "Carousel photos insert" ON carousel_photos;
DROP POLICY IF EXISTS "Carousel photos update" ON carousel_photos;
DROP POLICY IF EXISTS "Carousel photos delete" ON carousel_photos;
DROP POLICY IF EXISTS "Solo admins pueden gestionar carrusel" ON carousel_photos;
DROP POLICY IF EXISTS "Todos pueden ver fotos activas del carrusel" ON carousel_photos;
DROP POLICY IF EXISTS "Carousel photos public view" ON carousel_photos;

-- Política para ver todas las fotos (público - para el frontend)
CREATE POLICY "Carousel photos public view" ON carousel_photos FOR SELECT TO public USING (true);

-- Políticas para gestión (solo autenticados)
CREATE POLICY "Carousel photos insert" ON carousel_photos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Carousel photos update" ON carousel_photos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Carousel photos delete" ON carousel_photos FOR DELETE TO authenticated USING (true);

-- Verificar políticas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'carousel_photos';