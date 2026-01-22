-- ==========================================
-- VERSIÓN ALTERNATIVA CON VERIFICACIÓN DE COLUMNAS
-- Ejecuta este archivo si necesitas agregar la columna description
-- ==========================================

-- Verificar y agregar columna description si no existe
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'description') THEN
    ALTER TABLE businesses ADD COLUMN description TEXT;
    RAISE NOTICE 'Columna description agregada a la tabla businesses';
  ELSE
    RAISE NOTICE 'La columna description ya existe en la tabla businesses';
  END IF;
END $$;

-- ==========================================
-- TRIGGERS COMPATIBLES (versión completa con description)
-- ==========================================

-- Función que se ejecutará cuando se inserte o actualice un negocio
CREATE OR REPLACE FUNCTION link_business_to_profile_complete()
RETURNS TRIGGER AS $$
BEGIN
  -- Si hay un owner_id especificado
  IF NEW.owner_id IS NOT NULL THEN
    -- Verificar si el perfil ya existe
    IF EXISTS (SELECT 1 FROM profiles WHERE id = NEW.owner_id) THEN
      -- Actualizar el rol a 'business' si no lo es ya
      UPDATE profiles 
      SET role = 'business',
          updated_at = NOW()
      WHERE id = NEW.owner_id 
      AND role != 'business';
    ELSE
      -- Crear el perfil si no existe (esto podría suceder si se crea el negocio manualmente)
      INSERT INTO profiles (id, role, name, created_at)
      VALUES (NEW.owner_id, 'business', 'Propietario de ' || NEW.name, NOW())
      ON CONFLICT (id) DO UPDATE SET
        role = 'business',
        updated_at = NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para manejar cuando se crea un perfil con rol business sin negocio (versión completa)
CREATE OR REPLACE FUNCTION handle_business_profile_complete()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el nuevo perfil tiene rol 'business' y no existe un negocio asociado
  IF NEW.role = 'business' AND NOT EXISTS (SELECT 1 FROM businesses WHERE owner_id = NEW.id) THEN
    -- Crear un negocio placeholder que luego puede ser completado (con description)
    INSERT INTO businesses (
      owner_id, 
      name, 
      description,
      is_active,
      created_at
    ) VALUES (
      NEW.id,
      COALESCE(NEW.name, 'Negocio de ' || COALESCE(NEW.name, 'Usuario')),
      'Negocio registrado automáticamente. Completa la información en tu perfil.',
      FALSE,
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para sincronizar los datos existentes (versión completa con description)
CREATE OR REPLACE FUNCTION sync_existing_business_profiles_complete()
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
      created_at
    ) VALUES (
      profile_record.id,
      COALESCE(profile_record.name, 'Negocio de ' || COALESCE(profile_record.name, 'Usuario')),
      'Negocio sincronizado automáticamente. Completa la información en tu perfil.',
      FALSE,
      NOW()
    );
    
    sync_count := sync_count + 1;
  END LOOP;

  RETURN 'Sincronización completada. ' || sync_count::TEXT || ' registros procesados.';
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- REEMPLAZAR TRIGGERS (opcional - solo si quieres la versión completa)
-- ==========================================

-- Descomenta estas líneas si quieres usar las funciones completas con description:

/*
-- Reemplazar los triggers con las versiones completas
DROP TRIGGER IF EXISTS trigger_link_business_to_profile ON businesses;
CREATE TRIGGER trigger_link_business_to_profile
  AFTER INSERT OR UPDATE OF owner_id ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION link_business_to_profile_complete();

DROP TRIGGER IF EXISTS trigger_handle_business_profile ON profiles;
CREATE TRIGGER trigger_handle_business_profile
  AFTER INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_business_profile_complete();
*/

-- ==========================================
-- INSTRUCCIONES
-- ==========================================

/*
OPCIÓN 1: Usar la versión simple (sin description)
- Los triggers ya están instalados desde business_profile_trigger.sql
- Ejecuta: SELECT sync_existing_business_profiles();

OPCIÓN 2: Usar la versión completa (con description)
- Ejecuta todo este archivo
- Descomenta las líneas para reemplazar los triggers
- Ejecuta: SELECT sync_existing_business_profiles_complete();

RECOMENDACIÓN:
Si tu tabla businesses ya tiene la columna description, usa la OPCIÓN 2.
Si no la tiene y no la necesitas, la versión simple funciona perfectamente.
*/