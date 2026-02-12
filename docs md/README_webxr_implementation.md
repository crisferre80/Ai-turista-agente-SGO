# 🥽 WebXR AR Implementation

## Descripción
Sistema híbrido de Realidad Aumentada que detecta automáticamente si el dispositivo soporta **WebXR nativo** y usa AR real, o fallback a AR simulado con video.

## 🚀 Características

### WebXR Real:
- ✅ **Hit testing real** contra superficies del mundo
- ✅ **Tracking 6DOF** del dispositivo
- ✅ **Anclaje espacial** persistente
- ✅ **Oclusión** correcta con objetos reales
- ✅ **Estimación de luz** del ambiente
- ✅ Compatible con **ARCore** (Android) y **ARKit** (iOS)

### AR Simulado (Fallback):
- 🔄 Video de cámara como fondo
- 🔄 Anclaje simulado por coordenadas
- 🔄 Movimiento de cámara simulado

## 📁 Arquitectura

```
src/
├── hooks/
│   └── useWebXR.ts              # Hook principal para WebXR
├── lib/
│   └── webxr-config.ts          # Configuración y utilidades WebXR
├── components/
│   ├── WebXRInitializer.tsx     # Inicialización global
│   └── ARPageClient/
│       ├── ARPageClient.tsx     # Componente híbrido principal
│       ├── WebXRScene.tsx       # Escena WebXR real
│       ├── ARHitTest.tsx        # Hit testing real
│       └── ARScene.tsx          # Escena 3D (reutilizable)
```

## 🔧 Configuración

### Dependencias instaladas:
```json
{
  "@react-three/xr": "^6.6.29",
  "@react-three/fiber": "^9.5.0", 
  "@react-three/drei": "^10.7.7",
  "webxr-polyfill": "^2.0.3"
}
```

### Requisitos:
- **HTTPS** obligatorio
- Navegador compatible: Chrome, Edge, Safari iOS 15+
- Dispositivo con ARCore/ARKit

## 🎯 Flujo de detección

```mermaid
graph TD
    A[Usuario accede a /ar/[id]] --> B[WebXRInitializer]
    B --> C[useWebXR Hook]
    C --> D{WebXR disponible?}
    D -->|Sí| E[WebXRScene - AR Real]
    D -->|No| F[ARPageClient - AR Simulado]
    E --> G[Hit Testing Real]
    F --> H[Video + Canvas 3D]
```

## 📱 Compatibilidad

### ✅ AR Real (WebXR):
- **Android**: Chrome con ARCore
- **iOS**: Safari 15+ con WebXR support
- **Desktop**: Chrome/Edge con WebXR emulator

### 🔄 AR Simulado:
- Cualquier navegador con getUserMedia
- Dispositivos sin ARCore/ARKit

## 🎮 Uso

1. **Automático**: El sistema detecta capacidades
2. **AR Real**: Botón "Iniciar AR" nativo
3. **Hit Testing**: Toca superficies para anclar
4. **Fallback**: Video + toque para simular anclaje

## 🐛 Debug

Panel de debug muestra:
- Tipo de AR (Real/Simulado)
- Estado de sesión WebXR
- Capacidades detectadas
- Objetos anclados

## 🔍 Logs importantes

```javascript
// Detección exitosa  
🔍 WebXR Detection Results:
✅ WebXR AR real disponible

// Sesión iniciada
🚀 Creating AR session with config
✅ AR session created successfully

// Hit testing
📍 Colocando objeto en posición real: [x, y, z]
```

## 📋 TODO Futuro

- [ ] Persistencia de anclajes con WebXR Anchors API
- [ ] Oclusión con depth sensing
- [ ] Múltiples objetos simultáneos  
- [ ] Compartir sesiones AR
- [ ] Grabación de sesiones AR