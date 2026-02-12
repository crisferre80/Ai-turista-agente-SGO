-- Minimal seeds (2026-02-12)

-- Default app settings
INSERT INTO public.app_settings (key, value)
VALUES
  ('ia_provider', '"gemini"'),
  ('ia_model', '"gemini-2.0-flash-exp"'),
  ('tts_provider', '"openai"'),
  ('tts_engine', '"alloy"')
ON CONFLICT (key) DO NOTHING;

-- Default categories
DO $$
DECLARE
  categories_id_type TEXT;
  idx RECORD;
BEGIN
  -- Needed if someone runs this seed standalone
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  -- Ensure the table exists (for users running only this seed in an existing project)
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'categories'
  ) THEN
    CREATE TABLE public.categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('attraction', 'business')),
      description TEXT,
      icon TEXT,
      color TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;

  -- Ensure `type` column exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'type'
  ) THEN
    ALTER TABLE public.categories ADD COLUMN type TEXT;
  END IF;

  -- Backfill legacy rows
  UPDATE public.categories SET type = 'attraction'
  WHERE type IS NULL;

  -- Normalize legacy names (case/accents/plurals) to canonical values used by the app
  UPDATE public.categories
  SET name = CASE
    -- Attraction canonical
    WHEN lower(name) IN ('historico', 'histórico') THEN 'histórico'
    WHEN lower(name) IN ('gastronomia', 'gastronomía') AND type = 'attraction' THEN 'gastronomía'
    WHEN lower(name) IN ('restaurantes', 'restaurante') AND type = 'attraction' THEN 'gastronomía'
    WHEN lower(name) IN ('artesania', 'artesanía') AND type = 'attraction' THEN 'artesanía'
    WHEN lower(name) = 'reservas naturales' AND type = 'attraction' THEN 'reservas naturales'
    WHEN lower(name) = 'monumentos' AND type = 'attraction' THEN 'monumentos'
    WHEN lower(name) = 'arquitectura' AND type = 'attraction' THEN 'arquitectura'
    WHEN lower(name) = 'cultura' AND type = 'attraction' THEN 'cultura'
    WHEN lower(name) = 'compras' AND type = 'attraction' THEN 'compras'
    WHEN lower(name) = 'naturaleza' AND type = 'attraction' THEN 'naturaleza'

    -- Business canonical
    WHEN lower(name) IN ('restaurantes', 'restaurante') AND type = 'business' THEN 'restaurante'
    WHEN lower(name) = 'hotel' AND type = 'business' THEN 'hotel'
    WHEN lower(name) IN ('artesania', 'artesanía') AND type = 'business' THEN 'artesanía'
    WHEN lower(name) = 'compras' AND type = 'business' THEN 'compras'
    WHEN lower(name) = 'cultura' AND type = 'business' THEN 'cultura'
    WHEN lower(name) = 'servicios' AND type = 'business' THEN 'servicios'

    ELSE name
  END
  WHERE name IS NOT NULL;

  -- Drop clearly-invalid pairs introduced by older seeds
  -- (e.g. "Restaurantes" inserted as attraction, or attraction categories stored as business)
  DELETE FROM public.categories
  WHERE type = 'attraction'
    AND lower(name) IN ('hotel', 'servicios')
     OR (type = 'business' AND lower(name) IN ('histórico','arquitectura','monumentos','reservas naturales','gastronomía','naturaleza'));

  -- Deduplicate by (name,type): keep the "best" row (prefer color/icon, then newest updated_at)
  WITH ranked AS (
    SELECT
      ctid,
      row_number() OVER (
        PARTITION BY name, type
        ORDER BY
          (color IS NOT NULL) DESC,
          (icon IS NOT NULL) DESC,
          updated_at DESC NULLS LAST,
          created_at DESC NULLS LAST
      ) AS rn
    FROM public.categories
  )
  DELETE FROM public.categories c
  USING ranked r
  WHERE c.ctid = r.ctid AND r.rn > 1;

  -- Ensure icons exist for canonical rows (only fill missing)
  UPDATE public.categories SET icon = '🏛️' WHERE type = 'attraction' AND name = 'histórico' AND icon IS NULL;
  UPDATE public.categories SET icon = '🌿' WHERE type = 'attraction' AND name = 'naturaleza' AND icon IS NULL;
  UPDATE public.categories SET icon = '🛍️' WHERE type = 'attraction' AND name = 'compras' AND icon IS NULL;
  UPDATE public.categories SET icon = '🎭' WHERE type = 'attraction' AND name = 'cultura' AND icon IS NULL;
  UPDATE public.categories SET icon = '🏗️' WHERE type = 'attraction' AND name = 'arquitectura' AND icon IS NULL;
  UPDATE public.categories SET icon = '🗿' WHERE type = 'attraction' AND name = 'monumentos' AND icon IS NULL;
  UPDATE public.categories SET icon = '🏞️' WHERE type = 'attraction' AND name = 'reservas naturales' AND icon IS NULL;
  UPDATE public.categories SET icon = '🍽️' WHERE type = 'attraction' AND name = 'gastronomía' AND icon IS NULL;
  UPDATE public.categories SET icon = '🎨' WHERE type = 'attraction' AND name = 'artesanía' AND icon IS NULL;

  UPDATE public.categories SET icon = '🍽️' WHERE type = 'business' AND name = 'restaurante' AND icon IS NULL;
  UPDATE public.categories SET icon = '🏨' WHERE type = 'business' AND name = 'hotel' AND icon IS NULL;
  UPDATE public.categories SET icon = '🎨' WHERE type = 'business' AND name = 'artesanía' AND icon IS NULL;
  UPDATE public.categories SET icon = '🛍️' WHERE type = 'business' AND name = 'compras' AND icon IS NULL;
  UPDATE public.categories SET icon = '🎭' WHERE type = 'business' AND name = 'cultura' AND icon IS NULL;
  UPDATE public.categories SET icon = '🛠️' WHERE type = 'business' AND name = 'servicios' AND icon IS NULL;

  -- Drop UNIQUE(name) index if it exists (legacy) so we can store (name,type)
  FOR idx IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'categories'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%(name)%'
      AND indexdef NOT ILIKE '%(name,%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', idx.indexname);
  END LOOP;

  -- Ensure unique(name,type)
  CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_type_unique
    ON public.categories(name, type);

  -- Figure out id type to insert compatibly
  SELECT c.data_type INTO categories_id_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'categories' AND c.column_name = 'id';

  IF categories_id_type = 'uuid' THEN
    EXECUTE $catins_uuid$
      INSERT INTO public.categories (name, type, description, icon, color, is_active)
      VALUES
        -- Attractions
        ('histórico', 'attraction', 'Sitios históricos y monumentos', '🏛️', NULL, true),
        ('naturaleza', 'attraction', 'Parques, reservas y espacios naturales', '🌿', NULL, true),
        ('compras', 'attraction', 'Centros comerciales y tiendas', '🛍️', NULL, true),
        ('cultura', 'attraction', 'Museos, teatros y eventos culturales', '🎭', NULL, true),
        ('arquitectura', 'attraction', 'Edificios y obras arquitectónicas', '🏗️', NULL, true),
        ('monumentos', 'attraction', 'Monumentos y sitios conmemorativos', '🗿', NULL, true),
        ('reservas naturales', 'attraction', 'Reservas, parques y áreas protegidas', '🏞️', NULL, true),
        ('gastronomía', 'attraction', 'Gastronomía y lugares para comer', '🍽️', NULL, true),
        ('artesanía', 'attraction', 'Artesanías y cultura local', '🎨', NULL, true),

        -- Businesses
        ('restaurante', 'business', 'Restaurantes y bares', '🍽️', NULL, true),
        ('hotel', 'business', 'Hoteles y alojamientos', '🏨', NULL, true),
        ('artesanía', 'business', 'Artesanías y productos regionales', '🎨', NULL, true),
        ('compras', 'business', 'Tiendas y comercios', '🛍️', NULL, true),
        ('cultura', 'business', 'Servicios culturales', '🎭', NULL, true),
        ('servicios', 'business', 'Servicios generales', '🛠️', NULL, true)
      ON CONFLICT (name, type) DO NOTHING;
    $catins_uuid$;
  ELSE
    -- Legacy id as TEXT: generate deterministic ids
    EXECUTE $catins_text$
      INSERT INTO public.categories (id, name, type, description, icon, color, is_active)
      VALUES
        -- Attractions
        (md5('histórico:attraction'), 'histórico', 'attraction', 'Sitios históricos y monumentos', '🏛️', NULL, true),
        (md5('naturaleza:attraction'), 'naturaleza', 'attraction', 'Parques, reservas y espacios naturales', '🌿', NULL, true),
        (md5('compras:attraction'), 'compras', 'attraction', 'Centros comerciales y tiendas', '🛍️', NULL, true),
        (md5('cultura:attraction'), 'cultura', 'attraction', 'Museos, teatros y eventos culturales', '🎭', NULL, true),
        (md5('arquitectura:attraction'), 'arquitectura', 'attraction', 'Edificios y obras arquitectónicas', '🏗️', NULL, true),
        (md5('monumentos:attraction'), 'monumentos', 'attraction', 'Monumentos y sitios conmemorativos', '🗿', NULL, true),
        (md5('reservas naturales:attraction'), 'reservas naturales', 'attraction', 'Reservas, parques y áreas protegidas', '🏞️', NULL, true),
        (md5('gastronomía:attraction'), 'gastronomía', 'attraction', 'Gastronomía y lugares para comer', '🍽️', NULL, true),
        (md5('artesanía:attraction'), 'artesanía', 'attraction', 'Artesanías y cultura local', '🎨', NULL, true),

        -- Businesses
        (md5('restaurante:business'), 'restaurante', 'business', 'Restaurantes y bares', '🍽️', NULL, true),
        (md5('hotel:business'), 'hotel', 'business', 'Hoteles y alojamientos', '🏨', NULL, true),
        (md5('artesanía:business'), 'artesanía', 'business', 'Artesanías y productos regionales', '🎨', NULL, true),
        (md5('compras:business'), 'compras', 'business', 'Tiendas y comercios', '🛍️', NULL, true),
        (md5('cultura:business'), 'cultura', 'business', 'Servicios culturales', '🎭', NULL, true),
        (md5('servicios:business'), 'servicios', 'business', 'Servicios generales', '🛠️', NULL, true)
      ON CONFLICT (name, type) DO NOTHING;
    $catins_text$;
  END IF;
END $$;

-- Default business plans (editable from admin)
INSERT INTO public.business_plans (name, display_name, price_monthly, price_yearly, features, max_images, priority, is_active)
VALUES
  ('basic', 'Básico', 0, 0, '["Publicación simple", "Hasta 5 imágenes"]'::jsonb, 5, 10, true),
  ('pro', 'Pro', 4999, 49990, '["Más visibilidad", "Hasta 15 imágenes", "Soporte"]'::jsonb, 15, 20, true),
  ('premium', 'Premium', 9999, 99990, '["Máxima visibilidad", "Hasta 30 imágenes", "Destacado"]'::jsonb, 30, 30, true)
ON CONFLICT (name) DO NOTHING;

-- Basic email notification events placeholders (admin can reconfigure)
INSERT INTO public.email_notifications (event_type, template_id, recipient_type, is_active)
SELECT 'user_registered', NULL, 'user', false
WHERE NOT EXISTS (SELECT 1 FROM public.email_notifications WHERE event_type = 'user_registered');

INSERT INTO public.email_notifications (event_type, template_id, recipient_type, is_active)
SELECT 'business_registered', NULL, 'admin', false
WHERE NOT EXISTS (SELECT 1 FROM public.email_notifications WHERE event_type = 'business_registered');

-- Default email_notification_settings rows (used by /api/email/notify)
INSERT INTO public.email_notification_settings (event_type, enabled, template_id, recipient_type, recipient_tags, delay_minutes)
SELECT 'welcome', false, NULL, 'all', NULL, 0
WHERE NOT EXISTS (SELECT 1 FROM public.email_notification_settings WHERE event_type = 'welcome');

INSERT INTO public.email_notification_settings (event_type, enabled, template_id, recipient_type, recipient_tags, delay_minutes)
SELECT 'new_business', false, NULL, 'all', NULL, 0
WHERE NOT EXISTS (SELECT 1 FROM public.email_notification_settings WHERE event_type = 'new_business');
