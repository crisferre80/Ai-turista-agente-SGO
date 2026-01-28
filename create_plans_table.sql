-- Crear tabla para planes de suscripción
CREATE TABLE IF NOT EXISTS plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  price DECIMAL(10,2) NOT NULL,
  features JSONB DEFAULT '[]'::jsonb, -- Array de características
  mercadopago_id VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Políticas RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Solo admin puede gestionar planes
CREATE POLICY "Admin can manage plans" ON plans
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Insertar planes por defecto
INSERT INTO plans (name, price, features) VALUES
  ('basic', 0.00, '["Acceso básico", "Perfil público", "1 foto en galería"]'::jsonb),
  ('pro', 9.99, '["Perfil destacado", "Galería ilimitada", "Estadísticas", "Soporte prioritario"]'::jsonb)
ON CONFLICT (name) DO NOTHING;