-- Add table for carousel configuration values

CREATE TABLE IF NOT EXISTS public.carousel_settings (
  key TEXT PRIMARY KEY,
  animation_duration NUMERIC DEFAULT 25 -- seconds per full loop
);

-- insert default row if missing
INSERT INTO public.carousel_settings (key, animation_duration)
VALUES ('global', 25)
ON CONFLICT (key) DO NOTHING;
