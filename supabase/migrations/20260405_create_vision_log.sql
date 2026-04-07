-- Migration: Create vision_analysis_log table
-- Description: Logs vision analysis results for analytics and improvement
-- Purpose: Track what Santi "sees" to improve suggestions over time

-- Create vision_analysis_log table
CREATE TABLE IF NOT EXISTS public.vision_analysis_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  location JSONB, -- {lat: number, lng: number}
  detections JSONB NOT NULL DEFAULT '{}'::jsonb, -- {people_count, objects[], landmarks[]}
  suggestions_given TEXT[] DEFAULT ARRAY[]::TEXT[],
  confidence FLOAT8 NOT NULL DEFAULT 0.0,
  processing_time_ms INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_vision_log_timestamp 
  ON public.vision_analysis_log(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_vision_log_user_id 
  ON public.vision_analysis_log(user_id);

CREATE INDEX IF NOT EXISTS idx_vision_log_location 
  ON public.vision_analysis_log USING GIN(location);

CREATE INDEX IF NOT EXISTS idx_vision_log_detections 
  ON public.vision_analysis_log USING GIN(detections);

-- Enable Row Level Security
ALTER TABLE public.vision_analysis_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Policy: Users can view their own analysis logs
CREATE POLICY "Users can view their own vision logs"
  ON public.vision_analysis_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: System can insert analysis logs
CREATE POLICY "System can insert vision logs"
  ON public.vision_analysis_log
  FOR INSERT
  WITH CHECK (true);

-- Policy: Admin users can view all logs (for analytics)
CREATE POLICY "Admins can view all vision logs"
  ON public.vision_analysis_log
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Function to get vision analytics summary
CREATE OR REPLACE FUNCTION get_vision_analytics(
  start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  total_analyses BIGINT,
  total_people_detected BIGINT,
  avg_group_size NUMERIC,
  most_common_objects TEXT[],
  most_detected_landmarks TEXT[],
  avg_confidence NUMERIC,
  avg_processing_time NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_analyses,
    SUM((detections->>'people_count')::INTEGER)::BIGINT AS total_people_detected,
    ROUND(AVG((detections->>'people_count')::INTEGER), 2) AS avg_group_size,
    ARRAY_AGG(DISTINCT obj ORDER BY obj) FILTER (WHERE obj IS NOT NULL) AS most_common_objects,
    ARRAY_AGG(DISTINCT landmark ORDER BY landmark) FILTER (WHERE landmark IS NOT NULL) AS most_detected_landmarks,
    ROUND(AVG(confidence), 3) AS avg_confidence,
    ROUND(AVG(processing_time_ms), 2) AS avg_processing_time
  FROM public.vision_analysis_log,
       LATERAL jsonb_array_elements_text(detections->'objects') AS obj,
       LATERAL jsonb_array_elements_text(detections->'landmarks') AS landmark
  WHERE timestamp BETWEEN start_date AND end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old logs (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_vision_logs(days_to_keep INTEGER DEFAULT 180)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.vision_analysis_log
  WHERE timestamp < NOW() - INTERVAL '1 day' * days_to_keep;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE public.vision_analysis_log IS 
  'Logs vision analysis results for analytics. Helps improve Santi AI suggestions.';

COMMENT ON COLUMN public.vision_analysis_log.detections IS 
  'JSON object containing: {people_count: number, objects: string[], landmarks: string[]}';

COMMENT ON COLUMN public.vision_analysis_log.suggestions_given IS 
  'Array of suggestion messages presented to the user';

COMMENT ON COLUMN public.vision_analysis_log.confidence IS 
  'Overall confidence score of the analysis (0.0 - 1.0)';
