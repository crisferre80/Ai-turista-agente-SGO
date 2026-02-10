# Sistema de Promociones Automáticas - Santi Avatar

## Descripción General
El sistema de promociones automáticas permite que Santi (el robot avatar) mencione negocios o lugares destacados de manera programada y automática según configuraciones específicas de tiempo y frecuencia.

## Componentes del Sistema

### 1. Panel de Administración
**Ubicación**: `/admin/auto-promotions`

**Características**:
- Interfaz completa para gestionar promociones automáticas
- Estadísticas en tiempo real (total, activas, inactivas)
- Tabla con filtros y acciones (editar, eliminar, activar/desactivar)
- Formulario modal para crear/editar promociones

**Campos de configuración**:
- **Negocio/Lugar**: Selección desde la base de datos de businesses
- **Título**: Nombre descriptivo de la promoción
- **Mensaje**: Texto que dirá Santi (se limpia automáticamente para TTS)
- **Frecuencia**: Tres tipos disponibles:
  - **Por hora**: Cuántas veces por hora (1-60)
  - **Por día**: Cuántas veces por día (1-24)  
  - **Personalizado**: Cada X minutos
- **Horario**: Opcional, define ventana de tiempo (HH:MM - HH:MM)
- **Días de la semana**: Selección múltiple (Dom-Sáb)
- **Prioridad**: Escala 1-10 (mayor número = mayor prioridad)
- **Estado**: Activa/Inactiva

### 2. API Endpoints

#### `/api/admin/auto-promotions` (GET, POST, DELETE)
- **GET**: Lista todas las promociones con datos de negocios
- **POST**: Crea o actualiza una promoción 
- **DELETE**: Elimina una promoción por ID

#### `/api/admin/auto-promotions/toggle` (POST)
- Activa/desactiva una promoción específica

#### `/api/admin/auto-promotions/scheduler` (GET)
- Motor principal del sistema
- Evalúa promociones activas según:
  - Frecuencia configurada
  - Horarios permitidos
  - Días de la semana
  - Tiempo transcurrido desde última ejecución
- Retorna promociones que deben ejecutarse ordenadas por prioridad

#### `/api/admin/businesses` (GET)
- Lista negocios disponibles para promocionar

#### `/api/auto-promotion` (GET)
- Endpoint público que consulta el scheduler
- Retorna la promoción de mayor prioridad lista para ejecutar

### 3. Base de Datos

#### Tabla `auto_promotions`
```sql
CREATE TABLE auto_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    frequency_type VARCHAR(20) CHECK (frequency_type IN ('hourly', 'daily', 'custom')),
    frequency_value INTEGER CHECK (frequency_value > 0),
    is_active BOOLEAN DEFAULT true,
    start_time TIME,
    end_time TIME,
    days_of_week JSONB DEFAULT '[]'::jsonb,
    priority INTEGER CHECK (priority >= 1 AND priority <= 10),
    last_executed TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Índices para rendimiento**:
- `idx_auto_promotions_active`
- `idx_auto_promotions_priority`
- `idx_auto_promotions_frequency`
- `idx_auto_promotions_business`
- `idx_auto_promotions_last_executed`

### 4. Integración con ChatInterface

#### Sistema de Verificación Automática
- **Intervalo**: Cada 2 minutos (120000ms)
- **Condiciones**: Solo ejecuta si Santi no está hablando, escuchando o procesando
- **Cooldown**: 30 segundos desde última interacción del usuario

#### Flujo de Ejecución
1. `ChatInterface` consulta `/api/auto-promotion` cada 2 minutos
2. Si hay promoción disponible:
   - Agrega mensaje al chat con formato: `🎯 **{business_name}**: {message}`
   - Reproduce audio usando `playAudioResponse()`
   - Actualiza tiempo de interacción para evitar spam

### 5. Algoritmo de Programación

#### Evaluación de Frecuencia
- **Hourly**: `intervalo = 60 minutos / frequency_value`
- **Daily**: `intervalo = 24 horas / frequency_value`
- **Custom**: `intervalo = frequency_value minutos`

#### Filtros de Ejecución
1. **Horario**: Verifica si hora actual está en rango start_time - end_time
2. **Días**: Verifica si día actual está en array days_of_week (0=Domingo)
3. **Frecuencia**: Compara tiempo desde last_executed con intervalo calculado
4. **Prioridad**: Ordena resultados por priority DESC

## Configuración Recomendada

### Ejemplos de Configuración
1. **Promoción Matutina**:
   - Frecuencia: 1 vez por día
   - Horario: 08:00 - 12:00
   - Días: Lun-Vie
   - Prioridad: 8

2. **Promoción de Almuerzo**:
   - Frecuencia: 2 veces por día
   - Horario: 11:30 - 14:30
   - Días: Todos
   - Prioridad: 9

3. **Promoción Nocturna**:
   - Frecuencia: Cada 90 minutos
   - Horario: 18:00 - 23:00
   - Días: Vie-Sáb
   - Prioridad: 7

### Buenas Prácticas
- **Mensaje Natural**: Usar lenguaje conversacional argentino
- **Prioridad Balanceada**: No poner todo en prioridad 10
- **Frecuencia Moderada**: Evitar spam (máximo 1 por hora en horarios pico)
- **Horarios Lógicos**: Restaurantes en horarios de comida, etc.

## Acceso al Sistema
1. Ir al panel de administración: `/admin`
2. Clic en "🤖 Promociones Automáticas"
3. Crear nueva promoción con el botón amarillo
4. Configurar todos los campos según necesidad
5. Activar promoción
6. Santi comenzará a mencionarla automáticamente

## Monitoreo
- **Estadísticas**: Panel principal muestra contadores en tiempo real
- **Logs**: Consola del navegador muestra cuando Santi ejecuta promociones
- **Estado**: Tabla indica última ejecución y estado activo/inactivo