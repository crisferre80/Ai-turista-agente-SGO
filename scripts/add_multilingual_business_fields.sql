-- Agregar campos multilingües a business_profiles si no existen
-- Este script agrega soporte para descripciones en inglés, portugués y francés
-- Las configuraciones de TTS (voz, género, etc.) se guardan en app_settings


-- Verificar e agregar columna description_en
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'business_profiles' AND column_name = 'description_en'
  ) THEN
    ALTER TABLE business_profiles ADD COLUMN description_en TEXT;
    COMMENT ON COLUMN business_profiles.description_en IS 'Business description in English';
  END IF;
END $$;

-- Verificar e agregar columna description_pt
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'business_profiles' AND column_name = 'description_pt'
  ) THEN
    ALTER TABLE business_profiles ADD COLUMN description_pt TEXT;
    COMMENT ON COLUMN business_profiles.description_pt IS 'Business description in Portuguese';
  END IF;
END $$;

-- Verificar e agregar columna description_fr
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'business_profiles' AND column_name = 'description_fr'
  ) THEN
    ALTER TABLE business_profiles ADD COLUMN description_fr TEXT;
    COMMENT ON COLUMN business_profiles.description_fr IS 'Business description in French';
  END IF;
END $$;

-- Mostrar resultado final
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'business_profiles' 
  AND column_name IN ('description', 'description_en', 'description_pt', 'description_fr')
ORDER BY ordinal_position;
