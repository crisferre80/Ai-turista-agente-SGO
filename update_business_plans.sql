-- Actualizar tabla business_plans existente para agregar campos faltantes
ALTER TABLE business_plans ADD COLUMN IF NOT EXISTS mercadopago_id VARCHAR(255);
ALTER TABLE business_plans ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Agregar restricción única en name si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_plans_name_unique') THEN
        ALTER TABLE business_plans ADD CONSTRAINT business_plans_name_unique UNIQUE (name);
    END IF;
END $$;

-- Políticas RLS (si no existen)
ALTER TABLE business_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin can manage business_plans" ON business_plans;
DROP POLICY IF EXISTS "Users can view business_plans" ON business_plans;

-- Permitir a usuarios autenticados ver planes
CREATE POLICY "Users can view business_plans" ON business_plans
  FOR SELECT USING (auth.role() = 'authenticated');

-- Permitir a usuarios autenticados gestionar planes (temporal para testing)
CREATE POLICY "Users can manage business_plans" ON business_plans
  FOR ALL USING (auth.role() = 'authenticated');

-- Insertar planes por defecto si no existen
INSERT INTO business_plans (name, display_name, price_monthly, price_yearly, features, max_images, priority) VALUES
  ('basic', 'Plan Básico', 0.00, 0.00, '["Acceso básico", "Perfil público", "Hasta 5 fotos en galería"]'::jsonb, 5, 1),
  ('pro', 'Plan Pro', 9.99, 99.99, '["Perfil destacado", "Galería ilimitada", "Estadísticas", "Soporte prioritario"]'::jsonb, -1, 2)
ON CONFLICT (name) DO NOTHING;