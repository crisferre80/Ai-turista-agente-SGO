-- ==========================================
-- SCRIPT DE VERIFICACIÓN Y CORRECCIÓN
-- Verificar la integridad entre perfiles y negocios
-- ==========================================

-- Verificar perfiles con rol 'business' que no tienen negocio asociado
SELECT 
  p.id,
  p.name,
  p.role,
  p.created_at as profile_created,
  'NO TIENE NEGOCIO ASOCIADO' as status
FROM profiles p
WHERE p.role = 'business' 
  AND NOT EXISTS (
    SELECT 1 FROM businesses b WHERE b.owner_id = p.id
  );

-- Verificar negocios que no tienen perfil con rol 'business'
SELECT 
  b.id as business_id,
  b.name as business_name,
  b.owner_id,
  p.role as current_role,
  'PERFIL CON ROL INCORRECTO O INEXISTENTE' as status
FROM businesses b
LEFT JOIN profiles p ON p.id = b.owner_id
WHERE p.role != 'business' OR p.id IS NULL;

-- Verificar negocios huérfanos (sin owner_id)
SELECT 
  b.id,
  b.name,
  b.owner_id,
  'NEGOCIO SIN PROPIETARIO' as status
FROM businesses b
WHERE b.owner_id IS NULL;

-- ==========================================
-- FUNCIÓN DE CORRECCIÓN AUTOMÁTICA
-- ==========================================

CREATE OR REPLACE FUNCTION fix_business_profile_inconsistencies()
RETURNS TABLE(
  action TEXT,
  affected_id UUID,
  description TEXT
) AS $$
DECLARE
  rec RECORD;
  fixed_count INTEGER := 0;
BEGIN
  -- 1. Corregir perfiles con rol 'business' sin negocio
  FOR rec IN 
    SELECT p.id, p.name
    FROM profiles p
    WHERE p.role = 'business' 
      AND NOT EXISTS (SELECT 1 FROM businesses b WHERE b.owner_id = p.id)
  LOOP
    INSERT INTO businesses (
      owner_id, 
      name, 
      description,
      is_active,
      created_at
    ) VALUES (
      rec.id,
      COALESCE(rec.name, 'Negocio Pendiente'),
      'Negocio creado automáticamente. Completa la información desde tu perfil.',
      FALSE,
      NOW()
    );
    
    fixed_count := fixed_count + 1;
    
    RETURN QUERY VALUES (
      'CREAR_NEGOCIO'::TEXT,
      rec.id,
      'Creado negocio para perfil business: ' || COALESCE(rec.name, 'Sin nombre')
    );
  END LOOP;
  
  -- 2. Corregir negocios con perfiles que no tienen rol 'business'
  FOR rec IN 
    SELECT b.owner_id, b.name, p.role
    FROM businesses b
    JOIN profiles p ON p.id = b.owner_id
    WHERE p.role != 'business'
  LOOP
    UPDATE profiles 
    SET role = 'business',
        updated_at = NOW()
    WHERE id = rec.owner_id;
    
    fixed_count := fixed_count + 1;
    
    RETURN QUERY VALUES (
      'ACTUALIZAR_ROL'::TEXT,
      rec.owner_id,
      'Cambiado rol de "' || rec.role || '" a "business" para negocio: ' || rec.name
    );
  END LOOP;
  
  -- 3. Reportar negocios huérfanos (requieren atención manual)
  FOR rec IN 
    SELECT b.id, b.name
    FROM businesses b
    WHERE b.owner_id IS NULL
  LOOP
    RETURN QUERY VALUES (
      'ATENCION_MANUAL'::TEXT,
      rec.id,
      'Negocio huérfano requiere propietario: ' || rec.name
    );
  END LOOP;
  
  -- Mensaje final
  RETURN QUERY VALUES (
    'RESUMEN'::TEXT,
    NULL::UUID,
    'Total de correcciones automáticas realizadas: ' || fixed_count::TEXT
  );
  
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- FUNCIÓN PARA ESTADÍSTICAS DETALLADAS
-- ==========================================

CREATE OR REPLACE FUNCTION business_profile_stats()
RETURNS TABLE(
  metric TEXT,
  count BIGINT,
  percentage NUMERIC
) AS $$
DECLARE
  total_profiles BIGINT;
  total_businesses BIGINT;
BEGIN
  -- Obtener totales
  SELECT COUNT(*) INTO total_profiles FROM profiles;
  SELECT COUNT(*) INTO total_businesses FROM businesses;
  
  -- Estadísticas generales
  RETURN QUERY VALUES 
    ('Total Perfiles', total_profiles, 100.0);
  
  RETURN QUERY VALUES 
    ('Total Negocios', total_businesses, 100.0);
  
  -- Perfiles por rol
  RETURN QUERY 
    SELECT 
      'Perfiles ' || UPPER(role) as metric,
      COUNT(*) as count,
      ROUND((COUNT(*) * 100.0) / NULLIF(total_profiles, 0), 2) as percentage
    FROM profiles 
    GROUP BY role
    ORDER BY COUNT(*) DESC;
  
  -- Negocios por estado
  RETURN QUERY 
    SELECT 
      'Negocios ' || CASE WHEN is_active THEN 'ACTIVOS' ELSE 'INACTIVOS' END as metric,
      COUNT(*) as count,
      ROUND((COUNT(*) * 100.0) / NULLIF(total_businesses, 0), 2) as percentage
    FROM businesses 
    GROUP BY is_active;
  
  -- Problemas detectados
  RETURN QUERY 
    SELECT 
      'Perfiles BUSINESS sin negocio' as metric,
      COUNT(*) as count,
      ROUND((COUNT(*) * 100.0) / NULLIF(total_profiles, 0), 2) as percentage
    FROM profiles p
    WHERE p.role = 'business' 
      AND NOT EXISTS (SELECT 1 FROM businesses b WHERE b.owner_id = p.id);
  
  RETURN QUERY 
    SELECT 
      'Negocios con rol incorrecto' as metric,
      COUNT(*) as count,
      ROUND((COUNT(*) * 100.0) / NULLIF(total_businesses, 0), 2) as percentage
    FROM businesses b
    JOIN profiles p ON p.id = b.owner_id
    WHERE p.role != 'business';
    
  RETURN QUERY 
    SELECT 
      'Negocios huérfanos' as metric,
      COUNT(*) as count,
      ROUND((COUNT(*) * 100.0) / NULLIF(total_businesses, 0), 2) as percentage
    FROM businesses b
    WHERE b.owner_id IS NULL;

END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- INSTRUCCIONES DE USO
-- ==========================================

/*
PARA EJECUTAR LAS VERIFICACIONES Y CORRECCIONES:

1. Ver estadísticas generales:
   SELECT * FROM business_profile_stats();

2. Verificar problemas específicos (ejecutar las queries SELECT al inicio de este archivo)

3. Corregir automáticamente:
   SELECT * FROM fix_business_profile_inconsistencies();

4. Volver a verificar estadísticas:
   SELECT * FROM business_profile_stats();

NOTAS IMPORTANTES:
- Ejecuta primero business_profile_trigger.sql antes que este archivo
- La función fix_business_profile_inconsistencies() es segura y no elimina datos
- Los negocios huérfanos requerirán atención manual
- Después de ejecutar las correcciones, los triggers mantendrán la consistencia automáticamente
*/