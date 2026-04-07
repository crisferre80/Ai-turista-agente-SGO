-- Tabla para almacenar registros de análisis de visión IA
-- Guarda datos de detecciones de objetos, personas y análisis en tiempo real

CREATE TABLE IF NOT EXISTS vision_analysis_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Datos del análisis
  people_count INTEGER DEFAULT 0,
  group_type TEXT, -- 'solo', 'pareja', 'familia', 'grupo_grande'
  detected_objects TEXT[], -- Array de objetos detectados
  detected_landmarks TEXT[], -- Monumentos/lugares reconocidos
  
  -- Métricas de rendimiento
  confidence_score DECIMAL(3, 2), -- 0.00 a 1.00
  processing_time INTEGER, -- ms
  
  -- Análisis avanzado
  has_children BOOLEAN DEFAULT FALSE,
  needs_accessibility BOOLEAN DEFAULT FALSE,
  is_pointing BOOLEAN DEFAULT FALSE,
  pointing_direction JSONB, -- {x, y, z}
  
  -- Reconocimiento facial
  known_faces_count INTEGER DEFAULT 0,
  unknown_faces_count INTEGER DEFAULT 0,
  face_ids TEXT[], -- IDs de caras reconocidas
  
  -- Snapshot
  snapshot_url TEXT, -- URL de la imagen capturada
  
  -- Detecciones completas (JSON)
  yolo_detections JSONB,
  pose_analysis JSONB,
  face_recognition JSONB,
  suggestions JSONB,
  
  -- Metadata
  camera_location JSONB, -- {lat, lng}
  device_info TEXT,
  admin_user_id UUID REFERENCES auth.users(id)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_vision_records_created_at ON vision_analysis_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vision_records_people_count ON vision_analysis_records(people_count);
CREATE INDEX IF NOT EXISTS idx_vision_records_group_type ON vision_analysis_records(group_type);

-- RLS (Row Level Security) - Solo admins pueden ver registros
ALTER TABLE vision_analysis_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all vision records"
  ON vision_analysis_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert vision records"
  ON vision_analysis_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete vision records"
  ON vision_analysis_records
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Vista para estadísticas agregadas
CREATE OR REPLACE VIEW vision_statistics AS
SELECT
  COUNT(*) as total_analyses,
  AVG(people_count) as avg_people_count,
  AVG(processing_time) as avg_processing_time,
  AVG(confidence_score) as avg_confidence,
  COUNT(DISTINCT DATE(created_at)) as days_active
FROM vision_analysis_records
WHERE created_at > NOW() - INTERVAL '30 days';

-- Función para obtener objetos más comunes
CREATE OR REPLACE FUNCTION get_most_common_objects(limit_count INTEGER DEFAULT 10)
RETURNS TABLE(object_name TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    unnest_obj as object_name,
    COUNT(*) as count
  FROM vision_analysis_records,
  LATERAL unnest(detected_objects) as unnest_obj
  WHERE created_at > NOW() - INTERVAL '30 days'
  GROUP BY unnest_obj
  ORDER BY count DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Comentarios para documentación
COMMENT ON TABLE vision_analysis_records IS 'Registros de análisis de visión artificial con YOLO y MediaPipe';
COMMENT ON COLUMN vision_analysis_records.people_count IS 'Número de personas detectadas en el frame';
COMMENT ON COLUMN vision_analysis_records.group_type IS 'Tipo de grupo: solo, pareja, familia, grupo_grande';
COMMENT ON COLUMN vision_analysis_records.confidence_score IS 'Puntuación de confianza del análisis (0-1)';
COMMENT ON COLUMN vision_analysis_records.processing_time IS 'Tiempo de procesamiento en milisegundos';
