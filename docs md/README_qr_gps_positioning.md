# WebXR Tools - QR con Imagen de Referencia y GPS Positioning

## Actualizaciones

Se han implementado dos nuevos flujos en WebXR Tools:

### 1. QR Code con Imagen de Referencia (Tab QR)

**Componente**: `ImageQRUploader.tsx`

#### Flujo Completo

1. **Subir Imagen de Referencia**
   - El administrador sube una imagen física que servirá como marcador AR
   - Puede ser: póster, logo, cartel, fotografía, etc.
   - Validaciones: JPG/PNG, máximo 5MB
   - La imagen se sube a Supabase Storage (`ar-assets/reference-images/`)

2. **Configurar Tamaño Físico**
   - Se especifica el tamaño real de la imagen impresa (en metros)
   - Ejemplo: 0.15 metros = 15 cm
   - Este valor es crítico para la detección correcta por WebXR Image Tracking

3. **Generar Código QR**
   - El sistema genera un QR que contiene:
     ```json
     {
       "type": "ar-marker",
       "attractionId": "uuid-del-atractivo",
       "attractionName": "Nombre del Atractivo",
       "referenceImageUrl": "https://storage.url/reference.jpg",
       "physicalWidth": 0.15,
       "timestamp": 1234567890
     }
     ```
   - Configuración del QR:
     - Tamaño: 1024x1024 px
     - Error Correction: High (H) - soporta hasta 30% de daño
     - Formato: PNG con fondo blanco

4. **Descargar/Imprimir**
   - El QR se puede descargar como PNG
   - O imprimir directamente con instrucciones

#### Uso en Campo

1. **Instalación Física**:
   - Imprime la **imagen de referencia** en alta calidad
   - Imprime el **código QR** generado
   - Coloca ambos juntos en la ubicación física (pegados o cerca)

2. **Experiencia del Usuario**:
   - Usuario abre la app móvil
   - Escanea el código QR con la cámara
   - La app carga la configuración del marker
   - WebXR Image Tracking detecta automáticamente la imagen de referencia
   - El objeto 3D se ancla en la posición de la imagen
   - El usuario ve el objeto 3D superpuesto sobre la imagen física

#### Ventajas

- ✅ No requiere GPS (funciona en interiores)
- ✅ Alta precisión (detección de imagen)
- ✅ Fácil instalación (solo imprimir y pegar)
- ✅ El QR es pequeño, la imagen puede ser grande
- ✅ Funciona sin conexión después de escanear el QR

#### Tecnologías

- **WebXR Image Tracking API**: Detecta imágenes físicas en tiempo real
- **qrcode**: Genera códigos QR con alta corrección de errores
- **Supabase Storage**: Almacena imágenes de referencia
- **Canvas API**: Renderiza y descarga QR codes

---

### 2. GPS Object Positioning (Tab GPS)

**Componente**: `GPSObjectPositioner.tsx`

#### Flujo Completo

1. **Seleccionar Ubicación**
   - **Búsqueda por Nombre**: Ingresa dirección o nombre del lugar
     - Usa Nominatim API (OpenStreetMap)
     - Ejemplo: "Plaza de Armas, Santiago"
   
   - **Mi Ubicación Actual**: Usa Geolocation API
     - Requiere permisos del navegador
     - Obtiene coordenadas GPS precisas
   
   - **Coordenadas Manuales**: Ingresa lat/lng directamente
     - Formato decimal: -33.456789, -70.678901
     - 6 decimales de precisión (~10 cm)

2. **Visualización en Mapa**
   - Mapa interactivo con iframe de OpenStreetMap
   - Marcador en las coordenadas seleccionadas
   - Caja con coordenadas visible en tiempo real

3. **Configurar Posición**
   - **Latitud/Longitud**: Coordenadas geográficas
   - **Altitud** (opcional): Metros sobre el suelo
     - Útil para elevar objetos (ej: nube a 10m de altura)
   - **Etiqueta**: Nombre descriptivo del punto
     - Ejemplo: "Entrada principal", "Mirador norte"

4. **Guardar Posición**
   - Se guarda en la tabla `ar_positioned_objects`
   - Campos:
     - `attraction_id`: UUID del atractivo
     - `latitude`, `longitude`, `altitude`
     - `label`: Etiqueta descriptiva
     - `model_url`: URL del modelo 3D (heredado del atractivo)

5. **Gestión de Posiciones**
   - Lista de posiciones guardadas por atractivo
   - Acciones:
     - **Editar**: Cargar coordenadas en el formulario
     - **Eliminar**: Borrar posición

#### Uso en la App Móvil

1. **Detección Automática**:
   - La app obtiene la ubicación GPS del usuario continuamente
   - Calcula distancia a cada objeto posicionado
   - Cuando el usuario está cerca (ej: < 50m), el objeto aparece

2. **Renderizado**:
   - El objeto 3D se ancla en las coordenadas GPS exactas
   - Se utiliza WebXR Geospatial API o similar
   - El objeto persiste en esa ubicación mientras el usuario camina

3. **Precisión**:
   - **GPS típico**: 5-10 metros de precisión
   - **GPS-Assisted**: 1-5 metros
   - **RTK GPS**: < 1 metro (requiere hardware especial)

#### Ventajas

- ✅ Funciona al aire libre sin marcadores físicos
- ✅ Objetos persistentes en el mundo real
- ✅ Perfecto para monumentos, parques, rutas turísticas
- ✅ Actualización remota (cambias la posición desde el admin)

#### Casos de Uso

- 🗿 **Monumentos**: Información AR flotando sobre la estatua
- 🌳 **Rutas de Senderismo**: Marcadores de dirección cada 100m
- 🏛️ **Tours Urbanos**: Objetos en puntos de interés
- 🎨 **Arte Urbano**: Contenido AR en murales específicos

#### Tecnologías

- **Geolocation API**: Ubicación del usuario
- **Nominatim API**: Búsqueda de lugares (OSM)
- **OpenStreetMap**: Mapa embebido con iframe
- **Supabase**: Base de datos para posiciones guardadas

---

## Base de Datos

### Nueva Tabla: `ar_positioned_objects`

```sql
CREATE TABLE ar_positioned_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attraction_id UUID NOT NULL REFERENCES attractions(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  altitude DOUBLE PRECISION DEFAULT 0,
  label TEXT NOT NULL,
  model_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Columna Agregada: `attractions.reference_image_url`

```sql
ALTER TABLE attractions 
  ADD COLUMN reference_image_url TEXT;
```

**Migración**: `supabase/migrations/20250101_ar_positioned_objects.sql`

---

## Cambios en WebXR Tools Admin

### Nuevo Tab: "GPS Positioning"

- Icono: 📍 MapPin
- Ubicación: Entre "QR Codes" y "Image Tracking"
- Componente: `GPSObjectPositioner`

### Tab QR Actualizado

- **Antes**: Solo generaba QR con URL del atractivo
- **Ahora**: Flujo completo con subida de imagen de referencia
- **Componente**: `ImageQRUploader` (reemplaza `QRCodeManager`)

### Fix: useCallback en loadAttractions

Se corrigió el problema del fetch de atractivos:

```typescript
const loadAttractions = useCallback(async () => {
  // ... código de fetch
}, []); // Sin dependencias, se ejecuta solo una vez

useEffect(() => {
  checkAuth();
}, [router, loadAttractions]); // loadAttractions ahora es estable
```

**Problema anterior**: `loadAttractions` se recreaba en cada render, causando loops infinitos.

---

## Instrucciones de Despliegue

### 1. Ejecutar Migración

```bash
# Opción A: Con Supabase CLI
npx supabase db push

# Opción B: En Supabase Dashboard
# - Ve a SQL Editor
# - Copia el contenido de supabase/migrations/20250101_ar_positioned_objects.sql
# - Ejecuta el script
```

### 2. Configurar Storage Bucket

Asegúrate de que el bucket `ar-assets` existe en Supabase Storage y tiene las políticas correctas:

```sql
-- Política de lectura pública
CREATE POLICY "ar_assets_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ar-assets');

-- Política de escritura (solo admins)
CREATE POLICY "ar_assets_admin_write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ar-assets' AND
    auth.role() = 'admin'
  );
```

### 3. Build y Deploy

```bash
npm run build
# Desplegar en tu plataforma (Vercel, Netlify, etc.)
```

---

## Testing

### QR Workflow

1. Ve a `/admin/webxr-tools`
2. Selecciona un atractivo
3. Ve al tab "QR Codes"
4. Sube una imagen de referencia (ej: logo de 20x20cm)
5. Ajusta el tamaño físico: 0.20 metros
6. Genera QR
7. Descarga tanto la imagen como el QR
8. Imprime ambos y colócalos juntos

### GPS Workflow

1. Ve al tab "GPS Positioning"
2. Busca "Plaza de Armas, Santiago" (o usa tu ubicación actual)
3. Ajusta coordenadas si es necesario
4. Ingresa etiqueta: "Entrada Principal"
5. Guarda posición
6. Verifica que aparece en la lista de posiciones guardadas

---

## Próximos Pasos

### Frontend Móvil (App)

1. **Lector de QR**:
   - Escanear QR → Parsear JSON
   - Descargar imagen de referencia
   - Cargar en WebXR Image Tracking
   - Detectar imagen → Anclar objeto 3D

2. **GPS Fetching**:
   - Obtener ubicación del usuario
   - Query a Supabase: objetos cerca (< 50m)
   - Renderizar objetos en coordenadas GPS
   - Usar WebXR Geospatial Anchors o similar

### Mejoras Futuras

- [ ] Mapa interactivo con react-leaflet (más control que iframe)
- [ ] Subida de múltiples imágenes de referencia por atractivo
- [ ] Preview AR en el admin (vista previa del objeto en la imagen)
- [ ] Estadísticas: cuántas veces se escanea cada QR
- [ ] Editor visual de coordenadas (arrastrar marcadores en el mapa)
- [ ] Soporte para markers circulares (cercos geográficos)

---

## Troubleshooting

### "No se pueden cargar atractivos"

- ✅ **Fix aplicado**: `useCallback` en `loadAttractions`
- Verifica el console.log: "Error cargando atractivos:"
- Revisa permisos de Supabase (políticas RLS)

### "Error subiendo imagen"

- Verifica que el bucket `ar-assets` existe
- Revisa políticas de Storage
- Tamaño máximo: 5MB (configurable en el componente)

### "QR no se genera"

- Asegúrate de que `qrcode` está instalado: `npm install qrcode @types/qrcode`
- Revisa console del navegador
- Verifica que Canvas API esté disponible

### "Mapa no se muestra"

- El iframe de OSM puede ser bloqueado por Content Security Policy
- Agrega a `next.config.ts`:
  ```typescript
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: "frame-src 'self' https://www.openstreetmap.org"
        }
      ]
    }]
  }
  ```

---

## Documentación Relacionada

- [README_webxr_implementation.md](./README_webxr_implementation.md)
- [README_ar_config_panel.md](./README_ar_config_panel.md)
- [WebXR Image Tracking API](https://immersive-web.github.io/marker-tracking/)
- [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
