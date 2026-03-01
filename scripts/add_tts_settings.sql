-- Agregar configuraciones de TTS a app_settings (key/value table)
-- Estas claves guardan las preferencias de voces de TTS por idioma y género

-- tts_voice_gender: MALE or FEMALE (preferencia general de género para voces TTS)
INSERT INTO app_settings (key, value) 
VALUES ('tts_voice_gender', 'MALE')
ON CONFLICT (key) DO UPDATE SET value = 'MALE';

-- tts_voice_provider: google, openai, browser, etc.
INSERT INTO app_settings (key, value) 
VALUES ('tts_voice_provider', 'google')
ON CONFLICT (key) DO UPDATE SET value = 'google';

-- Voces específicas por idioma (nombre de voz de Google Cloud TTS)
-- Español
INSERT INTO app_settings (key, value) 
VALUES ('tts_voice_name_es', 'es-ES-Standard-A')
ON CONFLICT (key) DO UPDATE SET value = 'es-ES-Standard-A';

-- Inglés
INSERT INTO app_settings (key, value) 
VALUES ('tts_voice_name_en', 'en-US-Standard-B')
ON CONFLICT (key) DO UPDATE SET value = 'en-US-Standard-B';

-- Portugués
INSERT INTO app_settings (key, value) 
VALUES ('tts_voice_name_pt', 'pt-BR-Standard-A')
ON CONFLICT (key) DO UPDATE SET value = 'pt-BR-Standard-A';

-- Francés
INSERT INTO app_settings (key, value) 
VALUES ('tts_voice_name_fr', 'fr-FR-Standard-A')
ON CONFLICT (key) DO UPDATE SET value = 'fr-FR-Standard-A';

-- Mostrar resultado
SELECT key, value, updated_at
FROM app_settings
WHERE key LIKE 'tts_%'
ORDER BY key;
