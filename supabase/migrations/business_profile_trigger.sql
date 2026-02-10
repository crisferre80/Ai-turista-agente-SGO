-- ==========================================
-- TRIGGER PARA VINCULAR PERFILES CON NEGOCIOS
-- Ejecuta esto en el SQL Editor de Supabase
-- ==========================================

-- Función que se ejecutará cuando se inserte o actualice un negocio
CREATE OR REPLACE FUNCTION link_business_to_profile()
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

-- Crear el trigger que se ejecuta DESPUÉS de insertar o actualizar un negocio
DROP TRIGGER IF EXISTS trigger_link_business_to_profile ON businesses;
CREATE TRIGGER trigger_link_business_to_profile
  AFTER INSERT OR UPDATE OF owner_id ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION link_business_to_profile();

-- ==========================================
-- TRIGGER INVERSO: CUANDO SE CREA UN PERFIL CON ROL BUSINESS
-- ==========================================

-- Función para manejar cuando se crea un perfil con rol business sin negocio
CREATE OR REPLACE FUNCTION handle_business_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el nuevo perfil tiene rol 'business' y no existe un negocio asociado
  IF NEW.role = 'business' AND NOT EXISTS (SELECT 1 FROM businesses WHERE owner_id = NEW.id) THEN
    -- Crear un negocio placeholder que luego puede ser completado
    INSERT INTO businesses (
      owner_id, 
      name
    ) VALUES (
      NEW.id,
      COALESCE(NEW.name, 'Negocio de ' || COALESCE(NEW.name, 'Usuario'))
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear el trigger que se ejecuta DESPUÉS de insertar o actualizar un perfil
DROP TRIGGER IF EXISTS trigger_handle_business_profile ON profiles;
CREATE TRIGGER trigger_handle_business_profile
  AFTER INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_business_profile();

-- ==========================================
-- FUNCIÓN AUXILIAR PARA SINCRONIZAR DATOS EXISTENTES
-- ==========================================

-- Función para sincronizar los datos existentes (ejecutar una sola vez)
CREATE OR REPLACE FUNCTION sync_existing_business_profiles()
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
      name
    ) VALUES (
      profile_record.id,
      COALESCE(profile_record.name, 'Negocio de ' || COALESCE(profile_record.name, 'Usuario'))
    );
    
    sync_count := sync_count + 1;
  END LOOP;

  RETURN 'Sincronización completada. ' || sync_count::TEXT || ' registros procesados.';
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- AGREGAR CAMPOS FALTANTES A LA TABLA PROFILES (si no existen)
-- ==========================================

-- Agregar campo updated_at si no existe
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'updated_at') THEN
    ALTER TABLE profiles ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para actualizar updated_at en profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- INSTRUCCIONES DE USO
-- ==========================================

/*
INSTRUCCIONES:

1. Ejecuta todo este archivo en el SQL Editor de Supabase
2. Una vez ejecutado, ejecuta la función de sincronización para datos existentes:
   SELECT sync_existing_business_profiles();

COMPORTAMIENTO:
- Cuando se registra un negocio con owner_id, automáticamente se actualiza el perfil a rol 'business'
- Cuando se crea un perfil con rol 'business', automáticamente se crea un negocio placeholder
- Los triggers mantienen la sincronización entre ambas tablas
- La función de sincronización permite arreglar datos existentes que puedan estar desvinculados

NOTAS:
- Los negocios creados automáticamente empiezan con is_active = FALSE
- El propietario debe completar la información del negocio para activarlo
- Se mantiene un campo updated_at para tracking de cambios
*/