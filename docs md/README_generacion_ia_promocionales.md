# 🤖 Generación de Mensajes Promocionales con IA

## 📋 Descripción

Sistema de generación automática de mensajes promocionales usando IA (OpenAI GPT-4o-mini) para crear contenido conversacional y personalizado que Santi puede usar al recomendar negocios y lugares.

## ✨ Características

- **Generación con un clic**: Botón "✨ Generar con IA" en el formulario de mensajes promocionales
- **Personalización por contexto**: La IA adapta el mensaje según el nombre del negocio y la categoría seleccionada
- **Tono conversacional**: Los mensajes suenan naturales, como si Santi realmente los estuviera recomendando
- **Validación inteligente**: El botón solo se activa cuando hay un nombre de negocio ingresado
- **Estados visuales**: Indicador de carga mientras genera el mensaje

## 🎯 Cómo Funciona

### 1. En el Panel Admin

1. Ve a la pestaña **"💼 Mensajes Promocionales"**
2. Ingresa el **nombre del negocio** (Ej: "Nodo Tecnológico")
3. Opcionalmente selecciona una **categoría** (Ej: "Tecnología")
4. Haz clic en **"✨ Generar con IA"**
5. La IA genera automáticamente un mensaje personalizado
6. Puedes editar el mensaje si lo deseas antes de guardarlo

### 2. Flujo Técnico

```
Usuario ingresa nombre → Click en "Generar con IA" 
→ Frontend llama a /api/generate-promotional-message 
→ API envía prompt a OpenAI GPT-4o-mini
→ IA genera mensaje conversacional
→ Mensaje se rellena automáticamente en el textarea
→ Usuario puede ajustar y guardar
```

## 📁 Archivos Creados/Modificados

### Nuevo Endpoint API
**`src/app/api/generate-promotional-message/route.ts`**
- Endpoint POST que recibe `businessName` y `category`
- Usa OpenAI GPT-4o-mini con temperatura 0.9 para creatividad
- Prompt especializado para generar mensajes en el estilo de "Santi"
- Límite de 150 tokens para mensajes concisos

### Modificaciones en Admin Panel
**`src/app/admin/page.tsx`**

**Estado agregado:**
```typescript
const [generatingPromo, setGeneratingPromo] = useState(false);
```

**Función agregada:**
```typescript
const generatePromotionalMessage = async () => {
    // Valida nombre del negocio
    // Llama al endpoint de IA
    // Actualiza el mensaje en el estado
}
```

**UI agregada:**
- Botón "✨ Generar con IA" al lado del label del textarea
- Estados disabled cuando está generando o falta el nombre
- Texto dinámico: "⏳ Generando..." mientras procesa

## 🎨 Diseño del Prompt de IA

El prompt está optimizado para que la IA genere mensajes que:

✅ **Sean conversacionales**: Como si Santi hablara con un amigo
✅ **Usen primera persona**: "Te recomiendo...", "Si querés..."
✅ **Sean breves**: Máximo 2-3 oraciones
✅ **Suenen genuinos**: No como anuncios publicitarios
✅ **Reflejen Santiago del Estero**: Conocimiento local

## 💡 Ejemplo de Uso

### Input:
- **Nombre del Negocio**: "Nodo Tecnológico"
- **Categoría**: "Tecnología"

### Output generado por IA:
> "¿Sabías que el Nodo Tecnológico es un espacio de innovación increíble en Santiago? Si te interesa la tecnología, tenés que conocerlo. Es el lugar ideal para conectarte con emprendedores y proyectos tecnológicos de la región."

## 🔧 Configuración Técnica

### Parámetros de OpenAI
- **Modelo**: `gpt-4o-mini`
- **Temperature**: `0.9` (alta creatividad)
- **Max Tokens**: `150` (mensajes concisos)
- **System Prompt**: Define la personalidad de "Santi"

### Validaciones
- ✅ Nombre del negocio obligatorio antes de generar
- ✅ Control de estado de carga
- ✅ Manejo de errores con alertas amigables
- ✅ Botón disabled durante generación

## 📊 Ventajas del Sistema

1. **Ahorro de tiempo**: Genera mensajes en segundos
2. **Consistencia de tono**: Todos los mensajes mantienen el estilo de Santi
3. **Personalización**: Cada mensaje es único según el contexto
4. **Flexibilidad**: El usuario puede editar el mensaje generado
5. **Escalabilidad**: Fácil agregar múltiples mensajes rápidamente

## 🚀 Mejoras Futuras Sugeridas

- [ ] Generar múltiples variantes y dejar que el usuario elija
- [ ] Historial de mensajes generados
- [ ] Ajuste de temperatura/creatividad desde la UI
- [ ] Regenerar mensaje con diferentes estilos
- [ ] Previsualización del mensaje en el chat

## 🔗 Integración con Sistema Existente

Este sistema se integra perfectamente con:
- ✅ **ChatInterface**: Los mensajes generados aparecen igual que los manuales
- ✅ **Base de datos**: Se guardan en `promotional_messages`
- ✅ **Sistema de probabilidades**: Respetan las configuraciones de show_probability
- ✅ **Edición**: Los mensajes generados se pueden editar igual que los manuales

---

**Fecha de implementación**: Enero 2025
**Tecnologías**: Next.js, OpenAI API, TypeScript, Supabase
