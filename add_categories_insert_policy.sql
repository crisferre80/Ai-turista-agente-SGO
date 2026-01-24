-- Agregar política RLS para INSERT en categories
-- Permitir inserción para todos (temporal para testing, luego restringir)

DROP POLICY IF EXISTS "Permitir inserción de categorías" ON categories;
CREATE POLICY "Permitir inserción de categorías" ON categories
FOR INSERT TO public
WITH CHECK (true);

-- Verificar políticas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'categories';