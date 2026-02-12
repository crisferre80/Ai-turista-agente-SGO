-- Script para arreglar la tabla categories y agregar categorías faltantes
-- Ejecutar después de modificar create_categories_table.sql

-- Primero, hacer backup de las categorías existentes
CREATE TEMP TABLE categories_backup AS SELECT * FROM categories;

-- Eliminar la tabla existente
DROP TABLE categories;

-- Recrear la tabla con la restricción correcta
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, type)
);

-- Habilitar RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Recrear política
CREATE POLICY "Categorías públicas" ON categories FOR SELECT TO public USING (true);

-- Restaurar categorías existentes
INSERT INTO categories (name, type, icon, created_at)
SELECT name, type, icon, created_at FROM categories_backup
ON CONFLICT (name, type) DO NOTHING;

-- Agregar categorías faltantes
INSERT INTO categories (name, type, icon) VALUES
('cultura', 'business', '🎭'),
('compras', 'business', '🛍️'),
('artesanía', 'business', '🎨')
ON CONFLICT (name, type) DO NOTHING;

-- Verificar resultado
SELECT type, COUNT(*) as count FROM categories GROUP BY type ORDER BY type;
SELECT * FROM categories ORDER BY type, name;