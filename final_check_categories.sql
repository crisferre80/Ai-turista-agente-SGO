-- Verificación final: Categorías en la app
-- Ejecutar en Supabase SQL Editor

-- Contar total de categorías
SELECT
    'Total categorías:' as info,
    COUNT(*) as count
FROM categories;

-- Contar por tipo
SELECT
    type,
    COUNT(*) as count,
    STRING_AGG(name, ', ' ORDER BY name) as categories
FROM categories
GROUP BY type
ORDER BY type;

-- Verificar RLS
SELECT
    'RLS habilitado:' as check,
    relrowsecurity
FROM pg_class
WHERE relname = 'categories';

-- Verificar política
SELECT
    'Política pública existe:' as check,
    COUNT(*) > 0 as exists
FROM pg_policies
WHERE tablename = 'categories' AND policyname = 'Categorías públicas';

-- Mostrar todas las categorías ordenadas
SELECT
    type,
    name,
    icon,
    created_at::date as created_date
FROM categories
ORDER BY type, name;