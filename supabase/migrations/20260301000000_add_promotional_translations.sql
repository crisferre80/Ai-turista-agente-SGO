-- Agregar columnas de traducción a la tabla promotional_messages
-- Soporta mensajes en 4 idiomas: Español, English, Português, Français

-- Agregar columnas de traducción si no existen
ALTER TABLE promotional_messages
ADD COLUMN IF NOT EXISTS message_en TEXT,
ADD COLUMN IF NOT EXISTS message_pt TEXT,
ADD COLUMN IF NOT EXISTS message_fr TEXT;

-- Hacer que message sea el equivalente en español para claridad
-- (la columna message existente será en español)

-- Crear una función para obtener el mensaje en el idioma solicitado
CREATE OR REPLACE FUNCTION get_promotional_message(p_id UUID, p_locale TEXT DEFAULT 'es')
RETURNS TEXT AS $$
DECLARE
    msg TEXT;
BEGIN
    SELECT CASE 
        WHEN p_locale = 'en' AND message_en IS NOT NULL THEN message_en
        WHEN p_locale = 'pt' AND message_pt IS NOT NULL THEN message_pt
        WHEN p_locale = 'fr' AND message_fr IS NOT NULL THEN message_fr
        ELSE message -- Fallback a español
    END INTO msg
    FROM promotional_messages
    WHERE id = p_id AND is_active = true;
    
    RETURN msg;
END;
$$ LANGUAGE plpgsql;

-- Crear vista para obtener mensajes promocionales con todas las traducciones
CREATE OR REPLACE VIEW promotional_messages_translated AS
SELECT 
    id,
    business_name,
    message AS message_es,
    message_en,
    message_pt,
    message_fr,
    is_active,
    category,
    priority,
    show_probability,
    created_at,
    updated_at
FROM promotional_messages
WHERE is_active = true;

-- Dar permisos a usuarios autenticados
GRANT SELECT ON promotional_messages_translated TO authenticated;
GRANT EXECUTE ON FUNCTION get_promotional_message(UUID, TEXT) TO authenticated;

-- Comentarios para documentación
COMMENT ON COLUMN promotional_messages.message_en IS 'Mensaje promocional en inglés';
COMMENT ON COLUMN promotional_messages.message_pt IS 'Mensaje promocional en portugués';
COMMENT ON COLUMN promotional_messages.message_fr IS 'Mensaje promocional en francés';
COMMENT ON FUNCTION get_promotional_message IS 'Obtiene el mensaje promocional en el idioma especificado (es, en, pt, fr)';
COMMENT ON VIEW promotional_messages_translated IS 'Vista que muestra mensajes promocionales con sus traducciones';
