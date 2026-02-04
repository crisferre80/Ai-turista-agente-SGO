# 📊 Perfil de Turista Completo - Sistema de Análisis Turístico

## 🎯 Objetivo

Recopilar datos completos de los turistas que visitan Santiago del Estero para realizar análisis de datos turísticos y mejorar la experiencia del visitante.

## ✨ Nuevas Funcionalidades

### 1. **Header Unificado**
- Se agregó el componente `Header` en todas las páginas incluyendo `/profile`
- Consistencia visual en toda la aplicación

### 2. **Formulario de Perfil Expandido**

El formulario ahora incluye **4 secciones principales**:

#### 👤 **Información Personal**
- Edad
- Género (masculino, femenino, otro, prefiero no decir)
- País de origen
- Ciudad de origen
- Teléfono de contacto

#### ✈️ **Información del Viaje**
- **Propósito de la visita**: turismo, negocios, educación, visita familiar, trabajo, otro
- **Tipo de grupo**: solo/a, pareja, familia, amigos, grupo turístico
- **Alojamiento**: hotel, hostel, airbnb, casa familiar, camping, otro
- **Transporte**: auto propio, auto alquilado, bus, avión, tren, bicicleta, caminando
- **Duración del viaje**: días de estadía
- **Presupuesto**: económico, moderado, premium, lujo

#### 💡 **Intereses y Preferencias**
- **Intereses principales** (selección múltiple):
  - Naturaleza
  - Cultura
  - Gastronomía
  - Aventura
  - Relax
  - Historia
  - Fotografía
  - Compras
  - Vida nocturna
  - Deportes
- **Necesidades de accesibilidad**: silla de ruedas, lenguaje de señas, subtítulos, etc.
- **Restricciones alimentarias**: vegetariano, vegano, celíaco, kosher, halal, etc.

#### ⭐ **Experiencia en la Provincia**
- **Frecuencia de visita**: primera vez, ocasional, frecuente, residente
- **Experiencias favoritas**: texto libre sobre lo que más disfrutaron
- **Botón para grabar historia completa**: enlaza a `/storyrecorder`
- **Lugares recomendados**: lugares que otros turistas no deberían perderse
- **¿Volvería a visitar?**: Sí/No con botones interactivos
- **Satisfacción general**: Calificación de 1 a 5 estrellas
- **Sugerencias de mejora**: feedback para mejorar la experiencia turística

### 3. **Integración con Story Recorder**
- Botón directo para que el turista grabe su historia completa en audio
- Conexión directa con la página `/storyrecorder`

## 📊 Análisis de Datos Disponibles

### Vistas SQL Creadas

#### 1. `tourist_analytics`
Vista resumen con estadísticas generales:
- Total de turistas
- Edad promedio
- Distribución por género
- Frecuencia de visita
- Satisfacción promedio
- Duración promedio de estadía
- Porcentaje que volvería
- Distribución por propósito de visita
- Distribución por rango de presupuesto

```sql
SELECT * FROM tourist_analytics;
```

#### 2. `tourist_origin_countries`
Análisis de origen geográfico:
- País y ciudad de origen
- Cantidad de turistas por ubicación
- Satisfacción promedio por ubicación

```sql
SELECT * FROM tourist_origin_countries LIMIT 10;
```

#### 3. `tourist_interests_analysis`
Análisis de intereses:
- Intereses más populares
- Cantidad de turistas por interés

```sql
SELECT * FROM tourist_interests_analysis;
```

### Consultas Útiles

```sql
-- Turistas por rango de edad
SELECT 
    CASE 
        WHEN age BETWEEN 18 AND 25 THEN '18-25'
        WHEN age BETWEEN 26 AND 35 THEN '26-35'
        WHEN age BETWEEN 36 AND 50 THEN '36-50'
        WHEN age > 50 THEN '50+'
        ELSE 'No especificado'
    END as rango_edad,
    COUNT(*) as cantidad
FROM profiles
WHERE role = 'tourist'
GROUP BY rango_edad
ORDER BY cantidad DESC;

-- Satisfacción por tipo de alojamiento
SELECT 
    accommodation_type,
    AVG(overall_satisfaction) as satisfaccion_promedio,
    COUNT(*) as cantidad_turistas
FROM profiles
WHERE role = 'tourist' AND accommodation_type IS NOT NULL
GROUP BY accommodation_type
ORDER BY satisfaccion_promedio DESC;

-- Distribución de presupuesto por país
SELECT 
    country,
    budget_range,
    COUNT(*) as cantidad
FROM profiles
WHERE role = 'tourist' AND country IS NOT NULL
GROUP BY country, budget_range
ORDER BY country, cantidad DESC;
```

## 🗄️ Estructura de la Base de Datos

### Nuevas Columnas en `profiles`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `age` | INT | Edad del turista |
| `gender` | VARCHAR(50) | Género |
| `country` | VARCHAR(100) | País de origen |
| `city` | VARCHAR(100) | Ciudad de origen |
| `email` | VARCHAR(255) | Email de contacto |
| `phone` | VARCHAR(50) | Teléfono |
| `visit_purpose` | VARCHAR(50) | Propósito de la visita |
| `travel_group` | VARCHAR(50) | Con quién viaja |
| `accommodation_type` | VARCHAR(50) | Tipo de alojamiento |
| `transport_mode` | VARCHAR(50) | Medio de transporte |
| `trip_duration` | INT | Duración en días |
| `budget_range` | VARCHAR(50) | Rango de presupuesto |
| `interests` | TEXT[] | Array de intereses |
| `accessibility_needs` | TEXT[] | Necesidades de accesibilidad |
| `dietary_restrictions` | TEXT[] | Restricciones alimentarias |
| `visit_frequency` | VARCHAR(50) | Frecuencia de visita |
| `favorite_experiences` | TEXT | Experiencias favoritas |
| `recommended_places` | TEXT | Lugares recomendados |
| `would_return` | BOOLEAN | ¿Volvería a visitar? |
| `overall_satisfaction` | INT | Satisfacción 1-5 |
| `improvement_suggestions` | TEXT | Sugerencias de mejora |

## 🚀 Instalación

### 1. Ejecutar Script SQL
```bash
# En Supabase SQL Editor, ejecutar:
add_tourist_profile_columns.sql
```

### 2. Verificar Instalación
```sql
-- Verificar que las columnas se crearon correctamente
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;

-- Verificar que las vistas existen
SELECT * FROM tourist_analytics;
```

## 📈 Casos de Uso

### 1. **Dashboard de Análisis Turístico**
Crear un dashboard administrativo que muestre:
- Origen de los turistas (mapa de calor)
- Distribución de edad y género
- Tendencias de satisfacción
- Intereses más populares
- Sugerencias de mejora agrupadas

### 2. **Recomendaciones Personalizadas**
Usar los datos de intereses y preferencias para:
- Sugerir lugares según intereses
- Recomendar restaurantes según restricciones alimentarias
- Filtrar por accesibilidad

### 3. **Mejora Continua**
Analizar las sugerencias y feedback para:
- Identificar áreas de mejora
- Priorizar inversiones en infraestructura
- Mejorar servicios turísticos

### 4. **Marketing Dirigido**
- Identificar mercados principales
- Crear campañas para grupos específicos
- Optimizar presupuestos de publicidad

## 🎨 Diseño de UI

### Colores Utilizados
- **Azul Principal**: `#1A3A6C` - Elementos principales
- **Dorado**: `#F1C40F` - Botones de acción, selecciones
- **Verde**: `#10B981` - Estados positivos
- **Rojo**: `#ef4444` - Estados negativos
- **Gris Oscuro**: `#0e1f1d` - Texto en dorado

### Responsive Design
- **Desktop**: Grid de 2-3 columnas
- **Mobile**: Grid de 1 columna, padding reducido
- **Tablets**: Grid adaptativo con `minmax(250px, 1fr)`

## 📝 Notas Técnicas

### Validación de Datos
- Los campos son opcionales para no forzar al usuario
- Los arrays se guardan como PostgreSQL arrays nativos
- Las fechas se manejan automáticamente con `updated_at`

### Privacidad
- Los datos son privados por defecto (RLS activado)
- Solo el usuario puede ver y editar su perfil
- Los datos agregados (vistas) no exponen información personal

### Performance
- Índices creados en campos frecuentemente consultados
- Vistas materializadas para consultas pesadas (futuro)
- Queries optimizadas para análisis en tiempo real

## 🔗 Enlaces Relacionados

- [Story Recorder](/storyrecorder) - Grabar historias en audio
- [Profile Page](/profile) - Página de perfil del usuario
- [Admin Dashboard](/admin) - Panel de administración (futuro)

## 📞 Soporte

Para preguntas o problemas, contactar al equipo de desarrollo.
