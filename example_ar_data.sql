-- Ejemplo de datos de atractivo turístico con contenido AR
-- Ejecutar en el editor SQL de Supabase para probar el sistema

-- 1. Ejemplo: Catedral de Santiago del Estero con contenido AR completo
UPDATE attractions
SET 
  has_ar_content = true,
  ar_model_url = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF/DamagedHelmet.gltf',
  ar_hotspots = '{
    "hotspots": [
      {
        "id": "info-1",
        "type": "info",
        "position": [0, 1.5, -2],
        "title": "Historia de la Catedral",
        "description": "La Basílica Catedral de Santiago del Estero es el templo principal de la ciudad y uno de los más antiguos de Argentina. Fue construida entre 1867 y 1877.",
        "image_url": "https://res.cloudinary.com/dhvrrxejo/image/upload/v1768455560/istockphoto-1063378272-612x612_vby7gq.jpg"
      },
      {
        "id": "info-2",
        "type": "info",
        "position": [2, 1, -3],
        "title": "Arquitectura",
        "description": "El templo presenta un estilo neoclásico italiano con influencias románicas. Su fachada cuenta con dos torres simétricas y un atrio con columnas.",
        "rotation": [0, 45, 0]
      },
      {
        "id": "video-1",
        "type": "video",
        "position": [-2, 1.2, -2.5],
        "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "title": "Recorrido Virtual",
        "thumbnail_url": "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg"
      },
      {
        "id": "audio-1",
        "type": "audio",
        "position": [0, 0.8, -1.5],
        "title": "Narración Histórica",
        "audio_url": "https://www2.cs.uic.edu/~i101/SoundFiles/StarWars60.wav"
      }
    ]
  }'::jsonb,
  qr_code = 'ATR-CATEDRAL-SGO-001'
WHERE id IN (
  SELECT id FROM attractions 
  WHERE name ILIKE '%catedral%' AND lat IS NOT NULL 
  LIMIT 1
);

-- 2. Ejemplo: Monumento con modelo 3D simple
-- (Para testing, usar modelo de ejemplo de Three.js)
UPDATE attractions
SET 
  has_ar_content = true,
  ar_model_url = 'https://threejs.org/examples/models/gltf/Horse.glb',
  ar_hotspots = '{
    "hotspots": [
      {
        "id": "info-main",
        "type": "info",
        "position": [0, 2, -3],
        "title": "Información del Monumento",
        "description": "Este es un monumento histórico importante de Santiago del Estero.",
        "rotation": [0, 0, 0]
      }
    ]
  }'::jsonb,
  qr_code = 'ATR-MONUMENTO-SGO-002'
WHERE id IN (
  SELECT id FROM attractions 
  WHERE category = 'histórico' 
  AND lat IS NOT NULL 
  LIMIT 1
);

-- 3. Ejemplo: Plaza con múltiples hotspots
UPDATE attractions
SET 
  has_ar_content = true,
  ar_model_url = NULL,  -- Sin modelo principal, solo hotspots
  ar_hotspots = '{
    "hotspots": [
      {
        "id": "info-norte",
        "type": "info",
        "position": [0, 1.5, -3],
        "title": "Sector Norte",
        "description": "Zona de juegos infantiles y área recreativa.",
        "image_url": "https://picsum.photos/400/300"
      },
      {
        "id": "info-sur",
        "type": "info",
        "position": [0, 1.5, 3],
        "title": "Sector Sur",
        "description": "Área de descanso con bancos y árboles centenarios.",
        "image_url": "https://picsum.photos/400/300"
      },
      {
        "id": "info-este",
        "type": "info",
        "position": [3, 1.5, 0],
        "title": "Sector Este",
        "description": "Monumento conmemorativo y fuente central.",
        "image_url": "https://picsum.photos/400/300"
      },
      {
        "id": "video-historia",
        "type": "video",
        "position": [-3, 1.2, 0],
        "video_url": "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
        "title": "Historia de la Plaza"
      }
    ]
  }'::jsonb,
  qr_code = 'ATR-PLAZA-SGO-003'
WHERE id IN (
  SELECT id FROM attractions 
  WHERE name ILIKE '%plaza%' AND lat IS NOT NULL 
  LIMIT 1
);

-- 4. Insertar nuevo atractivo de ejemplo con AR (si no existe uno adecuado)
INSERT INTO attractions (
  id,
  name,
  description,
  lat,
  lng,
  image_url,
  category,
  has_ar_content,
  ar_model_url,
  ar_hotspots,
  qr_code,
  created_at
) VALUES (
  gen_random_uuid(),
  'Torre Histórica (Demo AR)',
  'Ejemplo de atractivo con realidad aumentada completa para demostración del sistema.',
  -27.7834,
  -64.2599,
  'https://res.cloudinary.com/dhvrrxejo/image/upload/v1768455560/istockphoto-1063378272-612x612_vby7gq.jpg',
  'histórico',
  true,
  'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb',
  '{
    "hotspots": [
      {
        "id": "welcome",
        "type": "info",
        "position": [0, 2, -2],
        "title": "¡Bienvenido a AR!",
        "description": "Este es un ejemplo de cómo funciona el sistema de realidad aumentada. Toca los elementos flotantes para ver más información."
      },
      {
        "id": "demo-video",
        "type": "video",
        "position": [2, 1.5, -2],
        "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "title": "Video Demostrativo"
      },
      {
        "id": "demo-audio",
        "type": "audio",
        "position": [-2, 1, -2],
        "title": "Audio de Prueba",
        "audio_url": "https://www2.cs.uic.edu/~i101/SoundFiles/StarWars60.wav"
      }
    ]
  }'::jsonb,
  'ATR-DEMO-AR-001',
  NOW()
)
ON CONFLICT DO NOTHING;

-- Verificar los cambios
SELECT 
  id,
  name,
  has_ar_content,
  ar_model_url,
  qr_code,
  jsonb_array_length(ar_hotspots->'hotspots') as num_hotspots
FROM attractions
WHERE has_ar_content = true
ORDER BY created_at DESC;

-- Notas importantes:
-- 1. Los modelos 3D de ejemplo son de repositorios públicos para testing
-- 2. Para producción, subir modelos propios a Supabase Storage:
--    - Ir a Storage > Crear bucket 'ar-models'
--    - Subir archivos .glb o .gltf
--    - Hacer público el bucket
--    - Usar URL: https://[tu-proyecto].supabase.co/storage/v1/object/public/ar-models/modelo.glb
-- 3. Los videos de ejemplo apuntan a YouTube, reemplazar con los reales
-- 4. Los códigos QR deben ser únicos y legibles (sin espacios ni caracteres especiales)
-- 5. Las posiciones en hotspots son coordenadas 3D [x, y, z] relativas al usuario:
--    - x: horizontal (izquierda-derecha)
--    - y: vertical (arriba-abajo)
--    - z: profundidad (cerca-lejos, valores negativos = alejarse del usuario)
