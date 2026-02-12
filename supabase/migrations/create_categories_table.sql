-- Crear tabla de categorías estandarizadas
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, type) -- Restricción única por nombre y tipo
);

-- Habilitar RLS en la tabla categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura pública de categorías
DROP POLICY IF EXISTS "Categorías públicas" ON categories;
CREATE POLICY "Categorías públicas" ON categories FOR SELECT TO public USING (true);

-- Insertar categorías para attractions
INSERT INTO categories (name, type, icon) VALUES
('histórico', 'attraction', '🏛️'),
('naturaleza', 'attraction', '🌿'),
('compras', 'attraction', '🛍️'),
('cultura', 'attraction', '🎭'),
('arquitectura', 'attraction', '🏗️'),
('monumentos', 'attraction', '🗿'),
('reservas naturales', 'attraction', '🏞️'),
('gastronomía', 'attraction', '🍽️'),
('artesanía', 'attraction', '🎨')
ON CONFLICT (name) DO NOTHING;

-- Insertar categorías para businesses
INSERT INTO categories (name, type, icon) VALUES
('restaurante', 'business', '🍽️'),
('hotel', 'business', '🏨'),
('artesanía', 'business', '🎨'),
('compras', 'business', '🛍️'),
('cultura', 'business', '🎭'),
('servicios', 'business', '🛠️')
ON CONFLICT (name) DO NOTHING;

-- Verificar categorías
SELECT * FROM categories ORDER BY type, name;