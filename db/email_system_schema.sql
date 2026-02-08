-- Sistema de Email Marketing y Notificaciones

-- Tabla de plantillas de email
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    subject VARCHAR(500) NOT NULL,
    html_content TEXT NOT NULL,
    thumbnail_url TEXT,
    category VARCHAR(100), -- 'marketing', 'transactional', 'notification'
    variables JSONB DEFAULT '[]'::jsonb, -- Variables dinámicas como {{nombre}}, {{fecha}}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Agregar columnas faltantes a email_templates si no existen
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_templates' 
                   AND column_name = 'category') THEN
        ALTER TABLE email_templates ADD COLUMN category VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_templates' 
                   AND column_name = 'thumbnail_url') THEN
        ALTER TABLE email_templates ADD COLUMN thumbnail_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_templates' 
                   AND column_name = 'variables') THEN
        ALTER TABLE email_templates ADD COLUMN variables JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_templates' 
                   AND column_name = 'updated_at') THEN
        ALTER TABLE email_templates ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_templates' 
                   AND column_name = 'created_by') THEN
        ALTER TABLE email_templates ADD COLUMN created_by UUID REFERENCES auth.users(id);
    END IF;
    
    -- Agregar restricción UNIQUE en name si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE table_name = 'email_templates' 
                   AND constraint_name = 'email_templates_name_key') THEN
        ALTER TABLE email_templates ADD CONSTRAINT email_templates_name_key UNIQUE (name);
    END IF;
END $$;

-- Tabla de contactos para email marketing
CREATE TABLE IF NOT EXISTS email_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    phone VARCHAR(50),
    tags TEXT[], -- etiquetas para segmentación: 'turista', 'negocio', 'vip', etc.
    metadata JSONB DEFAULT '{}'::jsonb, -- datos adicionales personalizados
    subscribed BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agregar columna subscribed si no existe (para tablas existentes)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_contacts' 
                   AND column_name = 'subscribed') THEN
        ALTER TABLE email_contacts ADD COLUMN subscribed BOOLEAN DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_contacts' 
                   AND column_name = 'phone') THEN
        ALTER TABLE email_contacts ADD COLUMN phone VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_contacts' 
                   AND column_name = 'tags') THEN
        ALTER TABLE email_contacts ADD COLUMN tags TEXT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_contacts' 
                   AND column_name = 'metadata') THEN
        ALTER TABLE email_contacts ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_contacts' 
                   AND column_name = 'updated_at') THEN
        ALTER TABLE email_contacts ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Tabla de campañas de email
CREATE TABLE IF NOT EXISTS email_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
    subject VARCHAR(500) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'scheduled', 'sending', 'sent', 'failed'
    recipients_filter JSONB, -- filtros para seleccionar contactos (tags, etc.)
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Agregar columnas faltantes a email_campaigns si no existen
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_campaigns' 
                   AND column_name = 'recipients_filter') THEN
        ALTER TABLE email_campaigns ADD COLUMN recipients_filter JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_campaigns' 
                   AND column_name = 'total_recipients') THEN
        ALTER TABLE email_campaigns ADD COLUMN total_recipients INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_campaigns' 
                   AND column_name = 'sent_count') THEN
        ALTER TABLE email_campaigns ADD COLUMN sent_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_campaigns' 
                   AND column_name = 'failed_count') THEN
        ALTER TABLE email_campaigns ADD COLUMN failed_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_campaigns' 
                   AND column_name = 'opened_count') THEN
        ALTER TABLE email_campaigns ADD COLUMN opened_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_campaigns' 
                   AND column_name = 'clicked_count') THEN
        ALTER TABLE email_campaigns ADD COLUMN clicked_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_campaigns' 
                   AND column_name = 'scheduled_at') THEN
        ALTER TABLE email_campaigns ADD COLUMN scheduled_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_campaigns' 
                   AND column_name = 'sent_at') THEN
        ALTER TABLE email_campaigns ADD COLUMN sent_at TIMESTAMPTZ;
    END IF;
END $$;

-- Tabla de logs de envío
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES email_contacts(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'sent', 'failed', 'bounced', 'opened', 'clicked'
    error_message TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ
);

-- Agregar columnas faltantes a email_logs si no existen
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_logs' 
                   AND column_name = 'error_message') THEN
        ALTER TABLE email_logs ADD COLUMN error_message TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_logs' 
                   AND column_name = 'opened_at') THEN
        ALTER TABLE email_logs ADD COLUMN opened_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_logs' 
                   AND column_name = 'clicked_at') THEN
        ALTER TABLE email_logs ADD COLUMN clicked_at TIMESTAMPTZ;
    END IF;
END $$;

-- Tabla de configuración de notificaciones automáticas
CREATE TABLE IF NOT EXISTS email_notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL UNIQUE, -- 'new_business', 'new_feature', 'new_story', 'welcome', 'reminder'
    enabled BOOLEAN DEFAULT true,
    template_id UUID REFERENCES email_templates(id),
    recipient_type VARCHAR(50), -- 'all', 'subscribers', 'specific_tags'
    recipient_tags TEXT[],
    delay_minutes INTEGER DEFAULT 0, -- retraso antes de enviar
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agregar columnas faltantes a email_notification_settings si no existen
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_notification_settings' 
                   AND column_name = 'enabled') THEN
        ALTER TABLE email_notification_settings ADD COLUMN enabled BOOLEAN DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_notification_settings' 
                   AND column_name = 'template_id') THEN
        ALTER TABLE email_notification_settings ADD COLUMN template_id UUID REFERENCES email_templates(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_notification_settings' 
                   AND column_name = 'recipient_type') THEN
        ALTER TABLE email_notification_settings ADD COLUMN recipient_type VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_notification_settings' 
                   AND column_name = 'recipient_tags') THEN
        ALTER TABLE email_notification_settings ADD COLUMN recipient_tags TEXT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_notification_settings' 
                   AND column_name = 'delay_minutes') THEN
        ALTER TABLE email_notification_settings ADD COLUMN delay_minutes INTEGER DEFAULT 0;
    END IF;
END $$;

-- Índices para mejor rendimiento
DROP INDEX IF EXISTS idx_email_contacts_email;
DROP INDEX IF EXISTS idx_email_contacts_tags;
DROP INDEX IF EXISTS idx_email_contacts_subscribed;
DROP INDEX IF EXISTS idx_email_campaigns_status;
DROP INDEX IF EXISTS idx_email_logs_campaign;
DROP INDEX IF EXISTS idx_email_logs_contact;
DROP INDEX IF EXISTS idx_email_logs_status;

CREATE INDEX IF NOT EXISTS idx_email_contacts_email ON email_contacts(email);
CREATE INDEX IF NOT EXISTS idx_email_contacts_tags ON email_contacts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_email_contacts_subscribed ON email_contacts(subscribed);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_campaign ON email_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_contact ON email_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);

-- RLS Policies
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_notification_settings ENABLE ROW LEVEL SECURITY;

-- Solo usuarios autenticados pueden leer
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver plantillas" ON email_templates;
CREATE POLICY "Usuarios autenticados pueden ver plantillas" ON email_templates
    FOR SELECT TO authenticated USING (true);

-- Solo admins pueden crear/editar/eliminar
DROP POLICY IF EXISTS "Solo admins pueden modificar plantillas" ON email_templates;
CREATE POLICY "Solo admins pueden modificar plantillas" ON email_templates
    FOR ALL TO authenticated
    USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'))
    WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

DROP POLICY IF EXISTS "Solo admins pueden ver contactos" ON email_contacts;
CREATE POLICY "Solo admins pueden ver contactos" ON email_contacts
    FOR ALL TO authenticated
    USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'))
    WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

DROP POLICY IF EXISTS "Solo admins pueden gestionar campañas" ON email_campaigns;
CREATE POLICY "Solo admins pueden gestionar campañas" ON email_campaigns
    FOR ALL TO authenticated
    USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'))
    WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

DROP POLICY IF EXISTS "Solo admins pueden ver logs" ON email_logs;
CREATE POLICY "Solo admins pueden ver logs" ON email_logs
    FOR SELECT TO authenticated
    USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

DROP POLICY IF EXISTS "Solo admins pueden configurar notificaciones" ON email_notification_settings;
CREATE POLICY "Solo admins pueden configurar notificaciones" ON email_notification_settings
    FOR ALL TO authenticated
    USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'))
    WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_email_templates_updated_at ON email_templates;
CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_contacts_updated_at ON email_contacts;
CREATE TRIGGER update_email_contacts_updated_at BEFORE UPDATE ON email_contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_notification_settings_updated_at ON email_notification_settings;
CREATE TRIGGER update_email_notification_settings_updated_at BEFORE UPDATE ON email_notification_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Plantillas de ejemplo
INSERT INTO email_templates (name, subject, html_content, category) VALUES
('Bienvenida', '¡Bienvenido a SantiGuía!', 
'<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1A3A6C 0%, #2C5AA0 100%); padding: 40px; text-align: center; border-radius: 10px;">
        <h1 style="color: white; margin: 0;">¡Bienvenido a SantiGuía!</h1>
    </div>
    <div style="padding: 30px; background: white;">
        <h2 style="color: #1A3A6C;">Hola {{nombre}},</h2>
        <p style="font-size: 16px; line-height: 1.6; color: #333;">
            Gracias por registrarte en SantiGuía, tu asistente turístico virtual para descubrir Santiago del Estero.
        </p>
        <p style="font-size: 16px; line-height: 1.6; color: #333;">
            Estamos emocionados de acompañarte en tu recorrido por nuestra hermosa provincia.
        </p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{app_url}}" style="background: #9E1B1B; color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; font-weight: bold;">
                Comenzar a Explorar
            </a>
        </div>
    </div>
    <div style="text-align: center; padding: 20px; color: #666; font-size: 14px;">
        <p>SantiGuía - Tu compañero de viajes en Santiago del Estero</p>
    </div>
</body>
</html>', 'transactional')
ON CONFLICT (name) DO NOTHING;

INSERT INTO email_templates (name, subject, html_content, category) VALUES
('Nuevo Negocio', 'Nuevo negocio registrado en SantiGuía!',
'<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #F1C40F; padding: 40px; text-align: center; border-radius: 10px;">
        <h1 style="color: #1A3A6C; margin: 0;">🎉 ¡Nuevo Negocio!</h1>
    </div>
    <div style="padding: 30px; background: white;">
        <h2 style="color: #1A3A6C;">{{business_name}}</h2>
        <p style="font-size: 16px; line-height: 1.6; color: #333;">
            Un nuevo negocio se ha registrado en SantiGuía y está listo para recibir visitantes.
        </p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Categoría:</strong> {{category}}</p>
            <p><strong>Ubicación:</strong> {{location}}</p>
            <p><strong>Descripción:</strong> {{description}}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{business_url}}" style="background: #9E1B1B; color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; font-weight: bold;">
                Ver Detalles
            </a>
        </div>
    </div>
</body>
</html>', 'notification')
ON CONFLICT (name) DO NOTHING;

-- Configuración de notificaciones por defecto
INSERT INTO email_notification_settings (event_type, enabled, recipient_type) VALUES
('welcome', true, 'specific')
ON CONFLICT (event_type) DO NOTHING;

INSERT INTO email_notification_settings (event_type, enabled, recipient_type) VALUES
('new_business', true, 'all')
ON CONFLICT (event_type) DO NOTHING;

INSERT INTO email_notification_settings (event_type, enabled, recipient_type) VALUES
('new_feature', true, 'subscribers')
ON CONFLICT (event_type) DO NOTHING;

INSERT INTO email_notification_settings (event_type, enabled, recipient_type) VALUES
('new_story', true, 'subscribers')
ON CONFLICT (event_type) DO NOTHING;

INSERT INTO email_notification_settings (event_type, enabled, recipient_type) VALUES
('reminder', true, 'subscribers')
ON CONFLICT (event_type) DO NOTHING;
