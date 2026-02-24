# Sistema de Mensajes Promocionales - Guía Completa

## 📋 Resumen

Reemplacé el sistema complejo de **auto-promociones con scheduler** por un sistema **mucho más simple** que usa el mismo mecanismo que las recomendaciones de Santi (como "registrarse como negocio").

## ✅ ¿Qué se implementó?

### 1. **Tabla en Base de Datos** (`promotional_messages`)
- Almacena los mensajes promocionales que Santi dirá
- Campos:
  - `business_name`: Nombre del negocio (ej: "Nodo Tecnológico")
  - `message`: Texto completo del mensaje
  - `is_active`: Si está activo o pausado
  - `category`: Categoría (gastronomía, tecnología, general, etc.)
  - `priority`: Prioridad (0-10, mayor = más probabilidad)
  - `show_probability`: % de probabilidad cuando se muestra (default 25%)
  - `image_url`: (opcional) URL de una imagen que se mostrará en un modal junto al mensaje
  - `video_url`: (opcional) URL de un video que se reproducirá en un modal junto al mensaje

### 2. **Panel de Admin - Nueva Sección**
- Ubicación: `/admin` → Pestaña **"💼 Mensajes Promocionales"**
- Funciones:
  - ✅ Crear nuevos mensajes
  - ✅ Pausar/Activar mensajes
  - ✅ Eliminar mensajes
  - ✅ Editar prioridad y probabilidad
  - ✅ Ver todos los mensajes con estado visual

### 3. **ChatInterface Modificado**
- Carga los mensajes desde la BD al iniciar
- Cada **2 minutos de inactividad**, Santi dice:
  - **25% probabilidad**: Mensaje promocional aleatorio (de los activos)
  - **75% probabilidad**: Mensaje de engagement normal
- Los mensajes aparecen naturalmente en el flujo de conversación

## 🚀 Cómo Usar

### Paso 1: Crear la tabla en Supabase

1. Andá a tu dashboard de Supabase
2. Entrá a **SQL Editor**
3. Copiá y pegá el contenido del archivo:
   ```
   setup_promotional_messages_simple.sql
   ```
4. Ejecutá el script
5. Verificá que se crearon 4 mensajes de ejemplo

### Paso 2: Gestionar Mensajes desde el Admin

1. Entrá a `/admin`
2. Clic en **"💼 Mensajes Promocionales"**
3. Para crear un mensaje nuevo:
   - **Nombre del Negocio**: "Nodo Tecnológico"
   - **Mensaje**: El texto completo que Santi dirá
   - **Categoría**: tecnologia, gastronomia, etc.
   - **Prioridad**: 0-10 (mayor número = más importante)
   - **Probabilidad**: 0-100% (default 25%)
   - **Imagen (URL o archivo)**: opcional, se mostrará en un modal cuando Santi diga el mensaje
   - **Video (URL o archivo)**: opcional, se mostrará en un modal cuando Santi diga el mensaje
4. Clic en **"✅ Agregar Mensaje Promocional"**

### Paso 3: Gestionar Mensajes Existentes

- **Pausar/Activar**: Clic en botón "⏸️ Pausar" o "▶️ Activar"
- **Eliminar**: Clic en 🗑️
- Los mensajes pausados aparecen en gris y NO se muestran a los usuarios

## 🎯 ¿Cómo Funciona?

```
Usuario está en la app
     ↓
2 minutos sin interacción
     ↓
Santi verifica si hay mensajes promocionales activos
     ↓
Random 0-100:
   - Si < 25: Mensaje PROMOCIONAL aleatorio
   - Si >= 25: Mensaje de engagement normal
     ↓
Santi dice el mensaje con voz
```

## 📊 Ejemplos de Mensajes

### Nodo Tecnológico (Tecnología)
```
¿Sabías que en Nodo Tecnológico podés encontrar servicio técnico, 
reparación de PC, venta de equipos y más? ¡Visitanos en nuestra sucursal!
```
*Ejemplo con imagen/video: añade una URL de imagen o video en el formulario y se mostrará en un modal cuando Santi lo lea.*

### Restaurante (Gastronomía)
```
Si estás buscando comer rico, te recomiendo pasar por [Nombre del Restaurante]. 
Tienen comida regional espectacular y precios accesibles. ¿Te gustaría ver el 
menú o saber cómo llegar?
```

### Hotel (Hotelería)
```
Para tu estadía en Santiago, Hotel [Nombre] ofrece habitaciones cómodas, 
desayuno incluido y ubicación céntrica. ¿Querés que te muestre fotos y tarifas?
```

## 🔧 Ajustes Finos

### Cambiar la frecuencia
En `ChatInterface.tsx` línea ~707:
```typescript
if (timeSinceLast >= 120000 && ...) { // 120000ms = 2 minutos
```

### Cambiar la probabilidad global
En `ChatInterface.tsx` línea ~711:
```typescript
const pickPromotion = Math.random() < 0.25; // 25%
```

### Cambiar probabilidad por mensaje
En el panel de Admin, editar el campo "Probabilidad (%)" de cada mensaje.

## 📝 Archivos Modificados

1. ✅ `create_promotional_messages_table.sql` - Tabla completa con documentación
2. ✅ `setup_promotional_messages_simple.sql` - Script simplificado para ejecutar
3. ✅ `src/app/admin/page.tsx` - Nueva sección de gestión
4. ✅ `src/components/ChatInterface.tsx` - Carga y usa mensajes desde BD

## 🎉 Ventajas sobre el sistema anterior

| Anterior (Auto-Promotions) | Nuevo (Promotional Messages) |
|----------------------------|------------------------------|
| ❌ Scheduler complejo en backend | ✅ Simple: usa lógica existente |
| ❌ Configuración complicada | ✅ Panel intuitivo |
| ❌ No funcionaba | ✅ Funciona inmediatamente |
| ❌ Difícil de debuggear | ✅ Logs claros en consola |
| ❌ Horarios/días complejos | ✅ Siempre activo, simple on/off |

## 🐛 Testing

1. Abrí la app en `http://localhost:3000`
2. Esperá 2 minutos sin interactuar
3. Santi debería decir un mensaje (25% promo, 75% normal)
4. Revisá la consola del navegador: debería mostrar:
   ```
   📢 Loaded promotional messages: 4
   🎯 Proactive engagement: PROMOTIONAL [texto...]
   ```

## ❓ Preguntas Frecuentes

**P: ¿Puedo tener diferentes probabilidades para diferentes mensajes?**
R: Sí, editá el campo "Probabilidad (%)" en cada mensaje. Pero todos comparten el mismo 25% de slot de "mensajes promocionales".

**P: ¿Cómo hago que un mensaje aparezca más seguido?**
R: Aumentá su **Prioridad** (0-10). Los mensajes con mayor prioridad tienen más chances de ser elegidos cuando toca mostrar uno promocional.

**P: ¿Puedo agregar muchos mensajes?**
R: Sí, sin límite. Mientras más mensajes activos, más variedad tendrá Santi.

**P: ¿Los mensajes se muestran en orden?**
R: No, son **aleatorios**. Si querés que unos aparezcan más que otros, usá la **Prioridad**.

## 🔄 Próximos Pasos Sugeridos

1. Ejecutar el SQL en Supabase
2. Probar en el panel de Admin
3. Crear mensajes para Nodo Tecnológico
4. Ajustar probabilidades según resultados
5. Agregar más negocios según se vayan sumando

---

**¿Necesitás ayuda?** Revisá los logs en la consola del navegador (F12) para ver qué mensajes se están cargando y cuándo se muestran.
