# Sincronización Automática de Perfiles Business y Negocios

## Problema Resuelto

Los usuarios nuevos con rol `business` en la tabla `profiles` no se conectaban automáticamente con la tabla `businesses`. Esta solución implementa triggers que mantienen automáticamente la sincronización entre ambas tablas.

## Archivos Creados

1. **`business_profile_trigger.sql`** - Triggers principales para sincronización automática
2. **`verify_business_profiles.sql`** - Herramientas de verificación y corrección
3. **`README_business_sync.md`** - Esta documentación

## Funcionamiento de la Solución

### Triggers Implementados

#### 1. `trigger_link_business_to_profile`
- **Se ejecuta**: Cuando se inserta o actualiza un negocio en `businesses`
- **Función**: Automáticamente actualiza el perfil del propietario a rol `business`
- **Comportamiento**: 
  - Si el perfil existe: actualiza el rol a `business`
  - Si no existe: crea un perfil con rol `business`

#### 2. `trigger_handle_business_profile`
- **Se ejecuta**: Cuando se inserta o actualiza un perfil con rol `business`
- **Función**: Automáticamente crea un negocio placeholder si no existe
- **Comportamiento**: Crea un negocio inactivo que el usuario puede completar

### Campos Agregados

- **`profiles.updated_at`**: Timestamp automático de última modificación
- **Trigger de actualización**: Mantiene `updated_at` siempre actualizado

## Instrucciones de Implementación

### Paso 1: Ejecutar los Triggers
```sql
-- En el SQL Editor de Supabase, ejecutar todo el contenido de:
-- business_profile_trigger.sql
```

### Paso 2: Sincronizar Datos Existentes
```sql
-- Ejecutar la función de sincronización una sola vez:
SELECT sync_existing_business_profiles();
```

### Paso 3: Verificar la Implementación
```sql
-- Ejecutar herramientas de verificación:
-- (todo el contenido de verify_business_profiles.sql)

-- Ver estadísticas:
SELECT * FROM business_profile_stats();

-- Corregir inconsistencias si las hay:
SELECT * FROM fix_business_profile_inconsistencies();
```

## Comportamiento del Sistema

### Escenario 1: Registro Normal de Negocio
1. Usuario se registra con email/password
2. Se crea perfil con `role = 'business'` 
3. **TRIGGER AUTOMÁTICO**: Se crea negocio placeholder
4. Se completan los datos del negocio
5. **TRIGGER AUTOMÁTICO**: Se confirma el rol business del perfil

### Escenario 2: Creación Manual de Negocio
1. Admin crea negocio con `owner_id`
2. **TRIGGER AUTOMÁTICO**: Se actualiza/crea el perfil con rol `business`

### Escenario 3: Cambio de Rol a Business
1. Usuario existente cambia rol a `business`
2. **TRIGGER AUTOMÁTICO**: Se crea negocio placeholder automáticamente

## Estados de Negocios

### Negocio Activo (`is_active = true`)
- Usuario completó toda la información
- Negocio visible en la aplicación
- Puede recibir reseñas y aparecer en búsquedas

### Negocio Inactivo (`is_active = false`)
- Negocio recién creado o placeholder
- No aparece en búsquedas públicas
- Usuario debe completar información para activar

## Verificaciones y Mantenimiento

### Verificar Problemas
```sql
-- Perfiles business sin negocio
SELECT p.id, p.name FROM profiles p
WHERE p.role = 'business' 
  AND NOT EXISTS (SELECT 1 FROM businesses b WHERE b.owner_id = p.id);

-- Negocios sin perfil business
SELECT b.id, b.name, p.role FROM businesses b
LEFT JOIN profiles p ON p.id = b.owner_id
WHERE p.role != 'business' OR p.id IS NULL;
```

### Estadísticas del Sistema
```sql
SELECT * FROM business_profile_stats();
```

### Corrección Automática
```sql
SELECT * FROM fix_business_profile_inconsistencies();
```

## Ventajas de la Solución

1. **Sincronización Automática**: No requiere intervención manual
2. **Retrocompatible**: Funciona con datos existentes
3. **Seguridad**: No elimina datos, solo sincroniza
4. **Mantenimiento**: Herramientas de verificación incluidas
5. **Escalable**: Se ejecuta automáticamente para todos los registros futuros

## Notas Técnicas

- Los triggers usan `AFTER INSERT/UPDATE` para no interferir con la operación principal
- Se incluye manejo de errores y conflictos
- Los negocios placeholder permiten completar información gradualmente
- Se mantiene integridad referencial en todo momento

## Monitoreo

Para monitorear el funcionamiento correcto:

```sql
-- Ver actividad reciente
SELECT 
  p.name,
  p.role,
  p.created_at,
  p.updated_at,
  b.name as business_name,
  b.is_active
FROM profiles p
LEFT JOIN businesses b ON b.owner_id = p.id
WHERE p.role = 'business'
ORDER BY p.updated_at DESC
LIMIT 10;
```

## Solución de Problemas

### Si un negocio no se vincula automáticamente:
1. Verificar que el `owner_id` esté correctamente asignado
2. Ejecutar manualmente: `SELECT sync_existing_business_profiles();`
3. Revisar logs de Supabase para errores de triggers

### Si un perfil no se actualiza a business:
1. Verificar que el negocio tenga `owner_id` válido
2. Ejecutar corrección: `SELECT * FROM fix_business_profile_inconsistencies();`