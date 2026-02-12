-- ==========================================
-- SCRIPT PARA VERIFICAR ESTRUCTURA DE TABLA BUSINESSES
-- Ejecuta este script para ver qué columnas existen realmente
-- ==========================================

-- Ver todas las columnas de la tabla businesses
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'businesses' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ==========================================
-- SCRIPT PARA AGREGAR COLUMNAS FALTANTES (OPCIONAL)
-- ==========================================

-- Agregar columnas que faltan según el schema original
-- Solo ejecuta las que necesites

-- Agregar is_active si no existe
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'is_active') THEN
    ALTER TABLE businesses ADD COLUMN is_active BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Columna is_active agregada a la tabla businesses';
  ELSE
    RAISE NOTICE 'La columna is_active ya existe en la tabla businesses';
  END IF;
END $$;

-- Agregar description si no existe
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'description') THEN
    ALTER TABLE businesses ADD COLUMN description TEXT;
    RAISE NOTICE 'Columna description agregada a la tabla businesses';
  ELSE
    RAISE NOTICE 'La columna description ya existe en la tabla businesses';
  END IF;
END $$;

-- Agregar website_url si no existe
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'website_url') THEN
    ALTER TABLE businesses ADD COLUMN website_url TEXT;
    RAISE NOTICE 'Columna website_url agregada a la tabla businesses';
  ELSE
    RAISE NOTICE 'La columna website_url ya existe en la tabla businesses';
  END IF;
END $$;

-- Agregar contact_info si no existe
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'contact_info') THEN
    ALTER TABLE businesses ADD COLUMN contact_info TEXT;
    RAISE NOTICE 'Columna contact_info agregada a la tabla businesses';
  ELSE
    RAISE NOTICE 'La columna contact_info ya existe en la tabla businesses';
  END IF;
END $$;

-- Agregar phone si no existe
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'phone') THEN
    ALTER TABLE businesses ADD COLUMN phone TEXT;
    RAISE NOTICE 'Columna phone agregada a la tabla businesses';
  ELSE
    RAISE NOTICE 'La columna phone ya existe en la tabla businesses';
  END IF;
END $$;

-- Agregar address si no existe
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'address') THEN
    ALTER TABLE businesses ADD COLUMN address TEXT;
    RAISE NOTICE 'Columna address agregada a la tabla businesses';
  ELSE
    RAISE NOTICE 'La columna address ya existe en la tabla businesses';
  END IF;
END $$;

-- Agregar category si no existe
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'category') THEN
    ALTER TABLE businesses ADD COLUMN category TEXT;
    RAISE NOTICE 'Columna category agregada a la tabla businesses';
  ELSE
    RAISE NOTICE 'La columna category ya existe en la tabla businesses';
  END IF;
END $$;

-- Agregar plan si no existe
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'plan') THEN
    ALTER TABLE businesses ADD COLUMN plan TEXT DEFAULT 'basic';
    RAISE NOTICE 'Columna plan agregada a la tabla businesses';
  ELSE
    RAISE NOTICE 'La columna plan ya existe en la tabla businesses';
  END IF;
END $$;

-- Agregar is_verified si no existe
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'is_verified') THEN
    ALTER TABLE businesses ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Columna is_verified agregada a la tabla businesses';
  ELSE
    RAISE NOTICE 'La columna is_verified ya existe en la tabla businesses';
  END IF;
END $$;

-- Agregar gallery_images si no existe
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'gallery_images') THEN
    ALTER TABLE businesses ADD COLUMN gallery_images TEXT[];
    RAISE NOTICE 'Columna gallery_images agregada a la tabla businesses';
  ELSE
    RAISE NOTICE 'La columna gallery_images ya existe en la tabla businesses';
  END IF;
END $$;

-- Agregar payment_status si no existe
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'payment_status') THEN
    ALTER TABLE businesses ADD COLUMN payment_status TEXT DEFAULT 'pending';
    RAISE NOTICE 'Columna payment_status agregada a la tabla businesses';
  ELSE
    RAISE NOTICE 'La columna payment_status ya existe en la tabla businesses';
  END IF;
END $$;

-- Agregar subscription_end si no existe
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'subscription_end') THEN
    ALTER TABLE businesses ADD COLUMN subscription_end DATE;
    RAISE NOTICE 'Columna subscription_end agregada a la tabla businesses';
  ELSE
    RAISE NOTICE 'La columna subscription_end ya existe en la tabla businesses';
  END IF;
END $$;

-- ==========================================
-- TRIGGERS MEJORADOS (después de agregar columnas)
-- ==========================================

-- Función mejorada para manejar perfiles business (con más campos)
CREATE OR REPLACE FUNCTION handle_business_profile_enhanced()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el nuevo perfil tiene rol 'business' y no existe un negocio asociado
  IF NEW.role = 'business' AND NOT EXISTS (SELECT 1 FROM businesses WHERE owner_id = NEW.id) THEN
    -- Crear un negocio placeholder que luego puede ser completado
    INSERT INTO businesses (
      owner_id, 
      name,
      description,
      is_active,
      plan,
      is_verified,
      payment_status
    ) VALUES (
      NEW.id,
      COALESCE(NEW.name, 'Negocio de ' || COALESCE(NEW.name, 'Usuario')),
      'Negocio registrado automáticamente. Completa la información en tu perfil.',
      FALSE,
      'basic',
      FALSE,
      'pending'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función mejorada para sincronizar datos existentes (con más campos)
CREATE OR REPLACE FUNCTION sync_existing_business_profiles_enhanced()
RETURNS TEXT AS $$
DECLARE
  business_record RECORD;
  profile_record RECORD;
  sync_count INTEGER := 0;
BEGIN
  -- Actualizar perfiles existentes que tienen negocios pero no tienen rol 'business'
  FOR business_record IN 
    SELECT DISTINCT owner_id 
    FROM businesses 
    WHERE owner_id IS NOT NULL
  LOOP
    UPDATE profiles 
    SET role = 'business'
    WHERE id = business_record.owner_id 
    AND role != 'business';
    
    IF FOUND THEN
      sync_count := sync_count + 1;
    END IF;
  END LOOP;

  -- Crear negocios placeholder para perfiles con rol 'business' que no tienen negocio
  FOR profile_record IN
    SELECT id, name
    FROM profiles 
    WHERE role = 'business' 
    AND NOT EXISTS (SELECT 1 FROM businesses WHERE owner_id = profiles.id)
  LOOP
    INSERT INTO businesses (
      owner_id, 
      name,
      description,
      is_active,
      plan,
      is_verified,
      payment_status
    ) VALUES (
      profile_record.id,
      COALESCE(profile_record.name, 'Negocio de ' || COALESCE(profile_record.name, 'Usuario')),
      'Negocio sincronizado automáticamente. Completa la información en tu perfil.',
      FALSE,
      'basic',
      FALSE,
      'pending'
    );
    
    sync_count := sync_count + 1;
  END LOOP;

  RETURN 'Sincronización completada. ' || sync_count::TEXT || ' registros procesados.';
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- INSTRUCCIONES
-- ==========================================

/*
PASOS RECOMENDADOS:

1. Ejecuta la primera query SELECT para ver qué columnas tienes actualmente
2. Ejecuta los bloques DO $$ para agregar las columnas faltantes que necesites
3. Si agregaste columnas, puedes usar las funciones enhanced:
   - Reemplaza el trigger: 
     DROP TRIGGER IF EXISTS trigger_handle_business_profile ON profiles;
     CREATE TRIGGER trigger_handle_business_profile
       AFTER INSERT OR UPDATE OF role ON profiles
       FOR EACH ROW
       EXECUTE FUNCTION handle_business_profile_enhanced();
   
   - Ejecuta la sincronización mejorada:
     SELECT sync_existing_business_profiles_enhanced();

4. Si prefieres mantener solo las columnas básicas, usa la versión simple ya corregida
*/