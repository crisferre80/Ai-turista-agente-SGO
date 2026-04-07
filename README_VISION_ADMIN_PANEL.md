# 🎥 Panel de Visión IA - Sistema de Análisis en Tiempo Real

## 📋 Resumen

Se ha implementado un **sistema completo de análisis de visión por computadora** en el panel de administración que permite:

- ✅ **Visor de cámara en tiempo real** con detección de objetos y personas
- ✅ **Análisis automático** usando YOLO y MediaPipe
- ✅ **Almacenamiento de registros** en base de datos
- ✅ **Estadísticas agregadas** de análisis
- ✅ **Configuración personalizable** del sistema
- ✅ **Visualización con overlays** en el canvas

---

## 🏗️ Arquitectura Implementada

### Componentes Creados

```
📦 Sistema de Visión IA
├── 🎨 Frontend
│   └── src/components/admin/VisionAnalysisPanel.tsx
│       └── Componente principal con:
│           ├── Visor de cámara con canvas overlay
│           ├── Panel de configuración
│           ├── Visualización de estadísticas
│           └── Historial de análisis
│
├── 🔌 Backend API
│   ├── src/app/api/vision/analyze/route.ts
│   │   └── Endpoint para análisis de imágenes
│   ├── src/app/api/vision/save/route.ts
│   │   └── Endpoint para guardar análisis
│   └── src/app/api/vision/records/route.ts
│       └── Endpoint para obtener registros
│
├── 🗄️ Base de Datos
│   ├── supabase/migrations/20260407000000_vision_analysis_records.sql
│   │   └── Tabla de registros + vistas + funciones
│   └── supabase/migrations/20260407000001_vision_snapshots_bucket.sql
│       └── Bucket de storage para capturas
│
└── 🔗 Integración
    └── src/app/admin/page.tsx
        └── Tab "Visión IA" integrado en el panel
```

---

## 🚀 Características Principales

### 1. **Visor de Cámara en Tiempo Real**

- Acceso a la cámara del dispositivo
- Canvas overlay para mostrar detecciones
- Bounding boxes coloreados por tipo de objeto
- Indicadores de pose (señalando, gestos)
- Contador de personas en tiempo real

### 2. **Detecciones Implementadas**

#### YOLO (Objetos)
- Personas
- Objetos turísticos (mochilas, maletas, cámaras)
- Mobiliario urbano
- Vehículos

#### MediaPipe (Poses)
- Detección de poses corporales
- Identificación de gestos (señalar)
- Análisis de postura

#### Análisis de Grupos
- Clasificación: solo, pareja, familia, grupo grande
- Detección de niños
- Necesidades de accesibilidad

### 3. **Configuración Personalizable**

```typescript
{
  enableYolo: boolean,           // Activar/desactivar YOLO
  enableMediaPipe: boolean,      // Activar/desactivar MediaPipe
  enableFaceRecognition: boolean, // Reconocimiento facial
  detectionInterval: number,     // Intervalo de análisis (ms)
  confidenceThreshold: number,   // Umbral de confianza (0-1)
  saveSnapshots: boolean         // Guardar capturas
}
```

### 4. **Almacenamiento y Estadísticas**

#### Datos Almacenados
- Contador de personas
- Tipo de grupo
- Objetos detectados
- Puntuación de confianza
- Tiempo de procesamiento
- Snapshot (opcional)

#### Estadísticas Calculadas
- Total de análisis realizados
- Promedio de personas detectadas
- Tiempo promedio de procesamiento
- Objetos más comúnmente detectados

---

## 📊 Tabla de Base de Datos

### `vision_analysis_records`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único |
| `created_at` | TIMESTAMPTZ | Fecha de creación |
| `people_count` | INTEGER | Número de personas |
| `group_type` | TEXT | Tipo de grupo |
| `detected_objects` | TEXT[] | Array de objetos |
| `confidence_score` | DECIMAL | Confianza (0-1) |
| `processing_time` | INTEGER | Tiempo en ms |
| `snapshot_url` | TEXT | URL de captura |
| `yolo_detections` | JSONB | Detecciones completas |
| `suggestions` | JSONB | Sugerencias generadas |

### Funciones SQL

#### `get_most_common_objects(limit_count)`
Devuelve los objetos más detectados en los últimos 30 días.

```sql
SELECT * FROM get_most_common_objects(10);
```

---

## 🔌 API Endpoints

### POST `/api/vision/analyze`

Analiza una imagen y devuelve detecciones.

**Request:**
```typescript
FormData {
  image: Blob,        // Imagen a analizar
  config: string      // JSON con configuración
}
```

**Response:**
```typescript
{
  yoloDetections: YOLODetection[],
  poseAnalysis: PoseDetectionResult,
  faceRecognition: FaceRecognitionResult,
  groupAnalysis: GroupAnalysis,
  objectContext: ObjectContext,
  suggestions: Suggestion[],
  timestamp: number,
  processingTime: number,
  confidenceScore: number
}
```

### POST `/api/vision/save`

Guarda un análisis en la base de datos.

**Request:**
```typescript
FormData {
  analysis: string,   // JSON con datos del análisis
  snapshot: Blob      // Imagen capturada (opcional)
}
```

**Response:**
```typescript
{
  success: boolean,
  record: VisionRecord
}
```

### GET `/api/vision/records`

Obtiene registros y estadísticas.

**Response:**
```typescript
{
  records: VisionRecord[],  // Últimos 100 registros
  stats: {
    totalAnalyses: number,
    avgPeopleCount: number,
    avgProcessingTime: number,
    mostCommonObjects: string[]
  }
}
```

### DELETE `/api/vision/records`

Elimina registros más antiguos de 30 días.

---

## 🎨 Interfaz de Usuario

### Panel de Control
- Botón **Iniciar/Detener** análisis
- Botón **Capturar Frame** manual
- Botón **Actualizar** registros

### Visor de Cámara
- Video en tiempo real
- Canvas overlay con detecciones
- Bounding boxes coloreadas
- Indicadores en pantalla

### Configuración
- Checkboxes para habilitar/deshabilitar detectores
- Sliders para:
  - Intervalo de análisis (500-5000ms)
  - Umbral de confianza (0-100%)

### Estadísticas
- Total de análisis
- Promedio de personas
- Tiempo de procesamiento
- Objetos más detectados (badges)

### Historial
- Tabla con últimos 50 registros
- Columnas: Fecha, Personas, Tipo, Objetos, Confianza, Tiempo
- Ordenado por fecha descendente

---

## 🔐 Seguridad

### Row Level Security (RLS)

- ✅ Solo admins pueden ver registros
- ✅ Solo admins pueden crear registros
- ✅ Solo admins pueden eliminar registros

### Storage Policies

- ✅ Solo admins pueden subir snapshots
- ✅ Bucket público para visualización
- ✅ Solo admins pueden eliminar snapshots

---

## 🎯 Casos de Uso

### 1. **Monitoreo de Flujo de Visitantes**
Analizar patrones de visita en tiempo real:
- Horarios pico
- Tipos de grupos más comunes
- Objetos transportados

### 2. **Análisis de Comportamiento**
Identificar comportamientos de interés:
- Personas señalando monumentos
- Grupos con necesidades especiales
- Turistas vs. locales (por equipaje)

### 3. **Generación de Sugerencias**
El sistema genera automáticamente:
- Saludos personalizados
- Recomendaciones de actividades
- Información de accesibilidad

### 4. **Estadísticas Históricas**
Análisis agregado para:
- Reportes de afluencia
- Tendencias temporales
- Optimización de recursos

---

## 🔧 Configuración e Instalación

### 1. **Ejecutar Migraciones**

```bash
# Aplicar migraciones en Supabase
npx supabase migration up
```

O ejecutar manualmente en el SQL Editor de Supabase:
- `supabase/migrations/20260407000000_vision_analysis_records.sql`
- `supabase/migrations/20260407000001_vision_snapshots_bucket.sql`

### 2. **Verificar Permisos de Cámara**

El navegador solicitará permisos para acceder a la cámara. Asegúrate de:
- Usar HTTPS en producción
- Aceptar permisos cuando se soliciten

### 3. **Acceder al Panel**

1. Ir a `/admin` (requiere rol de admin)
2. Click en el tab **"👁️ Visión IA"**
3. Click en **"▶️ Iniciar Análisis"**

---

## 📝 Notas Técnicas

### Implementación Actual

⚠️ **IMPORTANTE**: La versión actual usa **datos simulados** para el análisis. Para integrar YOLO/MediaPipe real:

1. **Modificar** `/api/vision/analyze/route.ts`
2. **Importar** el orquestador de visión existente:
   ```typescript
   import { analyzeScene } from '@/lib/vision/vision-orchestrator';
   ```
3. **Reemplazar** los datos mock con análisis real

### Optimizaciones Futuras

- [ ] Implementar análisis real con YOLO/MediaPipe en el servidor
- [ ] Añadir procesamiento por lotes para múltiples frames
- [ ] Implementar caché de detecciones frecuentes
- [ ] Añadir compresión de imágenes antes de enviar
- [ ] Implementar WebWorkers para procesamiento en cliente
- [ ] Añadir exportación de reportes en PDF

### Consideraciones de Rendimiento

- **Intervalo recomendado**: 2000ms (2 segundos)
- **Resolución de cámara**: 1280x720 (HD)
- **Tamaño de snapshot**: ~100-200KB (JPEG 80%)
- **Tiempo de análisis**: ~100-300ms (simulado)

---

## 🐛 Troubleshooting

### Problema: La cámara no inicia

**Solución:**
1. Verificar permisos del navegador
2. Asegurar que la app esté en HTTPS
3. Revisar consola para errores

### Problema: No se guardan los análisis

**Solución:**
1. Verificar que las migraciones se aplicaron
2. Comprobar que el usuario es admin
3. Revisar logs del servidor

### Problema: Los overlays no se muestran

**Solución:**
1. Verificar que el canvas tenga el tamaño correcto
2. Revisar que las detecciones tengan bbox válidos
3. Comprobar z-index del canvas

---

## 📚 Referencias

- [Sistema de Visión AI Completo](README_VISION_AI_SYSTEM.md)
- [Configuración YOLO](README_YOLO_SETUP.md)
- [Quickstart YOLO](QUICKSTART_YOLO.md)
- [Tipos TypeScript](src/types/vision.ts)
- [Vision Orchestrator](src/lib/vision/vision-orchestrator.ts)

---

## 👥 Autor

Sistema implementado para **SantiGuía** - Asistente Turístico Virtual de Santiago del Estero

---

## 📅 Última Actualización

**Fecha**: 7 de abril de 2026  
**Versión**: 1.0.0
