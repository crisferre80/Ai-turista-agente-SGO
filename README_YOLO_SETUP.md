# 🚀 Configuración del Modelo YOLO para Análisis Visual

Este documento describe cómo exportar y configurar el modelo YOLOv8 para detección de objetos en tiempo real en el navegador.

## 📋 Prerrequisitos

- Python 3.8 o superior
- pip instalado

## 🔧 Instalación de Ultralytics YOLO

```bash
# Instalar paquete ultralytics que incluye YOLOv8
pip install ultralytics
```

## 📦 Exportar Modelo a ONNX

El sistema de visión requiere YOLOv8n (nano) en formato ONNX para ejecución en navegador:

```python
# Crear archivo export_yolo.py
from ultralytics import YOLO

# Cargar modelo pre-entrenado YOLOv8n (el más ligero)
model = YOLO('yolov8n.pt')

# Exportar a ONNX con optimizaciones para navegador
model.export(
    format='onnx',          # Formato ONNX Runtime Web
    dynamic=False,          # Entrada fija 640x640
    simplify=True,          # Simplificar grafo para mejor rendimiento
    opset=12                # Compatible con onnxruntime-web
)

print("✅ Modelo exportado: yolov8n.onnx")
```

Ejecutar el script:

```bash
python export_yolo.py
```

Esto generará `yolov8n.onnx` (~6 MB) que detecta 80 clases COCO (personas, vehículos, monumentos, etc.).

## 📂 Ubicación del Modelo

Copiar el archivo ONNX exportado al directorio público:

```bash
# Windows
mkdir public\models
copy yolov8n.onnx public\models\yolov8n.onnx

# Linux/Mac
mkdir -p public/models
cp yolov8n.onnx public/models/yolov8n.onnx
```

## 🎯 Clases Detectables (80 COCO Classes)

El modelo YOLOv8n detecta:

### Personas y Accesorios
- `person` - Personas (clave para detección de turistas)
- `backpack`, `handbag`, `suitcase` - Indicadores de turismo
- `umbrella`, `tie`, `sports ball`

### Vehículos
- `car`, `motorcycle`, `bus`, `truck`, `bicycle`
- `train`, `airplane`, `boat`

### Monumentos/Estructuras
- `traffic light`, `fire hydrant`, `stop sign`, `parking meter`, `bench`
- `clock`, `kite` (para festivales)

### Objetos de Interés Turístico
- `bottle`, `wine glass`, `cup` - Gastronomía
- `book` - Guías turísticas
- `cell phone` - Turistas fotografiando

Ver lista completa en: `src/types/vision.ts` (constante `COCO_CLASSES`)

## 🔄 Modelos Alternativos

Si necesitas mayor precisión (sacrificando velocidad):

### YOLOv8s (Small) - Mayor precisión
```python
model = YOLO('yolov8s.pt')  # ~22 MB, mejor mAP
model.export(format='onnx', dynamic=False, simplify=True)
```

### YOLOv8m (Medium) - Alto rendimiento
```python
model = YOLO('yolov8m.pt')  # ~50 MB, máxima precisión
model.export(format='onnx', dynamic=False, simplify=True)
```

**Recomendación:** Usar YOLOv8n para móviles, YOLOv8s para desktop.

## 🧪 Verificar Modelo

Probar el modelo exportado:

```python
import onnxruntime as ort
import numpy as np

# Cargar modelo ONNX
session = ort.InferenceSession('yolov8n.onnx')

# Verificar entrada/salida
input_shape = session.get_inputs()[0].shape
output_shape = session.get_outputs()[0].shape

print(f"✅ Input shape: {input_shape}")   # [1, 3, 640, 640]
print(f"✅ Output shape: {output_shape}") # [1, 84, 8400]

# Test inference con imagen aleatoria
dummy_input = np.random.randn(1, 3, 640, 640).astype(np.float32)
output = session.run(None, {session.get_inputs()[0].name: dummy_input})

print(f"✅ Inference exitosa: {output[0].shape}")
```

## 📊 Rendimiento Esperado

| Modelo | Tamaño | Latencia (Web) | mAP@50-95 |
|--------|--------|----------------|-----------|
| YOLOv8n | 6 MB | 38-95 ms | 37.3% |
| YOLOv8s | 22 MB | 120-200 ms | 44.9% |
| YOLOv8m | 50 MB | 250-400 ms | 50.2% |

*Latencias medidas en Chrome desktop (GPU WebGL). Móviles: +50-100% tiempo.*

## 🔗 Integración con MediaPipe

El sistema combina YOLO + MediaPipe:

1. **YOLO** → Detecta QUÉ hay (personas, objetos, monumentos)
2. **MediaPipe Pose** → Detecta gestos (señalar, saludar)
3. **MediaPipe Face** → Reconoce rostros conocidos (GDPR compliant)

MediaPipe se descarga automáticamente desde CDN, no requiere setup manual.

## ⚙️ Configuración Avanzada

### Ajustar Umbral de Confianza

En `src/hooks/useYOLO.ts`, modificar:

```typescript
const CONFIDENCE_THRESHOLD = 0.5; // Predeterminado: 50%
// Aumentar a 0.7 para menos falsos positivos
// Reducir a 0.3 para detectar más objetos (más ruidoso)
```

### Optimizar NMS (Non-Maximum Suppression)

```typescript
const IOU_THRESHOLD = 0.45; // Predeterminado
// Aumentar a 0.6 para eliminar más duplicados
// Reducir a 0.3 para mantener detecciones cercanas
```

## 🐛 Troubleshooting

### Error: "Model not found"
- Verificar que `yolov8n.onnx` esté en `public/models/`
- Revisar consola del navegador para errores de carga

### Error: "Failed to create ONNX session"
- Verificar versión de onnxruntime-web: `npm list onnxruntime-web`
- Debe ser v1.20.0 o superior
- Intentar regenerar modelo con `opset=12`

### Rendimiento lento
- Usar YOLOv8n en lugar de modelos más grandes
- Reducir frecuencia de análisis en `ChatInterface.tsx`
- Habilitar GPU en navegador (chrome://flags → WebGL 2.0)

### Detecciones incorrectas
- Aumentar `CONFIDENCE_THRESHOLD` a 0.6-0.7
- Verificar iluminación de cámara (YOLO requiere buena iluminación)
- Comprobar que objetos estén dentro del campo de visión

## 📚 Referencias

- [Ultralytics YOLOv8 Docs](https://docs.ultralytics.com/)
- [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)
- [COCO Dataset Classes](https://tech.amikelive.com/node-718/what-object-categories-labels-are-in-coco-dataset/)

## 🚦 Siguiente Paso

Después de copiar `yolov8n.onnx` a `public/models/`:

```bash
# Instalar dependencias
npm install

# Aplicar migraciones de base de datos
# (Ver README_VISION_DATABASE.md)

# Iniciar aplicación
npm run dev
```

¡El sistema de visión estará listo cuando digas: **"Santi, ¿qué ves?"** 👁️🤖
