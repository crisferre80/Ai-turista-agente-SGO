-- Tabla para objetos AR posicionados por GPS
CREATE TABLE IF NOT EXISTS ar_positioned_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attraction_id UUID NOT NULL REFERENCES attractions(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  altitude DOUBLE PRECISION DEFAULT 0,
  label TEXT NOT NULL,
  model_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsqueda eficiente por ubicación
CREATE INDEX IF NOT EXISTS idx_ar_positioned_objects_attraction 
  ON ar_positioned_objects(attraction_id);

CREATE INDEX IF NOT EXISTS idx_ar_positioned_objects_location 
  ON ar_positioned_objects(latitude, longitude);

-- Columnas adicionales en la tabla attractions para QR
ALTER TABLE attractions 
  ADD COLUMN IF NOT EXISTS reference_image_url TEXT;

-- RLS (Row Level Security)
ALTER TABLE ar_positioned_objects ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden leer
CREATE POLICY "ar_positioned_objects_select_policy"
  ON ar_positioned_objects FOR SELECT
  USING (true);

-- Política: Solo admins pueden insertar/actualizar/eliminar
CREATE POLICY "ar_positioned_objects_insert_policy"
  ON ar_positioned_objects FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.role = 'admin'
    )
  );

CREATE POLICY "ar_positioned_objects_update_policy"
  ON ar_positioned_objects FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.role = 'admin'
    )
  );

CREATE POLICY "ar_positioned_objects_delete_policy"
  ON ar_positioned_objects FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.role = 'admin'
    )
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_ar_positioned_objects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ar_positioned_objects_updated_at
  BEFORE UPDATE ON ar_positioned_objects
  FOR EACH ROW
  EXECUTE FUNCTION update_ar_positioned_objects_updated_at();
