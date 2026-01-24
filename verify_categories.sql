-- Verificar tabla de categorías y agregar política RLS si es necesario

-- Verificar si la tabla existe
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'categories'
);

-- Verificar contenido de la tabla
SELECT * FROM categories ORDER BY type, name;

-- Agregar política RLS para permitir lectura pública de categorías
DROP POLICY IF EXISTS "Categorías públicas" ON categories;
CREATE POLICY "Categorías públicas" ON categories FOR SELECT TO public USING (true);

-- Verificar políticas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'categories';