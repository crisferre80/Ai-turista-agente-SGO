# 🔧 Solución: Error 400 - Columnas faltantes en business_profiles

## ❌ Problema

```
GET https://...supabase.co/rest/v1/business_profiles?select=...lat...lng 400 (Bad Request)
column business_profiles.lat does not exist
```

## ✅ Solución

La tabla `business_profiles` necesita las columnas `lat` y `lng` para almacenar coordenadas geográficas.

### Opción 1: Script completo (Recomendado)

Ejecuta el script actualizado que maneja ambas tablas:

```bash
add_missing_columns_only.sql
```

Este script:
- ✅ Agrega `lat` y `lng` a la tabla `businesses`
- ✅ Agrega `lat` y `lng` a la tabla `business_profiles`
- ✅ Verifica que las columnas se hayan creado correctamente

### Opción 2: Solo business_profiles

Si solo necesitas agregar las columnas a `business_profiles`:

```bash
add_coordinates_to_business_profiles.sql
```

## 📝 Pasos para ejecutar en Supabase

1. Ve a tu proyecto en Supabase
2. Abre el **SQL Editor**
3. Crea una nueva query
4. Copia y pega el contenido de uno de los scripts mencionados
5. Ejecuta el script (botón "Run" o `Ctrl/Cmd + Enter`)
6. Verifica los resultados en la consola

## 🔍 Verificación

Después de ejecutar el script, deberías ver mensajes como:

```
NOTICE: Columna lat agregada a business_profiles
NOTICE: Columna lng agregada a business_profiles
```

Y las tablas de verificación mostrarán las columnas `lat` y `lng` con tipo `double precision` o `float8`.

## 🎯 Por qué se necesita esto

Las columnas `lat` y `lng` son necesarias para:
- 📍 Mostrar ubicaciones en el mapa
- 🗺️ Calcular rutas y direcciones
- 📏 Determinar distancias entre lugares
- 🔍 Filtrar negocios por proximidad geográfica

## 🔄 Migración de datos (Opcional)

Si ya tienes datos de coordenadas en la tabla `businesses` y quieres copiarlos a `business_profiles`, descomenta la sección de migración en el script `add_coordinates_to_business_profiles.sql`.

## 📚 Archivos relacionados

- `add_missing_columns_only.sql` - Script principal (maneja ambas tablas)
- `add_coordinates_to_business_profiles.sql` - Script específico para business_profiles
- `add_coordinates_to_businesses.sql` - Script específico para businesses (si existe)
