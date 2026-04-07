# 🐍 Instalación de Python y YOLO - Guía Paso a Paso

## ⚡ Instalación Rápida (Windows)

### Paso 1: Instalar Python

**Opción A - Microsoft Store (MÁS FÁCIL):**
1. Abre Microsoft Store
2. Busca "Python 3.12"
3. Haz clic en "Obtener" e instala
4. ✅ Listo, Python se añade automáticamente al PATH

**Opción B - Python.org:**
1. Ve a: https://www.python.org/downloads/
2. Descarga Python 3.12 (versión recomendada)
3. **IMPORTANTE:** Durante la instalación, marca ☑️ "Add Python to PATH"
4. Haz clic en "Install Now"

### Paso 2: Verificar Instalación

Abre PowerShell y ejecuta:
```powershell
python --version
```

Deberías ver algo como: `Python 3.12.x`

### Paso 3: Ejecutar Instalador Automático

Haz doble clic en: **`install_yolo.bat`**

O desde PowerShell:
```powershell
.\install_yolo.bat
```

El script hará automáticamente:
- ✅ Instalar Ultralytics
- ✅ Descargar modelo YOLOv8n (~6 MB)
- ✅ Exportar a formato ONNX
- ✅ Mover a `public/models/yolov8n.onnx`

**Tiempo estimado:** 2-3 minutos

---

## 🔧 Instalación Manual (Si prefieres hacerlo paso a paso)

### 1. Instalar Ultralytics
```powershell
pip install ultralytics
```

### 2. Ejecutar script de exportación
```powershell
python export_yolo_model.py
```

### 3. Verificar
```powershell
dir public\models\yolov8n.onnx
```

Debería mostrar un archivo de ~6 MB

---

## 🌐 Opción Alternativa: Descargar Modelo Pre-exportado

Si tienes problemas con Python, puedes descargar el modelo ya exportado:

### Opción 1: Desde GitHub Releases de Ultralytics
1. Ve a: https://github.com/ultralytics/assets/releases
2. Busca `yolov8n.onnx` (o exporta desde Colab)

### Opción 2: Google Colab (Sin instalar nada)
1. Abre: https://colab.research.google.com/
2. Ejecuta este código:
```python
!pip install ultralytics
from ultralytics import YOLO
model = YOLO('yolov8n.pt')
model.export(format='onnx', simplify=True, opset=12)

# Descargar el archivo
from google.colab import files
files.download('yolov8n.onnx')
```
3. El archivo se descargará a tu PC
4. Copia manualmente a: `public/models/yolov8n.onnx`

---

## ✅ Verificar que Funciona

### 1. Reiniciar servidor de desarrollo
```powershell
npm run dev
```

### 2. Probar en la aplicación
- Di: **"Santi, ¿qué ves?"**
- Deberías ver el overlay de análisis visual

### 3. Consola del navegador
Deberías ver:
```
✅ Modelo YOLO cargado exitosamente
📊 Input names: [...]
📊 Output names: [...]
```

---

## 🐛 Solución de Problemas

### ❌ "Python no se encuentra"
**Solución:** No se añadió al PATH durante instalación
```powershell
# Reinstala Python y marca "Add Python to PATH"
# O añade manualmente: C:\Users\TU_USUARIO\AppData\Local\Programs\Python\Python312
```

### ❌ "pip no se reconoce"
**Solución:**
```powershell
python -m pip install ultralytics
```

### ❌ "Permission denied"
**Solución:** Ejecuta PowerShell como Administrador

### ❌ El archivo .onnx no se genera
**Solución:** Verifica espacio en disco (necesitas ~500 MB temporales)

### ❌ Error al exportar con Ultralytics
**Solución alternativa:** Usa Google Colab (ver arriba)

---

## 📦 ¿Qué se Instala?

| Componente | Tamaño | Dónde |
|------------|--------|-------|
| **Ultralytics** | ~150 MB | Python packages |
| **YOLOv8n.pt** | ~6 MB | Temporal (se descarga automáticamente) |
| **yolov8n.onnx** | ~6 MB | `public/models/` (este es el que usas) |

**Total en tu proyecto:** Solo 6 MB (el archivo .onnx)

---

## 🎯 Después de Instalar

### Para Desarrollo
Ya está listo, solo reinicia el servidor.

### Para Producción
```bash
git add public/models/yolov8n.onnx
git commit -m "feat: add YOLO model for vision AI"
git push
```

El modelo se desplegará automáticamente y estará disponible para **todos los usuarios**.

---

## 🔗 Enlaces Útiles

- **Python Oficial:** https://www.python.org/downloads/
- **Ultralytics Docs:** https://docs.ultralytics.com/
- **YOLO en ONNX:** https://docs.ultralytics.com/modes/export/
- **Google Colab:** https://colab.research.google.com/

---

## 💡 Nota Final

La instalación de YOLO es **completamente opcional**. Si decides no instalarlo:
- ✅ La aplicación funciona perfectamente
- ⚠️ La función de visión AI mostrará: "Sistema de visión no disponible"
- ✅ Todas las demás funciones siguen operativas

Puedes instalarlo en cualquier momento futuro cuando lo necesites.
