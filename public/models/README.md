# 📦 Directorio de Modelos YOLO

Este directorio debe contener el modelo YOLO exportado en formato ONNX.

## ⚠️ ACCIÓN REQUERIDA

El archivo **`yolov8n.onnx`** no está presente. Debes exportarlo siguiendo estos pasos:

### 1️⃣ Instalar Ultralytics

```bash
pip install ultralytics
```

### 2️⃣ Exportar YOLOv8n a ONNX

Ejecuta este comando Python:

```python
from ultralytics import YOLO

# Cargar modelo pre-entrenado YOLOv8n (más ligero y rápido)
model = YOLO('yolov8n.pt')

# Exportar a ONNX con configuración optimizada para navegador
model.export(
    format='onnx',
    dynamic=False,
    simplify=True,
    opset=12
)
```

O directamente en terminal:

```bash
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt').export(format='onnx', simplify=True, opset=12)"
```

### 3️⃣ Copiar el Modelo

Después de la exportación, copia el archivo generado a este directorio:

```bash
# Windows
copy yolov8n.onnx public\models\yolov8n.onnx

# Linux/Mac
cp yolov8n.onnx public/models/yolov8n.onnx
```

### 4️⃣ Verificar

El archivo debe estar en:
```
public/models/yolov8n.onnx  (~6 MB)
```

### 🔄 Modelos Alternativos

Si necesitas mayor precisión (sacrificando velocidad):

**YOLOv8s (Small)** - Mayor precisión (~22 MB):
```python
YOLO('yolov8s.pt').export(format='onnx', simplify=True, opset=12)
# Renombrar a yolov8n.onnx o cambiar ruta en src/hooks/useYOLO.ts
```

**YOLOv8m (Medium)** - Máxima precisión (~50 MB):
```python
YOLO('yolov8m.pt').export(format='onnx', simplify=True, opset=12)
# Renombrar a yolov8n.onnx o cambiar ruta en src/hooks/useYOLO.ts
```

### ℹ️ Más Información

Ver documentación completa: **[README_YOLO_SETUP.md](../../README_YOLO_SETUP.md)**

---

**Nota:** Mientras el modelo no esté disponible, el sistema de visión AI no funcionará. Las funciones de detección lanzarán errores en consola al intentar cargar el modelo.
