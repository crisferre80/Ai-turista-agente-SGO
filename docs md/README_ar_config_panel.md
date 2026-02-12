# 🥽 Sistema de Realidad Aumentada - Configuración Completa

## 📋 Características del Panel de Configuración AR

### ✨ Funcionalidades Implementadas

1. **Lista de Atractivos**
   - Vista de todos los lugares turísticos
   - Indicador visual de estado AR (activo/inactivo)
   - Filtrado y búsqueda
   - Selección rápida

2. **Configuración por Lugar**
   - ✅ Activar/Desactivar AR
   - 📦 Modelo 3D (GLB/GLTF)
   - 📷 Código QR único
   - 📍 Puntos de Interés (Hotspots)

3. **Gestión de Modelos 3D**
   - Subir archivos directamente (.glb, .gltf)
   - Ingresar URL externa
   - Preview de configuración
   - Almacenamiento en Supabase Storage

4. **Hotspots Interactivos**
   - Agregar múltiples puntos de interés
   - Configurar posición 3D (X, Y, Z)
   - Tipos: Información, Imagen, Video
   - Subir contenido multimedia
   - Editar título y descripción

5. **Códigos QR**
   - Generación automática de códigos únicos
   - Personalización opcional
   - Vinculación con lugares

## 🚀 Instalación y Configuración

### 1. Ejecutar Script SQL en Supabase

```sql
-- Ejecutar el archivo: setup_ar_storage.sql
-- Este script crea:
-- - Bucket de storage 'ar-content'
-- - Políticas de acceso
-- - Columnas AR en la tabla attractions
-- - Índices para optimización
```

**Ir a Supabase Dashboard → SQL Editor → Pegar y ejecutar el contenido de `setup_ar_storage.sql`**

### 2. Verificar Bucket de Storage

1. Ir a **Storage** en Supabase
2. Verificar que existe el bucket `ar-content`
3. Debe estar configurado como **público**

### 3. Acceder al Panel AR

```
URL: http://localhost:3000/admin/ar-config
```

O desde el panel admin principal → Click en **"🥽 Config AR"**

## 📖 Guía de Uso

### Configurar un Lugar con AR

1. **Seleccionar Lugar**
   - En la lista izquierda, click en un atractivo
   - Se abre el panel de configuración

2. **Activar AR**
   - Click en el botón "AR Activo/Inactivo"
   - Se activa el formulario de configuración

3. **Agregar Modelo 3D**
   
   **Opción A: Subir archivo**
   - Click en "Seleccionar archivo"
   - Elegir archivo .glb o .gltf
   - Se sube automáticamente a Supabase Storage
   
   **Opción B: URL externa**
   - Pegar URL del modelo en el campo de texto
   - Ejemplo: `https://example.com/models/monumento.glb`

4. **Configurar Código QR**
   - Se genera automáticamente como `AR_[id]`
   - Puedes personalizarlo si deseas

5. **Agregar Hotspots (Puntos de Interés)**
   - Click en "Agregar"
   - Completar campos:
     - **Título**: Nombre del punto
     - **Descripción**: Información detallada
     - **Tipo**: Info/Imagen/Video
     - **Posición 3D**: Coordenadas X, Y, Z
   
   **Posiciones comunes:**
   - Frente: `x: 0, y: 1.5, z: -2`
   - Izquierda: `x: -2, y: 1.5, z: 0`
   - Derecha: `x: 2, y: 1.5, z: 0`
   - Arriba: `x: 0, y: 3, z: 0`

6. **Subir Contenido Multimedia**
   - Para hotspots tipo "Imagen" o "Video"
   - Click en "Subir"
   - Seleccionar archivo
   - Se almacena en `ar-content/ar-hotspots/`

7. **Guardar Configuración**
   - Click en "Guardar Configuración"
   - Verificar mensaje de éxito

## 🎨 Estructura de Datos

### Modelo AR en la Base de Datos

```typescript
// Tabla: attractions

{
  has_ar_content: boolean,
  ar_model_url: string,
  qr_code: string,
  ar_hotspots: {
    hotspots: [
      {
        id: string,
        position: { x: number, y: number, z: number },
        title: string,
        description: string,
        type: 'info' | 'image' | 'video',
        content_url?: string
      }
    ]
  }
}
```

## 📁 Estructura de Storage

```
ar-content/
├── ar-models/
│   ├── [attraction-id]-[timestamp].glb
│   └── [attraction-id]-[timestamp].gltf
└── ar-hotspots/
    ├── hotspot-[id]-[timestamp].jpg
    ├── hotspot-[id]-[timestamp].png
    └── hotspot-[id]-[timestamp].mp4
```

## 🔗 Recursos para Modelos 3D

### Sitios para Descargar Modelos Gratuitos

1. **Sketchfab** - https://sketchfab.com/
   - Filtrar por "Downloadable" y formato "glTF"
   
2. **Poly Pizza** - https://poly.pizza/
   - Modelos low-poly optimizados
   
3. **Google Poly Archive** - https://poly.google.com/
   - Modelos 3D de Google (archivo)

4. **Turbosquid** - https://www.turbosquid.com/
   - Modelos profesionales (gratuitos y de pago)

### Herramientas de Conversión

- **Blender** (gratuito): Para convertir formatos 3D a GLB
- **Sketchfab**: Convierte automáticamente al descargar
- **glTF Viewer**: https://gltf-viewer.donmccurdy.com/

## 🎯 Flujo de Trabajo Recomendado

### Para un Monumento/Lugar

1. **Preparar Contenido**
   - Modelo 3D del monumento (.glb)
   - Fotos históricas
   - Videos informativos
   - Texto descriptivo

2. **Configurar en el Panel**
   - Activar AR
   - Subir modelo principal
   - Crear hotspot "Historia" (frente)
   - Crear hotspot "Galería" (derecha) con imágenes
   - Crear hotspot "Video" (izquierda)

3. **Generar QR**
   - Usar código generado
   - Crear QR físico con herramientas online
   - Imprimir y colocar en el lugar

4. **Probar**
   - Escanear QR desde la app
   - Verificar que carga correctamente
   - Ajustar posiciones de hotspots si es necesario

## 🐛 Solución de Problemas

### El modelo no se ve

- ✅ Verificar que el archivo sea .glb o .gltf
- ✅ Comprobar que la URL sea accesible públicamente
- ✅ Verificar permisos del bucket en Supabase

### Los hotspots no aparecen

- ✅ Verificar que `has_ar_content = true`
- ✅ Comprobar formato del JSON en `ar_hotspots`
- ✅ Ajustar coordenadas de posición

### Error al subir archivos

- ✅ Verificar que el bucket existe
- ✅ Comprobar políticas de storage
- ✅ Usuario debe estar autenticado

### El escáner QR no funciona

- ✅ Verificar conexión HTTPS
- ✅ Dar permisos de cámara
- ✅ Código QR debe coincidir con el campo `qr_code`

## 📊 Estadísticas y Optimización

### Mejores Prácticas

1. **Modelos 3D**
   - Máximo: 5-10 MB por modelo
   - Optimizar polígonos (< 50k triángulos)
   - Usar texturas comprimidas

2. **Imágenes**
   - Formato: JPG/PNG
   - Máximo: 2 MB por imagen
   - Resolución: 1920x1080 o menor

3. **Videos**
   - Formato: MP4 (H.264)
   - Máximo: 20 MB
   - Duración: < 1 minuto

4. **Hotspots**
   - Máximo 5-7 por lugar
   - Distribuir espacialmente
   - Evitar superposición

## 🔐 Seguridad

- Solo usuarios autenticados pueden subir contenido
- Archivos públicos de solo lectura
- Validación de tipos de archivo
- Límites de tamaño

## 📱 Integración con la App

El sistema AR ya está integrado en:
- `PlaceDetailClient.tsx`: Muestra botón "Ver en AR"
- `QRScanner.tsx`: Escanea códigos QR
- `ARViewer.tsx`: Renderiza contenido AR

## 🎓 Próximos Pasos

1. Configurar 3-5 lugares con AR
2. Generar códigos QR físicos
3. Instalar en ubicaciones
4. Probar experiencia completa
5. Recopilar feedback de usuarios

---

## 🆘 Soporte

Para problemas o preguntas:
1. Revisar esta documentación
2. Verificar consola del navegador
3. Comprobar logs en Supabase
4. Verificar permisos y políticas

---

**Creado:** 9 de febrero de 2026
**Versión:** 1.0.0
