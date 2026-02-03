-- Tabla para mensajes promocionales de Santi
-- Estos mensajes se muestran de forma aleatoria cuando el usuario está inactivo

CREATE TABLE IF NOT EXISTS promotional_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_name VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    category VARCHAR(100) DEFAULT 'general',
    priority INTEGER DEFAULT 0,
    show_probability INTEGER DEFAULT 25 CHECK (show_probability >= 0 AND show_probability <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_promotional_messages_active ON promotional_messages(is_active);
CREATE INDEX IF NOT EXISTS idx_promotional_messages_priority ON promotional_messages(priority DESC);

-- RLS Policies (Row Level Security)
ALTER TABLE promotional_messages ENABLE ROW LEVEL SECURITY;

-- Permitir lectura pública (para que ChatInterface los pueda leer)
CREATE POLICY "Anyone can view active promotional messages"
    ON promotional_messages FOR SELECT
    USING (is_active = true);

-- Solo admins pueden insertar/actualizar/eliminar
CREATE POLICY "Only admins can manage promotional messages"
    ON promotional_messages FOR ALL
    USING (
        auth.role() = 'authenticated' AND 
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND (auth.users.raw_user_meta_data->>'role' = 'admin')
        )
    );

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_promotional_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER promotional_messages_updated_at
    BEFORE UPDATE ON promotional_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_promotional_messages_updated_at();

-- Insertar mensajes de ejemplo (Nodo Tecnológico y otros)
INSERT INTO promotional_messages (business_name, message, is_active, category, priority, show_probability) VALUES
    ('Nodo Tecnológico', '¿Sabías que en Nodo Tecnológico podés encontrar servicio técnico, reparación de PC, venta de equipos y más? ¡Visitanos en nuestra sucursal!', true, 'tecnologia', 5, 25),
    ('Nodo Tecnológico', 'Si necesitás reparar tu compu, comprar accesorios o asesoramiento técnico, Nodo Tecnológico es tu lugar. ¡Consultá por nuestros servicios!', true, 'tecnologia', 5, 25),
    ('Registro de Negocios', '¿Tenés un negocio que te gustaría que aparezca en la app como destacado? Te explico cómo registrarlo: 1) Entrá a ''Mi Negocio'' y completá la ficha con nombre, dirección, horario y contacto. 2) Subí varias fotos y el logo de tu establecimiento. 3) Adjuntá la documentación necesaria y solicitá la acreditación. 4) Nuestro equipo revisará la solicitud y, una vez aprobada, tu negocio podrá aparecer como ''Comercio Certificado'' y ser destacado en la app. ¿Querés que te lleve ahora al formulario?', true, 'general', 3, 25),
    ('Registro de Negocios', 'Si querés aparecer destacado en la app: abrí ''Mi Negocio'' → Crear ficha → subí fotos y un texto breve sobre lo que los hace únicos. En 48-72h el equipo revisa y te avisa. ¿Deseás que te muestre cómo?', true, 'general', 3, 25);

COMMENT ON TABLE promotional_messages IS 'Mensajes promocionales que Santi dice aleatoriamente durante conversaciones';
COMMENT ON COLUMN promotional_messages.business_name IS 'Nombre del negocio o categoría promocionada';
COMMENT ON COLUMN promotional_messages.message IS 'Texto completo del mensaje que Santi dirá';
COMMENT ON COLUMN promotional_messages.is_active IS 'Si el mensaje está activo y puede ser mostrado';
COMMENT ON COLUMN promotional_messages.category IS 'Categoría del mensaje (tecnologia, gastronomia, general, etc)';
COMMENT ON COLUMN promotional_messages.priority IS 'Mayor prioridad = mayor probabilidad de aparecer';
COMMENT ON COLUMN promotional_messages.show_probability IS 'Probabilidad de mostrar este tipo de mensaje (0-100%)';
