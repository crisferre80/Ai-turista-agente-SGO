# 🎥 Sistema de Detección y Visualización de Videos

## 📋 Descripción

Sistema inteligente que detecta automáticamente cuando existe contenido en video relevante para la pregunta del usuario y lo muestra en un modal interactivo con reproductor de YouTube embebido. Santi menciona proactivamente que tiene "imágenes" (video) sobre el tema consultado.

## ✨ Características Principales

### 🔍 Detección Inteligente
- **Análisis contextual**: Compara el mensaje del usuario y la respuesta de Santi con los títulos de videos disponibles
- **Normalización de texto**: Elimina acentos y caracteres especiales para mejorar coincidencias
- **Coincidencia por palabras**: Busca al menos 2 palabras coincidentes entre el texto y el título del video
- **Priorización**: Muestra el primer video relevante encontrado

### 💬 Respuesta Natural
- Santi dice: *"¡Mirá! Te muestro imágenes de [título del video] para que lo veas mejor."*
- El modal aparece automáticamente después de 1.5 segundos
- No interrumpe el flujo de conversación

### 🎬 Modal de Video
- **Diseño atractivo**: Modal con fondo oscuro y blur
- **Reproductor embebido**: YouTube iframe responsive (16:9)
- **Botón cerrar**: Esquina superior derecha con animación
- **Información clara**: Título del video y mensaje descriptivo
- **Responsive**: Se adapta a diferentes tamaños de pantalla

## 🎯 Flujo de Funcionamiento

```
Usuario pregunta sobre un tema
↓
API de chat procesa la pregunta
↓
Busca videos en base de datos (app_videos)
↓
¿Hay video relevante?
├─ SÍ → Modifica respuesta de Santi
│        "Te muestro imágenes de [título]..."
│        ↓
│        Muestra modal con video después de 1.5s
│        ↓
│        Usuario ve el video y puede cerrarlo
└─ NO  → Respuesta normal sin video
```

## 🔧 Implementación Técnica

### 1. API de Chat (`/api/chat`)

**Consulta de videos:**
```typescript
const { data: videos } = await supabase
    .from('app_videos')
    .select('id, title, video_url');
```

**Algoritmo de búsqueda:**
- Normaliza texto del usuario + respuesta de Santi
- Normaliza títulos de videos (sin acentos, minúsculas)
- Busca palabras coincidentes (mínimo 2 palabras o título completo)
- Retorna primer video relevante encontrado

**Respuesta extendida:**
```json
{
  "reply": "Respuesta normal...",
  "placeId": "...",
  "relevantVideo": {
    "id": "123",
    "title": "Termas de Río Hondo",
    "url": "https://youtube.com/watch?v=..."
  }
}
```

### 2. ChatInterface (`components/ChatInterface.tsx`)

**Estados agregados:**
```typescript
const [showVideoModal, setShowVideoModal] = useState(false);
const [currentVideo, setCurrentVideo] = useState<{
    title: string; 
    url: string 
} | null>(null);
```

**Modificación de respuesta:**
```typescript
if (relevantVideo && relevantVideo.url) {
    const videoTitle = relevantVideo.title;
    botReply = `${botReply}\n\n¡Mirá! Te muestro imágenes de "${videoTitle}" para que lo veas mejor.`;
    setCurrentVideo({ title: videoTitle, url: relevantVideo.url });
    setTimeout(() => setShowVideoModal(true), 1500);
}
```

**Modal Component:**
- Overlay oscuro con blur
- Card blanco con bordes redondeados
- Botón X para cerrar (esquina superior derecha)
- iframe de YouTube responsive
- Click fuera del modal también cierra

## 📊 Ejemplos de Uso

### Ejemplo 1: Termas de Río Hondo

**Usuario pregunta:**
> "¿Qué lugares turísticos hay en Santiago?"

**Si existe video:** "Termas de Río Hondo - Lugares turísticos"

**Respuesta de Santi:**
> "Santiago del Estero tiene lugares hermosos como las Termas de Río Hondo, la Catedral..."
> 
> "¡Mirá! Te muestro imágenes de 'Termas de Río Hondo - Lugares turísticos' para que lo veas mejor."

**Resultado:**
- Modal aparece con video de YouTube embebido
- Usuario puede ver el video completo
- Al cerrar, continúa la conversación

### Ejemplo 2: Gastronomía Local

**Usuario pregunta:**
> "¿Dónde puedo comer empanadas?"

**Si existe video:** "Empanadas Santiagueñas - Receta tradicional"

**Respuesta de Santi:**
> "Te recomiendo varios lugares donde hacen empanadas riquísimas..."
>
> "¡Mirá! Te muestro imágenes de 'Empanadas Santiagueñas - Receta tradicional' para que lo veas mejor."

## 🎨 Diseño del Modal

### Características Visuales
- **Fondo**: Negro semi-transparente (80%) con blur
- **Card**: Blanco, padding 30px, bordes redondeados (20px)
- **Animaciones**: 
  - Fade in del overlay (0.3s)
  - Scale in del card (0.4s con bounce)
- **Botón cerrar**: 
  - Rojo (#9E1B1B)
  - Forma circular (40x40px)
  - Animación hover (scale 1.1)
- **Video**: 
  - Aspect ratio 16:9
  - Bordes redondeados (12px)
  - Sombra profunda

### Responsive Design
- Max-width: 90% del viewport
- Max-height: 90% del viewport
- Width fijo: 800px (en pantallas grandes)
- Padding: 20px en mobile

## 🔄 Integración con Sistema Existente

### Compatible con:
- ✅ **Modal de "Thinking"**: Se muestra después, no interfiere
- ✅ **Navegación a lugares**: Video modal no bloquea navegación
- ✅ **Consultas de ruta**: Videos NO se muestran en consultas de solo direcciones
- ✅ **Rate limiting**: Videos respetan límites de requests
- ✅ **Audio de Santi**: La narración incluye la mención del video

### No compatible con:
- ❌ **Consultas de ruta pura** (`isRouteOnly = true`)
- ❌ **Rate limit excedido**: No se buscan videos si hay límite

## 📝 Gestión de Videos en Admin

Los administradores pueden agregar videos desde el panel admin:
1. Ir a pestaña **"🎥 Videos"**
2. Agregar título descriptivo (importante para búsqueda)
3. Agregar URL de YouTube
4. El sistema automáticamente detectará cuando mostrarlos

**Tips para títulos efectivos:**
- Usar palabras clave relevantes
- Ser específico: "Termas de Río Hondo" mejor que "Termas"
- Incluir contexto: "Empanadas Santiagueñas - Receta tradicional"
- Evitar palabras genéricas solas: "Video", "Santiago", etc.

## 🚀 Mejoras Futuras Sugeridas

- [ ] Múltiples videos: Mostrar playlist si hay varios relevantes
- [ ] Categorización: Videos por categoría (turismo, gastronomía, cultura)
- [ ] Timestamps: Marcar momentos específicos del video
- [ ] Transcripciones: Buscar también en el contenido del video
- [ ] Miniaturas: Mostrar preview antes de abrir modal
- [ ] Historial: Guardar videos vistos por usuario
- [ ] Compartir: Botón para compartir el video
- [ ] Ver más tarde: Lista de videos guardados

## 🐛 Troubleshooting

### El video no se muestra
- ✅ Verificar que la URL sea de YouTube válida
- ✅ Asegurarse que el título tenga palabras clave relevantes
- ✅ Revisar que no sea consulta de ruta (`isRouteOnly`)
- ✅ Verificar en consola: `📹 Video relevante encontrado: "..."`

### El iframe no carga
- ✅ Verificar formato de URL (debe ser `youtube.com/watch?v=...`)
- ✅ El sistema convierte automáticamente a formato embed
- ✅ Revisar permisos de iframe en navegador

### Modal no cierra
- ✅ Click en botón X (esquina superior derecha)
- ✅ Click fuera del card blanco
- ✅ Verificar que no haya errores de JavaScript en consola

## 📊 Logs y Debugging

**Console logs importantes:**
```javascript
// Al encontrar video relevante
📹 Video relevante encontrado: "Título del Video" (3 coincidencias)

// En ChatInterface
Chat API response: { 
    botReply: "...", 
    hasVideo: true 
}
```

**Para debug:**
1. Abrir DevTools → Console
2. Buscar logs con emoji 📹
3. Verificar `relevantVideo` en respuesta de API
4. Revisar estados `showVideoModal` y `currentVideo`

---

**Fecha de implementación**: Febrero 2025  
**Tecnologías**: Next.js, React, TypeScript, Supabase, YouTube API  
**Integraciones**: ChatInterface, API de Chat, Modal System
