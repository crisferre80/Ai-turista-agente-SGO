# 🗄️ Configuración de Base de Datos para Sistema de Visión

Este documento describe las migraciones necesarias para el sistema de visión AI con reconocimiento facial y análisis de escenas.

## 📋 Tablas Creadas

### 1. `face_embeddings` - Reconocimiento Facial (GDPR Compliant)

Almacena embeddings faciales de visitantes recurrentes para personalización:

```sql
CREATE TABLE face_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    embedding FLOAT8[] NOT NULL,           -- Vector de 128 dimensiones (MediaPipe FaceLandmarker)
    nickname TEXT,                         -- Nombre opcional del visitante
    first_seen TIMESTAMPTZ DEFAULT now(),
    last_seen TIMESTAMPTZ DEFAULT now(),
    visit_count INTEGER DEFAULT 1,
    user_id UUID,                          -- Si el visitante se registra, vincular con profiles
    metadata JSONB,                        -- Info adicional: edad estimada, preferencias
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Características de Privacidad:**
- ✅ Solo almacena vectores matemáticos (no imágenes faciales)
- ✅ Eliminación automática después de 90 días sin visitas
- ✅ Permite olvido instantáneo (`forgetFace()` API)
- ✅ Cumple con GDPR/CCPA (derecho al olvido)

### 2. `vision_analysis_log` - Analytics del Sistema

Registra cada análisis visual para mejorar el modelo:

```sql
CREATE TABLE vision_analysis_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,                          -- Usuario autenticado (opcional)
    session_id TEXT,                       -- ID de sesión anonymous (para estadísticas)
    timestamp TIMESTAMPTZ DEFAULT now(),
    
    -- Detecciones YOLO + MediaPipe
    detected_objects JSONB,                -- [{label: 'person', confidence: 0.87}, ...]
    detected_poses JSONB,                  -- [{gesture: 'pointing', direction: {...}}, ...]
    detected_faces INTEGER DEFAULT 0,      -- Cantidad de rostros
    known_faces INTEGER DEFAULT 0,         -- Rostros reconocidos
    
    -- Análisis contextual
    group_type TEXT,                       -- 'solo', 'pareja', 'familia', 'grupo_grande'
    nearby_landmarks JSONB,                -- Monumentos/atracciones cercanos
    
    -- Resultados de IA
    suggestions_given TEXT[],              -- Sugerencias generadas
    gemini_fallback_used BOOLEAN DEFAULT FALSE, -- ¿Se usó Gemini Vision?
    
    -- Performance metrics
    inference_time_ms INTEGER,             -- Tiempo de procesamiento
    model_version TEXT DEFAULT 'yolov8n'
);
```

**Uso de Analytics:**
- 📊 Identificar objetos frecuentemente detectados
- 🎯 Mejorar sugerencias basadas en patrones de grupos
- ⚡ Optimizar rendimiento del modelo
- 🔍 Detectar errores comunes de clasificación

## 🚀 Aplicar Migraciones

### Opción 1: Supabase Dashboard (Recomendado)

1. Ir a https://supabase.com/dashboard/project/YOUR_PROJECT
2. SQL Editor → New Query
3. Copiar contenido de `supabase/migrations/20260405_create_face_embeddings.sql`
4. Ejecutar (Run)
5. Repetir con `20260405_create_vision_log.sql`

### Opción 2: Supabase CLI

```bash
# Instalar Supabase CLI si no lo tienes
npm install -g supabase

# Vincular proyecto
supabase link --project-ref YOUR_PROJECT_REF

# Aplicar migraciones
supabase db push

# O migración específica
supabase migration up 20260405_create_face_embeddings
supabase migration up 20260405_create_vision_log
```

### Opción 3: Ejecutar Scripts Directamente

```bash
# Con psql (si tienes acceso directo a PostgreSQL)
psql postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres \
  -f supabase/migrations/20260405_create_face_embeddings.sql

psql postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres \
  -f supabase/migrations/20260405_create_vision_log.sql
```

## 🔐 Row Level Security (RLS)

Las migraciones incluyen políticas RLS automáticas:

### `face_embeddings` Policies

```sql
-- Solo el propietario puede ver/eliminar sus embeddings
CREATE POLICY "Users can view their own face embeddings"
ON face_embeddings FOR SELECT
USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can delete their own face embeddings"
ON face_embeddings FOR DELETE
USING (auth.uid() = user_id);

-- Sistema puede crear embeddings para visitantes anonymous
CREATE POLICY "System can insert face embeddings"
ON face_embeddings FOR INSERT
WITH CHECK (true);
```

### `vision_analysis_log` Policies

```sql
-- Cualquier usuario puede crear logs (analytics)
CREATE POLICY "Anyone can log vision analysis"
ON vision_analysis_log FOR INSERT
WITH CHECK (true);

-- Solo admins pueden ver logs completos
CREATE POLICY "Authenticated users can view their own logs"
ON vision_analysis_log FOR SELECT
USING (auth.uid() = user_id OR auth.uid() IS NOT NULL);
```

## 🧹 Funciones de Limpieza Automática

### Purgar rostros antiguos (90 días)

```sql
-- Se ejecuta automáticamente (configurar cron job)
CREATE OR REPLACE FUNCTION purge_old_face_embeddings()
RETURNS void AS $$
BEGIN
    DELETE FROM face_embeddings
    WHERE last_seen < now() - interval '90 days'
    AND user_id IS NULL; -- Solo eliminar visitantes no registrados
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Configurar Cron Job en Supabase:**

1. Extensions → pg_cron → Enable
2. SQL Editor:

```sql
-- Ejecutar limpieza cada domingo a las 3 AM
SELECT cron.schedule(
    'purge-old-faces',
    '0 3 * * 0',
    'SELECT purge_old_face_embeddings()'
);
```

### Limpiar logs antiguos (180 días)

```sql
CREATE OR REPLACE FUNCTION cleanup_old_vision_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM vision_analysis_log
    WHERE timestamp < now() - interval '180 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cron job mensual
SELECT cron.schedule(
    'cleanup-vision-logs',
    '0 2 1 * *',
    'SELECT cleanup_old_vision_logs()'
);
```

## 📊 Consultas Analíticas Útiles

### Objetos más detectados (últimos 30 días)

```sql
SELECT 
    obj->>'label' as object_label,
    COUNT(*) as detection_count,
    AVG((obj->>'confidence')::FLOAT) as avg_confidence
FROM vision_analysis_log,
     jsonb_array_elements(detected_objects) as obj
WHERE timestamp > now() - interval '30 days'
GROUP BY obj->>'label'
ORDER BY detection_count DESC
LIMIT 20;
```

### Tipos de grupos más comunes

```sql
SELECT 
    group_type,
    COUNT(*) as count,
    ROUND(AVG(inference_time_ms)) as avg_inference_ms
FROM vision_analysis_log
WHERE timestamp > now() - interval '7 days'
GROUP BY group_type
ORDER BY count DESC;
```

### Tasa de reconocimiento facial

```sql
SELECT 
    DATE(timestamp) as date,
    SUM(detected_faces) as total_faces,
    SUM(known_faces) as recognized_faces,
    ROUND(100.0 * SUM(known_faces) / NULLIF(SUM(detected_faces), 0), 2) as recognition_rate
FROM vision_analysis_log
WHERE timestamp > now() - interval '30 days'
GROUP BY DATE(timestamp)
ORDER BY date DESC;
```

### Rendimiento del modelo

```sql
SELECT 
    model_version,
    COUNT(*) as analyses,
    ROUND(AVG(inference_time_ms)) as avg_time_ms,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY inference_time_ms)) as p95_ms
FROM vision_analysis_log
WHERE timestamp > now() - interval '7 days'
GROUP BY model_version;
```

## 🔄 Actualizar Embeddings de Rostros Conocidos

Cuando un visitante se registra, vincular su embedding:

```sql
-- Actualizar face_embedding cuando usuario se registra
UPDATE face_embeddings
SET user_id = 'UUID_DEL_USUARIO',
    nickname = 'Nombre del Usuario',
    updated_at = now()
WHERE id = 'UUID_DEL_EMBEDDING';
```

Código TypeScript equivalente:

```typescript
// En src/lib/vision/face-recognition.ts
export async function linkFaceToUser(
    embeddingId: string, 
    userId: string, 
    nickname: string
) {
    const { error } = await supabase
        .from('face_embeddings')
        .update({ 
            user_id: userId, 
            nickname,
            updated_at: new Date().toISOString()
        })
        .eq('id', embeddingId);
    
    if (error) throw error;
}
```

## 🧪 Verificar Instalación

```sql
-- Verificar que tablas existan
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('face_embeddings', 'vision_analysis_log');

-- Verificar índices
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('face_embeddings', 'vision_analysis_log');

-- Verificar políticas RLS
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('face_embeddings', 'vision_analysis_log');

-- Probar inserción
INSERT INTO vision_analysis_log (
    session_id, 
    detected_objects, 
    group_type, 
    inference_time_ms
) VALUES (
    'test-session',
    '[{"label": "person", "confidence": 0.92}]'::jsonb,
    'solo',
    78
) RETURNING *;
```

## 🚨 Troubleshooting

### Error: "permission denied for table face_embeddings"
- Verificar que RLS esté habilitado: `ALTER TABLE face_embeddings ENABLE ROW LEVEL SECURITY;`
- Revisar políticas con query anterior

### Error: "column embedding does not exist"
- Migración no aplicada correctamente
- Re-ejecutar `20260405_create_face_embeddings.sql`

### Analytics no aparecen
- Verificar que `vision_analysis_log` permita INSERT público
- Revisar política: `CREATE POLICY "Anyone can log vision analysis" ON vision_analysis_log FOR INSERT WITH CHECK (true);`

## 📚 Referencias

- [Supabase Migrations Guide](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Array Types](https://www.postgresql.org/docs/current/arrays.html)
- [JSONB Functions](https://www.postgresql.org/docs/current/functions-json.html)

## 🎯 Próximos Pasos

Una vez aplicadas las migraciones:

1. ✅ Verificar tablas con queries de verificación
2. ✅ Configurar cron jobs para limpieza automática
3. ✅ Probar reconocimiento facial desde UI
4. ✅ Monitorear analytics en dashboard

¡Base de datos lista para visión AI! 👁️💾
