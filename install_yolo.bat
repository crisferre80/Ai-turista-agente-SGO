@echo off
echo ========================================
echo   INSTALADOR DE MODELO YOLO
echo   Para Vision AI - SantiGuia
echo ========================================
echo.

REM Verificar Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python no esta instalado
    echo.
    echo Por favor instala Python desde:
    echo https://www.python.org/downloads/
    echo.
    echo Asegurate de marcar "Add Python to PATH"
    pause
    exit /b 1
)

echo [OK] Python encontrado
python --version
echo.

REM Instalar Ultralytics
echo [1/3] Instalando Ultralytics...
python -m pip install --upgrade pip
python -m pip install ultralytics
if errorlevel 1 (
    echo [ERROR] Fallo la instalacion de Ultralytics
    pause
    exit /b 1
)
echo [OK] Ultralytics instalado
echo.

REM Exportar modelo
echo [2/3] Exportando modelo YOLOv8n a ONNX...
echo Esto puede tomar 1-2 minutos (descargara ~6 MB)...
python export_yolo_model.py
if errorlevel 1 (
    echo [ERROR] Fallo la exportacion del modelo
    pause
    exit /b 1
)
echo.

REM Verificar archivo
echo [3/3] Verificando instalacion...
if exist "public\models\yolov8n.onnx" (
    echo.
    echo ========================================
    echo   INSTALACION EXITOSA
    echo ========================================
    echo.
    echo Modelo instalado en: public\models\yolov8n.onnx
    dir "public\models\yolov8n.onnx"
    echo.
    echo Siguiente paso:
    echo - Reinicia el servidor de desarrollo
    echo - Di: "Santi, que ves?" para probar
    echo.
) else (
    echo [ERROR] El archivo yolov8n.onnx no se encontro
    echo Verifica la carpeta public\models\
)

echo.
pause
