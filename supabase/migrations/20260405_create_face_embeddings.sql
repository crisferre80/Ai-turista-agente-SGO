-- Migration: Create face_embeddings table for facial recognition
-- Description: Stores facial embeddings for recognizing returning visitors
-- Privacy: Only stores mathematical embeddings, not actual images

-- Create face_embeddings table
CREATE TABLE IF NOT EXISTS public.face_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  embedding FLOAT8[] NOT NULL,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  visit_count INTEGER NOT NULL DEFAULT 1,
  nickname TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_face_embeddings_user_id 
  ON public.face_embeddings(user_id);

CREATE INDEX IF NOT EXISTS idx_face_embeddings_last_seen 
  ON public.face_embeddings(last_seen DESC);

CREATE INDEX IF NOT EXISTS idx_face_embeddings_visit_count 
  ON public.face_embeddings(visit_count DESC);

-- Enable Row Level Security
ALTER TABLE public.face_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Policy: Public can read their own embeddings
CREATE POLICY "Users can view their own face embeddings"
  ON public.face_embeddings
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR user_id IS NULL -- Anonymous faces can be viewed in aggregation
  );

-- Policy: System can insert new faces (anonymous or authenticated)
CREATE POLICY "System can insert face embeddings"
  ON public.face_embeddings
  FOR INSERT
  WITH CHECK (true); -- Allow inserts from vision analysis system

-- Policy: System can update visit counts and last_seen
CREATE POLICY "System can update face embeddings"
  ON public.face_embeddings
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Policy: Users can delete their own face data (GDPR compliance)
CREATE POLICY "Users can delete their own face embeddings"
  ON public.face_embeddings
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_face_embeddings_updated_at
  BEFORE UPDATE ON public.face_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to purge old face embeddings (GDPR compliance)
CREATE OR REPLACE FUNCTION purge_old_face_embeddings(days_threshold INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.face_embeddings
  WHERE last_seen < NOW() - INTERVAL '1 day' * days_threshold
    AND user_id IS NULL; -- Only purge anonymous faces
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE public.face_embeddings IS 
  'Stores facial embeddings for visitor recognition. Privacy-compliant: only mathematical vectors, no images.';

COMMENT ON COLUMN public.face_embeddings.embedding IS 
  'Normalized facial feature vector for similarity matching';

COMMENT ON COLUMN public.face_embeddings.visit_count IS 
  'Number of times this face has been detected';

COMMENT ON COLUMN public.face_embeddings.nickname IS 
  'Optional friendly name for recognized visitor';
