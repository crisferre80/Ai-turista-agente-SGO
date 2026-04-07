# ⚡ Guía Rápida: Exportar Modelo YOLO

Si estás viendo este mensaje en consola, significa que necesitas exportar el modelo YOLO para que el sistema de visión AI funcione.

## 🚀 Pasos Rápidos (5 minutos)

### 1. Instalar Ultralytics

```bash
pip install ultralytics
```

### 2. Exportar YOLOv8n

Ejecuta este comando en tu terminal:

```bash
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt').export(format='onnx', simplify=True, opset=12)"
```

Esto descargará el modelo pre-entrenado (~6 MB) y lo exportará a formato ONNX.

### 3. Mover el Archivo

```bash
# Windows
move yolov8n.onnx public\models\yolov8n.onnx

# Linux/Mac
mv yolov8n.onnx public/models/yolov8n.onnx
```

### 4. Reiniciar Servidor

```bash
# Detener servidor (Ctrl+C)
# Iniciar de nuevo
npm run dev
```

## ✅ Verificar Instalación

Después de copiar el modelo, verifica que existe:

```bash
# Debe mostrar: public/models/yolov8n.onnx (~6 MB)
ls -lh public/models/yolov8n.onnx       # Linux/Mac
dir public\models\yolov8n.onnx          # Windows
```

## 📖 Documentación Completa

Para más detalles sobre modelos alternativos, optimización y troubleshooting:

- **[README_YOLO_SETUP.md](README_YOLO_SETUP.md)** - Configuración completa
- **[README_VISION_AI_SYSTEM.md](README_VISION_AI_SYSTEM.md)** - Sistema de visión
- **[public/models/README.md](public/models/README.md)** - Info del directorio

## 🐛 Problemas Comunes

**Error: "No module named 'ultralytics'"**
```bash
pip install --upgrade ultralytics
```

**Error: "Permission denied"**
```bash
# Linux/Mac
sudo mv yolov8n.onnx public/models/

# Windows: Ejecuta terminal como Administrador
```

**Error: "File not found" después de copiar**
```bash
# Verifica ruta completa
pwd  # Debes estar en raíz del proyecto tourist-assistant
```

---

💡 **Tip:** Una vez exportado, el modelo se reutiliza en todos los arranques. Solo necesitas hacer esto una vez.
