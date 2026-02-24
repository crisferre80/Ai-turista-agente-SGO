-- Add image and video URL columns to promotional_messages

ALTER TABLE promotional_messages
    ADD COLUMN IF NOT EXISTS image_url text,
    ADD COLUMN IF NOT EXISTS video_url text;

-- Ensure default empty strings to avoid null issues
ALTER TABLE promotional_messages
    ALTER COLUMN image_url SET DEFAULT '';
ALTER TABLE promotional_messages
    ALTER COLUMN video_url SET DEFAULT '';

-- Update existing rows to set non-null values if necessary
UPDATE promotional_messages
    SET image_url = ''
    WHERE image_url IS NULL;
UPDATE promotional_messages
    SET video_url = ''
    WHERE video_url IS NULL;
