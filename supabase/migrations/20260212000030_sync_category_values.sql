-- Sincroniza categorías canónicas entre frontend y backend

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_type_unique
  ON public.categories(name, type);

-- Asegura categorías canónicas mínimas para atractivos y negocios
DO $$
DECLARE
  categories_id_type TEXT;
BEGIN
  SELECT data_type INTO categories_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'id';

  IF categories_id_type = 'uuid' THEN
    INSERT INTO public.categories (id, name, type, icon, is_active)
    VALUES
      (gen_random_uuid(), 'histórico', 'attraction', '🏛️', true),
      (gen_random_uuid(), 'naturaleza', 'attraction', '🌿', true),
      (gen_random_uuid(), 'compras', 'attraction', '🛍️', true),
      (gen_random_uuid(), 'cultura', 'attraction', '🎭', true),
      (gen_random_uuid(), 'arquitectura', 'attraction', '🏗️', true),
      (gen_random_uuid(), 'monumentos', 'attraction', '🗿', true),
      (gen_random_uuid(), 'reservas naturales', 'attraction', '🏞️', true),
      (gen_random_uuid(), 'gastronomía', 'attraction', '🍽️', true),
      (gen_random_uuid(), 'artesanía', 'attraction', '🎨', true),
      (gen_random_uuid(), 'restaurante', 'business', '🍽️', true),
      (gen_random_uuid(), 'hotel', 'business', '🏨', true),
      (gen_random_uuid(), 'artesanía', 'business', '🎨', true),
      (gen_random_uuid(), 'compras', 'business', '🛍️', true),
      (gen_random_uuid(), 'cultura', 'business', '🎭', true),
      (gen_random_uuid(), 'servicios', 'business', '🛠️', true)
    ON CONFLICT (name, type) DO UPDATE
    SET icon = COALESCE(categories.icon, EXCLUDED.icon),
        is_active = true;
  ELSE
    INSERT INTO public.categories (id, name, type, icon, is_active)
    VALUES
      (md5('histórico:attraction'), 'histórico', 'attraction', '🏛️', true),
      (md5('naturaleza:attraction'), 'naturaleza', 'attraction', '🌿', true),
      (md5('compras:attraction'), 'compras', 'attraction', '🛍️', true),
      (md5('cultura:attraction'), 'cultura', 'attraction', '🎭', true),
      (md5('arquitectura:attraction'), 'arquitectura', 'attraction', '🏗️', true),
      (md5('monumentos:attraction'), 'monumentos', 'attraction', '🗿', true),
      (md5('reservas naturales:attraction'), 'reservas naturales', 'attraction', '🏞️', true),
      (md5('gastronomía:attraction'), 'gastronomía', 'attraction', '🍽️', true),
      (md5('artesanía:attraction'), 'artesanía', 'attraction', '🎨', true),
      (md5('restaurante:business'), 'restaurante', 'business', '🍽️', true),
      (md5('hotel:business'), 'hotel', 'business', '🏨', true),
      (md5('artesanía:business'), 'artesanía', 'business', '🎨', true),
      (md5('compras:business'), 'compras', 'business', '🛍️', true),
      (md5('cultura:business'), 'cultura', 'business', '🎭', true),
      (md5('servicios:business'), 'servicios', 'business', '🛠️', true)
    ON CONFLICT (name, type) DO UPDATE
    SET icon = COALESCE(categories.icon, EXCLUDED.icon),
        is_active = true;
  END IF;
END $$;

-- Normaliza categorías guardadas en attractions
UPDATE public.attractions
SET category = CASE
  WHEN lower(trim(category)) IN ('historico', 'histórico') THEN 'histórico'
  WHEN lower(trim(category)) IN ('gastronomia', 'gastronomía', 'restaurante', 'restaurantes') THEN 'gastronomía'
  WHEN lower(trim(category)) IN ('artesania', 'artesanía') THEN 'artesanía'
  WHEN lower(trim(category)) IN ('arquitectonico', 'arquitectonica', 'arquitectura') THEN 'arquitectura'
  WHEN lower(trim(category)) IN ('reserva natural', 'reservas naturales') THEN 'reservas naturales'
  WHEN lower(trim(category)) IN ('natural', 'naturaleza') THEN 'naturaleza'
  WHEN lower(trim(category)) = 'shopping' THEN 'compras'
  WHEN lower(trim(category)) = 'cultural' THEN 'cultura'
  WHEN lower(trim(category)) = 'monument' THEN 'monumentos'
  ELSE lower(trim(category))
END
WHERE category IS NOT NULL;

-- Normaliza categorías guardadas en business_profiles
UPDATE public.business_profiles
SET category = CASE
  WHEN lower(trim(category)) IN ('restaurantes', 'restaurante') THEN 'restaurante'
  WHEN lower(trim(category)) IN ('artesania', 'artesanía') THEN 'artesanía'
  WHEN lower(trim(category)) IN ('shopping', 'compras') THEN 'compras'
  WHEN lower(trim(category)) IN ('cultural', 'cultura') THEN 'cultura'
  WHEN lower(trim(category)) = 'servicio' THEN 'servicios'
  ELSE lower(trim(category))
END
WHERE category IS NOT NULL;
