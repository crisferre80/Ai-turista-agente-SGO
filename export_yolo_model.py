#!/usr/bin/env python3
"""
Script para exportar YOLOv8n a formato ONNX
Uso: python export_yolo_model.py
"""

import os
import sys
from pathlib import Path

def main():
    print("=" * 60)
    print("🚀 EXPORTADOR DE MODELO YOLO PARA VISION AI")
    print("=" * 60)
    print()
    
    # Verificar instalación de ultralytics
    try:
        from ultralytics import YOLO
        print("✅ Ultralytics instalado correctamente")
    except ImportError:
        print("❌ ERROR: Ultralytics no está instalado")
        print()
        print("Instala con: pip install ultralytics")
        sys.exit(1)
    
    # Configuración
    model_name = 'yolov8n.pt'
    output_name = 'yolov8n.onnx'
    output_dir = Path('public/models')
    
    print(f"📦 Modelo a exportar: {model_name}")
    print(f"📁 Directorio de salida: {output_dir}")
    print()
    
    # Crear directorio si no existe
    output_dir.mkdir(parents=True, exist_ok=True)
    print(f"✅ Directorio {output_dir} verificado")
    
    # Cargar modelo (se descarga automáticamente si no existe)
    print()
    print("⏬ Descargando modelo YOLOv8n (primera vez ~6 MB)...")
    try:
        model = YOLO(model_name)
        print("✅ Modelo cargado correctamente")
    except Exception as e:
        print(f"❌ ERROR al cargar modelo: {e}")
        sys.exit(1)
    
    # Exportar a ONNX
    print()
    print("🔄 Exportando a formato ONNX...")
    print("   (Esto puede tomar 1-2 minutos)")
    try:
        export_path = model.export(
            format='onnx',
            dynamic=False,
            simplify=True,
            opset=12
        )
        print(f"✅ Modelo exportado: {export_path}")
    except Exception as e:
        print(f"❌ ERROR al exportar: {e}")
        sys.exit(1)
    
    # Mover al directorio público
    print()
    print(f"📦 Moviendo modelo a {output_dir}...")
    
    source_file = Path(export_path)
    dest_file = output_dir / output_name
    
    try:
        if dest_file.exists():
            print(f"⚠️  El archivo {dest_file} ya existe. Sobrescribiendo...")
            dest_file.unlink()
        
        source_file.rename(dest_file)
        print(f"✅ Modelo copiado correctamente")
    except Exception as e:
        print(f"❌ ERROR al mover archivo: {e}")
        print(f"   Intenta copiar manualmente:")
        print(f"   cp {source_file} {dest_file}")
        sys.exit(1)
    
    # Verificar tamaño del archivo
    file_size = dest_file.stat().st_size / (1024 * 1024)  # MB
    print()
    print("=" * 60)
    print("✨ ¡EXPORTACIÓN EXITOSA!")
    print("=" * 60)
    print(f"📍 Ubicación: {dest_file}")
    print(f"💾 Tamaño: {file_size:.2f} MB")
    print()
    print("🎯 Siguiente paso:")
    print("   1. Reinicia el servidor de desarrollo (npm run dev)")
    print("   2. Di: 'Santi, ¿qué ves?' para probar el sistema de visión")
    print()
    print("📖 Documentación completa: README_VISION_AI_SYSTEM.md")
    print("=" * 60)

if __name__ == '__main__':
    main()
