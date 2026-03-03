-- SOLUCIÓN TEMPORAL: Desactivar RLS en categorías si sigue el error 400

-- Esto eliminará TODAS las restricciones de acceso
-- Solo para testing/debugging

ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;

-- Verificar que está desactivado
SELECT 
  tablename,
  rowsecurity as "RLS Habilitado?"
FROM pg_tables
WHERE tablename = 'categories'
AND schemaname = 'public';
