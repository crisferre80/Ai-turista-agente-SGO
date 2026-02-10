# Sistema de Realidad Aumentada con WebXR y Three.js

## 📱 Descripción General

Se ha implementado un sistema completo de Realidad Aumentada (AR) en la aplicación turística Santi, permitiendo a los usuarios experimentar atractivos turísticos de manera inmersiva mediante la cámara de su dispositivo móvil. El sistema utiliza **WebXR** para compatibilidad con navegadores modernos y **Three.js** para renderizado 3D.

## 🚀 Características Implementadas

### 1. **Componentes Principales**

#### ARViewer (`src/components/ARViewer.tsx`)
- Componente principal de visualización AR
- Detecta capacidades WebXR del dispositivo
- Gestiona el ciclo de vida de la sesión AR
- Pantallas de carga y error personalizadas
- Modo pantalla completa
- Controles intuitivos con instrucciones

#### ARScene (`src/components/ARScene.tsx`)
- Escena 3D con Three.js y React Three Fiber
- Renderiza modelos 3D principales (formato GLTF/GLB)
- Gestiona múltiples tipos de hotspots:
  - **Info**: Tarjetas con información textual e imágenes
  - **Video**: Videos embebidos (YouTube)
  - **3D Model**: Modelos 3D adicionales
  - **Audio**: Narraciones de audio
- Iluminación realista con Environment de `@react-three/drei`
- Controles de cámara (orbitar, zoom, pan)
- Animaciones flotantes para hotspots

#### QRScanner (`src/components/QRScanner.tsx`)
- Escáner de códigos QR usando `html5-qrcode`
- Acceso a cámara trasera del dispositivo
- Interfaz visual clara con instrucciones
- Manejo de errores y permisos
- Búsqueda automática de atractivos por código QR

### 2. **Integración en la Interfaz**

#### Mapa (`src/components/Map.tsx`)
- **Badge AR**: Indicador visual 🥽 en marcadores con contenido AR
- Animación de pulso para llamar la atención
- Popup mejorado con:
  - Mensaje "✨ Contenido AR disponible"
  - Botón "Ver en AR" con gradiente púrpura
  - Redirección a página de detalles con AR activado

#### Detalles del Lugar (`src/components/PlaceDetailClient.tsx`)
- **Botones en el Hero**:
  - 📷 **QR**: Abre escáner de códigos QR
  - 🥽 **Ver en AR**: Inicia experiencia AR (solo si `has_ar_content: true`)
- Activación automática con parámetro URL `?openAR=true`
- Modales flotantes para AR y escáner QR
- Animación de pulso en botón AR

### 3. **Base de Datos**

#### Script SQL (`add_ar_columns_to_attractions.sql`)
Agrega las siguientes columnas a la tabla `attractions`:

```sql
- ar_model_url (TEXT): URL del modelo 3D principal (GLTF/GLB/OBJ)
- ar_hotspots (JSONB): Array con hotspots AR (info, videos, modelos)
- has_ar_content (BOOLEAN): Flag para filtrar atractivos con AR
- qr_code (TEXT): Código QR único del atractivo
```

#### Estructura de `ar_hotspots` (JSON)
```json
{
  "hotspots": [
    {
      "id": "info-1",
      "type": "info",
      "position": [0, 1.5, -2],
      "title": "Historia del Monumento",
      "description": "Construido en 1810...",
      "image_url": "https://...",
      "rotation": [0, 0, 0]
    },
    {
      "id": "video-1",
      "type": "video",
      "position": [2, 1, -3],
      "video_url": "https://www.youtube.com/watch?v=...",
      "title": "Construcción del lugar"
    },
    {
      "id": "model-1",
      "type": "3d_model",
      "position": [0, 0, -5],
      "model_url": "https://storage.supabase.co/.../model.glb",
      "scale": [1, 1, 1]
    }
  ]
}
```

### 4. **Servicios y Utilidades**

#### Detección WebXR (`src/lib/webxr.ts`)
- `detectWebXRCapabilities()`: Verifica soporte WebXR (immersive-ar / inline)
- `isMobileDevice()`: Detecta si es dispositivo móvil
- `requestCameraPermission()`: Solicita permisos de cámara
- `getDeviceInfo()`: Información detallada (cámara, giroscopio, acelerómetro)
- `meetsARRequirements()`: Verifica requisitos mínimos para AR

#### Tipos TypeScript (`src/types/ar.ts`)
- Interfaces completas para hotspots AR
- Tipos para capacidades WebXR
- Props de componentes AR
- Configuración de escenas

## 📦 Dependencias Instaladas

```json
{
  "three": "^0.x.x",
  "@react-three/fiber": "^8.x.x",
  "@react-three/drei": "^9.x.x",
  "webxr-polyfill": "^2.x.x",
  "html5-qrcode": "^2.x.x",
  "@types/three": "^0.x.x"
}
```

## 🎯 Flujo de Uso

### Para Turistas

1. **Descubrir contenido AR**:
   - Ver marcadores con badge 🥽 en el mapa
   - Mensaje "✨ Contenido AR disponible" en popups

2. **Activar AR**:
   - **Opción A**: Clic en botón "🥽 Ver en AR" en el mapa
   - **Opción B**: Abrir detalles del lugar y clic en "Ver en AR"
   - **Opción C**: Escanear código QR con botón "📷 QR"

3. **Experiencia AR**:
   - Otorgar permisos de cámara y sensores
   - Ver modelos 3D, información y videos en AR
   - Interactuar con hotspots tocándolos
   - Mover dispositivo para explorar 360°

### Para Administradores

1. **Ejecutar script SQL** en Supabase:
   ```bash
   # Copiar contenido de add_ar_columns_to_attractions.sql
   # Ejecutar en SQL Editor de Supabase
   ```

2. **Agregar contenido AR a un atractivo**:
   ```sql
   UPDATE attractions
   SET 
     has_ar_content = true,
     ar_model_url = 'https://storage.supabase.co/.../monumento.glb',
     ar_hotspots = '{
       "hotspots": [
         {
           "id": "info-1",
           "type": "info",
           "position": [0, 1.5, -2],
           "title": "Historia",
           "description": "Este monumento...",
           "image_url": "https://..."
         }
       ]
     }'::jsonb,
     qr_code = 'ATR-CATEDRAL-SGO'
   WHERE id = 'id-del-atractivo';
   ```

3. **Generar código QR** (opcional):
   - Usar herramienta online (ej: QR Code Generator)
   - Contenido: Código único (ej: `ATR-CATEDRAL-SGO`)
   - Imprimir y colocar en el lugar físico

## 🔧 Requisitos Técnicos

### Navegador/Dispositivo
- ✅ Conexión **HTTPS** (obligatorio para WebXR)
- ✅ Navegador moderno: Chrome 79+, Safari 13+, Edge 79+
- ✅ Permisos de cámara y sensores de movimiento
- ✅ Dispositivo con giroscopio y acelerómetro (móviles modernos)

### Servidor
- ✅ HTTPS configurado (Vercel/Netlify lo hacen automáticamente)
- ✅ Modelos 3D en formato GLTF/GLB (recomendado) u OBJ
- ✅ Almacenamiento de modelos en Supabase Storage o CDN

## 🎨 Formatos de Modelos 3D Recomendados

### GLTF/GLB (Recomendado)
- Formato estándar para WebGL
- Soporta texturas, animaciones y materiales PBR
- Archivos optimizados y comprimidos
- Herramientas: Blender, SketchFab, Ready Player Me

### OBJ (Alternativo)
- Más simple, sin animaciones
- Requiere archivos MTL separados para materiales
- Compatible con la mayoría de software 3D

### Optimización
- **Polígonos**: Mantener < 50,000 triángulos por modelo
- **Texturas**: Máximo 2048x2048 px, compresión JPEG/WebP
- **Archivos**: GLB comprimido < 5MB para carga rápida

## 📊 Estructura de Archivos

```
tourist-assistant/
├── src/
│   ├── components/
│   │   ├── ARViewer.tsx          # Componente principal AR
│   │   ├── ARScene.tsx           # Escena 3D con Three.js
│   │   ├── QRScanner.tsx         # Escáner de códigos QR
│   │   ├── Map.tsx               # Mapa con indicadores AR
│   │   └── PlaceDetailClient.tsx # Detalles con botones AR
│   ├── lib/
│   │   └── webxr.ts             # Servicios de detección WebXR
│   └── types/
│       └── ar.ts                # Tipos TypeScript para AR
├── add_ar_columns_to_attractions.sql  # Script SQL para DB
└── README_ar_system.md          # Esta documentación
```

## 🐛 Solución de Problemas

### "WebXR no está soportado"
- **Causa**: Navegador antiguo o sin HTTPS
- **Solución**: Usar navegador moderno en HTTPS

### "No se puede acceder a la cámara"
- **Causa**: Permisos denegados o no HTTPS
- **Solución**: Otorgar permisos y verificar HTTPS

### "Modelo 3D no carga"
- **Causa**: URL incorrecta o formato incompatible
- **Solución**: Verificar URL y usar GLTF/GLB

### "Hotspots no aparecen"
- **Causa**: JSON mal formado en `ar_hotspots`
- **Solución**: Validar JSON con herramienta online

## 🔮 Mejoras Futuras

- [ ] Activación automática por geolocalización (cerca del lugar)
- [ ] Generación de modelos 3D con IA (Gemini/OpenAI)
- [ ] Reconocimiento de imágenes (image tracking)
- [ ] Multiplayer AR (compartir sesiones)
- [ ] Grabación de experiencias AR
- [ ] Integración con ARCore/ARKit nativo
- [ ] Analytics de uso de AR
- [ ] Panel admin para gestionar contenido AR

## 📝 Notas Técnicas

- **SSR**: Componentes AR se cargan con `dynamic(..., { ssr: false })` para evitar errores en servidor
- **Performance**: Three.js optimizado con LOD y culling automático
- **Fallback**: Modo inline si immersive-ar no está disponible
- **Accesibilidad**: Instrucciones claras y manejo de errores robusto

## 👥 Créditos

Sistema desarrollado para el proyecto **Santi - Asistente Turístico Virtual de Santiago del Estero**.

- **WebXR**: [WebXR Device API](https://immersiveweb.dev/)
- **Three.js**: [threejs.org](https://threejs.org/)
- **React Three Fiber**: [docs.pmnd.rs/react-three-fiber](https://docs.pmnd.rs/react-three-fiber)
- **html5-qrcode**: [github.com/mebjas/html5-qrcode](https://github.com/mebjas/html5-qrcode)

---

**¡Disfruta explorando Santiago del Estero en Realidad Aumentada! 🥽✨**
