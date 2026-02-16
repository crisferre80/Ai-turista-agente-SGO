# Guía de Image Tracking y Códigos QR para AR

Esta guía explica cómo usar **Image Tracking** para posicionar objetos AR automáticamente usando códigos QR y marcadores personalizados.

## 📋 Tabla de Contenidos

1. [¿Qué es Image Tracking?](#qué-es-image-tracking)
2. [Casos de Uso](#casos-de-uso)
3. [Instalación de Dependencias](#instalación-de-dependencias)
4. [Uso Básico](#uso-básico)
5. [Generación de Códigos QR](#generación-de-códigos-qr)
6. [Integración Completa](#integración-completa)
7. [Compatibilidad](#compatibilidad)
8. [Troubleshooting](#troubleshooting)

---

## ¿Qué es Image Tracking?

**Image Tracking** es una característica de WebXR que permite detectar imágenes específicas en el mundo real (códigos QR, logos, marcadores) y anclar objetos 3D a su posición automáticamente.

### Diferencia con Hit Testing

| Característica | Hit Testing | Image Tracking |
|---|---|---|
| Activación | Usuario toca la pantalla | Automática al detectar imagen |
| Precisión | Depende del toque | Alta precisión en posición de imagen |
| Uso ideal | Colocación manual | Posiciones predefinidas |
| Ejemplo | "Pon un poste aquí" | "Detecta el QR y pon el poste" |

---

## Casos de Uso

### 🎯 Turismo
```
Escenario: Colocar modelo 3D de monumento histórico
- Imprimir QR code y colocarlo en mesa de información turística
- Al escanear, aparece modelo 3D del monumento flotando sobre el QR
- Usuario puede caminar alrededor del modelo
```

### 🏛️ Museos
```
Escenario: Activar contenido AR en cada exhibición
- QR code impreso junto a cada pieza del museo
- Al detectarlo, muestra información 3D, animaciones o reconstrucciones
```

### 🏨 Hoteles/Restaurantes
```
Escenario: Menú AR o información del lugar
- QR code en la mesa del restaurante
- Al escanearlo, aparece modelo 3D del plato que el cliente puede ver
```

### 📍 Ubicaciones Específicas
```
Escenario: Postes/señales en ubicación exacta
- QR code impreso y pegado en el suelo
- Objeto AR aparece "pegado" exactamente en ese punto
- Útil para señalización AR, guías, etc.
```

---

## Instalación de Dependencias

### 1. Instalar librería de QR codes

```bash
npm install qrcode
npm install --save-dev @types/qrcode
```

### 2. Verificar que los componentes existan

Ya están implementados:
- ✅ `ARImageTracking.tsx` - Componente de tracking
- ✅ `QRCodeManager.tsx` - Generador de QR codes
- ✅ `qr-code-generator.ts` - Utilidades

---

## Uso Básico

### Paso 1: Generar Código QR

```tsx
import QRCodeManager from '@/components/QRCodeManager';

function AdminPanel() {
  const handleImagesGenerated = (images) => {
    console.log('QR codes generados:', images);
    // Guardar en base de datos si es necesario
  };
  
  return (
    <QRCodeManager
      attractionId="monumento-123"
      attractionName="Torre Histórica"
      baseUrl="https://tuapp.com"
      onImagesGenerated={handleImagesGenerated}
    />
  );
}
```

### Paso 2: Configurar Imágenes Rastreables

```tsx
import ARImageTracking from '@/components/ARPageClient/ARImageTracking';
import type { TrackableImage } from '@/components/ARPageClient/ARImageTracking';

const trackableImages: TrackableImage[] = [
  {
    id: 'qr-monumento-123',
    name: 'QR Torre Histórica',
    imageUrl: '/qr-codes/monumento-123.png', // Imagen del QR generado
    widthInMeters: 0.08 // 8 cm de ancho físico
  }
];

function ARExperience() {
  const handleImageDetected = (result) => {
    console.log('📷 QR detectado:', result.name);
    console.log('Posición:', result.position);
    // Colocar objeto AR automáticamente
  };
  
  return (
    <ARImageTracking
      images={trackableImages}
      onImageDetected={handleImageDetected}
      autoCreateAnchors={true} // Crear anchors automáticamente
      showDebugMarkers={true} // Mostrar área detectada
    />
  );
}
```

### Paso 3: Integración en WebXRScene

Ya está integrado en `WebXRScene.tsx`, solo necesitas pasar las imágenes:

```tsx
// En tu componente padre
const [trackableImages, setTrackableImages] = useState<TrackableImage[]>([]);

// Cuando generes el QR, actualiza el estado
const handleQRGenerated = (images) => {
  setTrackableImages(images);
};

return (
  <WebXRScene
    attraction={attraction}
    onClose={handleClose}
    trackableImages={trackableImages} // ⚠️ Necesitas agregar esta prop
  />
);
```

---

## Generación de Códigos QR

### Generar QR para Atractivo

```typescript
import { generateAttractionQRCode, downloadQRCode } from '@/lib/qr-code-generator';

async function generarQR() {
  const result = await generateAttractionQRCode(
    'monumento-123',
    'https://tuapp.com',
    {
      size: 1024, // 1024x1024 px para impresión
      errorCorrectionLevel: 'H', // Alta corrección de errores
      color: '#000000',
      backgroundColor: '#FFFFFF'
    }
  );
  
  // Descargar
  downloadQRCode(result.blob, 'qr-monumento-123.png');
  
  // O subir a Supabase
  const url = await uploadQRCodeToStorage(
    result.blob,
    `qr-codes/monumento-123.png`,
    supabase
  );
  
  console.log('QR subido:', url);
}
```

### Generar QR con Logo Personalizado

```typescript
const result = await generateAttractionQRCode(
  'monumento-123',
  'https://tuapp.com',
  {
    size: 2048,
    errorCorrectionLevel: 'H',
    logo: '/logo-app.png', // Tu logo
    logoSize: 0.2 // 20% del tamaño del QR
  }
);
```

### Imprimir QR con Instrucciones

```typescript
import { printQRCode } from '@/lib/qr-code-generator';

printQRCode(
  result.dataUrl,
  'Torre Histórica',
  'Escanea este código para ver el monumento en 3D con Realidad Aumentada'
);
```

---

## Integración Completa

### Ejemplo: Sistema Completo de QR + AR

```typescript
// 1. Panel de administración - Generar QR
function AdminAttractionPanel({ attraction }) {
  const [qrGenerated, setQrGenerated] = useState(false);
  
  const handleGenerateQR = async () => {
    const result = await generateAttractionQRCode(
      attraction.id,
      process.env.NEXT_PUBLIC_APP_URL || 'https://tuapp.com'
    );
    
    // Guardar URL del QR en base de datos
    await supabase
      .from('attractions')
      .update({ 
        qr_code_url: result.dataUrl,
        qr_physical_width: result.recommendedPhysicalWidth 
      })
      .eq('id', attraction.id);
    
    setQrGenerated(true);
  };
  
  return (
    <div>
      <button onClick={handleGenerateQR}>
        Generar Código QR
      </button>
      
      {qrGenerated && (
        <QRCodeManager
          attractionId={attraction.id}
          attractionName={attraction.name}
          baseUrl={process.env.NEXT_PUBLIC_APP_URL!}
        />
      )}
    </div>
  );
}

// 2. Experiencia AR - Usar QR
function ARPage({ attraction }) {
  const [trackableImages, setTrackableImages] = useState<TrackableImage[]>([]);
  
  useEffect(() => {
    // Cargar QR desde base de datos
    if (attraction.qr_code_url) {
      setTrackableImages([
        {
          id: `qr-${attraction.id}`,
          name: `QR ${attraction.name}`,
          imageUrl: attraction.qr_code_url,
          widthInMeters: attraction.qr_physical_width || 0.08
        }
      ]);
    }
  }, [attraction]);
  
  return (
    <WebXRScene
      attraction={attraction}
      trackableImages={trackableImages}
      onClose={() => router.back()}
    />
  );
}
```

---

## Compatibilidad

### Dispositivos Soportados

| Plataforma | Versión | Image Tracking | Notas |
|---|---|---|---|
| Android Chrome | 88+ | ✅ Experimental | Requiere flag |
| iOS Safari | 15+ | ⚠️ Limitado | Solo en iPadOS |
| Desktop Chrome | 88+ | ❌ No | Solo mobile |

### Habilitar en Android

1. Ir a `chrome://flags`
2. Buscar "WebXR Incubations"
3. Habilitar flag
4. Reiniciar navegador

### Requisitos de Hardware

- ✅ **Cámara trasera** con enfoque automático
- ✅ **Giroscopio y acelerómetro**
- ✅ **ARCore** (Android) o **ARKit** (iOS)
- ⚠️ **Buena iluminación** (lighting óptimo > 300 lux)

---

## Mejores Prácticas

### 1. Tamaño del QR Code

```typescript
// Para diferentes usos:
const sizes = {
  mesaRestaurante: 0.08,  // 8 cm - mesa cercana
  cartelPared: 0.15,      // 15 cm - pared a 1-2 metros
  bannerGrande: 0.30      // 30 cm - banner a 3+ metros
};
```

### 2. Corrección de Errores

```typescript
// Según el uso:
const errorCorrection = {
  simple: 'L',        // Sin logo, condiciones ideales
  normal: 'M',        // Uso general
  conLogo: 'H',       // Con logo central
  exterior: 'H'       // Puede ensuciarse/dañarse
};
```

### 3. Ubicación del Marcador

- ✅ **Superficie plana y estable**
- ✅ **Buena iluminación** (evitar sombras fuertes)
- ✅ **Evitar reflejos** (no en vidrio o plástico brillante)
- ✅ **Altura accesible** (1-1.5 metros ideal)
- ❌ **No en movimiento** (no en puertas, ventanas, etc.)

### 4. Instrucciones para Usuarios

```
Texto recomendado para acompañar el QR:

"EXPERIENCIA DE REALIDAD AUMENTADA
1. Abre la cámara de tu teléfono
2. Apunta hacia este código QR
3. Mantén el teléfono a 30-50 cm de distancia
4. La experiencia AR se activará automáticamente"
```

---

## Troubleshooting

### ❌ "Image Tracking no soportado"

**Causa**: Dispositivo o navegador no compatible

**Solución**:
```typescript
// Detectar soporte
useEffect(() => {
  if (typeof navigator !== 'undefined' && navigator.xr) {
    navigator.xr.isSessionSupported('immersive-ar')
      .then(supported => {
        if (!supported) {
          alert('Tu dispositivo no soporta WebXR AR');
        }
      });
  }
}, []);
```

### ❌ "QR no se detecta"

**Causas posibles**:
1. Iluminación insuficiente
2. QR demasiado pequeño o grande
3. QR dañado o sucio
4. Cámara sin enfoque

**Soluciones**:
- Mejorar iluminación del área
- Imprimir QR en tamaño recomendado (8-15 cm)
- Verificar que QR esté limpio y sin arrugas
- Mantener distancia óptima (30-50 cm)

### ❌ "Objeto aparece en posición incorrecta"

**Causa**: Ancho físico mal configurado

**Solución**:
```typescript
// Medir el QR impreso y ajustar
const trackableImage = {
  id: 'qr-1',
  name: 'Mi QR',
  imageUrl: '/qr.png',
  widthInMeters: 0.10 // ⚠️ Asegúrate de que coincida con el tamaño real
};
```

### ❌ "Tracking se pierde constantemente"

**Causas**:
- Movimiento demasiado rápido
- QR sale del campo de visión
- Iluminación cambiante

**Soluciones**:
- Mover el dispositivo más lento
- Mantener QR visible en la cámara
- Estabilizar iluminación del área
- Usar `autoCreateAnchors={true}` para persistir posición

---

## API Reference

### ARImageTracking Component

```typescript
interface ARImageTrackingProps {
  images: TrackableImage[];              // Imágenes a rastrear
  onImageDetected?: (result: TrackedImageResult) => void;
  onImageLost?: (imageId: string) => void;
  autoCreateAnchors?: boolean;          // Default: false
  showDebugMarkers?: boolean;           // Default: true
}
```

### TrackableImage Interface

```typescript
interface TrackableImage {
  id: string;                            // ID único
  name: string;                          // Nombre descriptivo
  imageUrl: string;                      // URL de la imagen
  widthInMeters: number;                 // Ancho físico real en metros
}
```

### TrackedImageResult Interface

```typescript
interface TrackedImageResult {
  id: string;
  name: string;
  position: THREE.Vector3;               // Posición 3D
  rotation: THREE.Euler;                 // Rotación 3D
  matrix: THREE.Matrix4;                 // Matriz de transformación
  measuredSize: { width: number; height: number };
  trackingState: 'tracking' | 'emulated' | 'limited';
  xrImageSpace?: XRSpace;               // Para crear anchors
}
```

### useARImageTracking Hook

```typescript
const imageTrackingAPI = useARImageTracking();

// API disponible:
imageTrackingAPI?.trackedImages          // Map de imágenes detectadas
imageTrackingAPI?.getTrackedImage(id)    // Obtener imagen específica
imageTrackingAPI?.getAllTrackedImages()  // Array de todas las imágenes
imageTrackingAPI?.isImageTracked(id)     // Verificar si está detectada
```

---

## Ejemplos Adicionales

### Ejemplo 1: Múltiples QR Codes

```typescript
const trackableImages = [
  {
    id: 'entrada',
    name: 'QR Entrada',
    imageUrl: '/qr/entrada.png',
    widthInMeters: 0.15
  },
  {
    id: 'planta-baja',
    name: 'QR Planta Baja',
    imageUrl: '/qr/planta-baja.png',
    widthInMeters: 0.15
  },
  {
    id: 'primer-piso',
    name: 'QR Primer Piso',
    imageUrl: '/qr/primer-piso.png',
    widthInMeters: 0.15
  }
];

function handleImageDetected(result) {
  switch (result.id) {
    case 'entrada':
      mostrarModeloEntrada();
      break;
    case 'planta-baja':
      mostrarMapaPlantaBaja();
      break;
    case 'primer-piso':
      mostrarMapaPrimerPiso();
      break;
  }
}
```

### Ejemplo 2: QR Code + Anchor Persistence

```typescript
function ARExperienceWithPersistence() {
  const handleImageDetected = async (result) => {
    // Crear anchor en la posición del QR
    const anchorId = await window.__arAnchorsAPI?.createAnchorFromPose(
      result.position,
      result.rotation
    );
    
    if (anchorId) {
      // Guardar anchor en base de datos
      await supabase
        .from('ar_sessions')
        .insert({
          user_id: userId,
          attraction_id: attractionId,
          anchor_id: anchorId,
          position: result.position.toArray(),
          created_at: new Date().toISOString()
        });
      
      console.log('✅ Objeto anclado y guardado:', anchorId);
    }
  };
  
  return (
    <ARImageTracking
      images={trackableImages}
      onImageDetected={handleImageDetected}
      autoCreateAnchors={true}
    />
  );
}
```

---

## Próximos Pasos

1. **Probar en dispositivo real**: Image Tracking solo funciona en dispositivos móviles con AR
2. **Imprimir QR codes**: Usar impresora de buena calidad, papel mate
3. **Ubicar estratégicamente**: Colocar QR en ubicaciones bien iluminadas
4. **Medir resultados**: Registrar detecciones exitosas vs. fallidas
5. **Iterar**: Ajustar tamaño, ubicación y diseño según feedback

---

## Recursos Adicionales

- [WebXR Image Tracking Spec](https://github.com/immersive-web/marker-tracking)
- [QRCode.js Documentation](https://github.com/soldair/node-qrcode)
- [Guía de Anchors API](./README_webxr_advanced_features.md)
- [Documentación WebXR](./README_webxr_implementation.md)

---

**¿Preguntas?** Consulta el [troubleshooting](#troubleshooting) o revisa los logs del navegador con la consola de DevTools.
