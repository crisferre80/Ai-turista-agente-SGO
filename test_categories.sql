-- Script de prueba para verificar que las categorías se cargan correctamente
-- Ejecutar en Supabase SQL Editor

-- Verificar que la tabla existe
SELECT 'Tabla categories existe:' as check, EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'categories'
) as result;

-- Contar categorías por tipo
SELECT type, COUNT(*) as count
FROM categories
GROUP BY type
ORDER BY type;

-- Verificar que RLS está habilitado
SELECT 'RLS habilitado:' as check, relrowsecurity
FROM pg_class
WHERE relname = 'categories';

-- Verificar políticas RLS
SELECT 'Políticas RLS:' as check, COUNT(*) as policies_count
FROM pg_policies
WHERE tablename = 'categories';

-- Mostrar todas las categorías
SELECT * FROM categories ORDER BY type, name;