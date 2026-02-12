-- Create app_settings table for storing key/value config
CREATE TABLE IF NOT EXISTS app_settings (
  key text primary key,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Seed defaults
INSERT INTO app_settings (key, value) VALUES
('ia_provider', '"gemini"'),
('ia_model', '"gemini-2.0-flash-exp"'),
('tts_provider', '"openai"'),
('tts_engine', '"alloy"')
ON CONFLICT (key) DO NOTHING;