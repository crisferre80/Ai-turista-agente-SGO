-- Script SQL para agregar campos de análisis turístico a la tabla profiles
-- Ejecutar en Supabase SQL Editor

-- ========================================
-- SECCIÓN: Información Personal
-- ========================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age INT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender VARCHAR(50);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

-- ========================================
-- SECCIÓN: Información del Viaje
-- ========================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS visit_purpose VARCHAR(50); 
-- Valores: turismo, negocios, educacion, visita_familiar, trabajo, otro

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS travel_group VARCHAR(50);
-- Valores: solo, pareja, familia, amigos, grupo_turistico

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS accommodation_type VARCHAR(50);
-- Valores: hotel, hostel, airbnb, casa_familiar, camping, otro

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS transport_mode VARCHAR(50);
-- Valores: auto, auto_alquilado, bus, avion, tren, bicicleta, caminando

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trip_duration INT;
-- Duración en días

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS budget_range VARCHAR(50);
-- Valores: economico, moderado, premium, lujo

-- ========================================
-- SECCIÓN: Intereses y Preferencias
-- ========================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests TEXT[];
-- Array de intereses: naturaleza, cultura, gastronomía, aventura, relax, historia, fotografía, compras, vida_nocturna, deportes

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS accessibility_needs TEXT[];
-- Array de necesidades: silla_de_ruedas, lenguaje_señas, subtitulos, etc

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT[];
-- Array de restricciones: vegetariano, vegano, celiaco, kosher, halal, etc

-- ========================================
-- SECCIÓN: Experiencia en la Provincia
-- ========================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS visit_frequency VARCHAR(50);
-- Valores: primera_vez, ocasional, frecuente, residente

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS favorite_experiences TEXT;
-- Texto libre sobre experiencias favoritas

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS recommended_places TEXT;
-- Texto libre sobre lugares recomendados

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS would_return BOOLEAN;
-- ¿Volvería a visitar?

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS overall_satisfaction INT;
-- Satisfacción general del 1 al 5

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS improvement_suggestions TEXT;
-- Sugerencias de mejora

-- ========================================
-- ÍNDICES para mejorar consultas analíticas
-- ========================================
CREATE INDEX IF NOT EXISTS idx_profiles_country ON profiles(country);
CREATE INDEX IF NOT EXISTS idx_profiles_city ON profiles(city);
CREATE INDEX IF NOT EXISTS idx_profiles_visit_purpose ON profiles(visit_purpose);
CREATE INDEX IF NOT EXISTS idx_profiles_budget_range ON profiles(budget_range);
CREATE INDEX IF NOT EXISTS idx_profiles_visit_frequency ON profiles(visit_frequency);
CREATE INDEX IF NOT EXISTS idx_profiles_overall_satisfaction ON profiles(overall_satisfaction);
CREATE INDEX IF NOT EXISTS idx_profiles_age ON profiles(age);
CREATE INDEX IF NOT EXISTS idx_profiles_gender ON profiles(gender);

-- ========================================
-- VISTA para análisis turístico agregado
-- ========================================
CREATE OR REPLACE VIEW tourist_analytics AS
SELECT 
    COUNT(*) as total_turistas,
    AVG(age) as edad_promedio,
    COUNT(CASE WHEN gender = 'masculino' THEN 1 END) as masculino,
    COUNT(CASE WHEN gender = 'femenino' THEN 1 END) as femenino,
    COUNT(CASE WHEN visit_frequency = 'primera_vez' THEN 1 END) as primera_vez,
    COUNT(CASE WHEN visit_frequency = 'ocasional' THEN 1 END) as ocasional,
    COUNT(CASE WHEN visit_frequency = 'frecuente' THEN 1 END) as frecuente,
    AVG(CASE WHEN overall_satisfaction IS NOT NULL THEN overall_satisfaction END) as satisfaccion_promedio,
    AVG(CASE WHEN trip_duration IS NOT NULL THEN trip_duration END) as duracion_promedio_dias,
    COUNT(CASE WHEN would_return = true THEN 1 END) as volveria,
    COUNT(CASE WHEN would_return = false THEN 1 END) as no_volveria,
    COUNT(CASE WHEN visit_purpose = 'turismo' THEN 1 END) as proposito_turismo,
    COUNT(CASE WHEN visit_purpose = 'negocios' THEN 1 END) as proposito_negocios,
    COUNT(CASE WHEN budget_range = 'economico' THEN 1 END) as presupuesto_economico,
    COUNT(CASE WHEN budget_range = 'moderado' THEN 1 END) as presupuesto_moderado,
    COUNT(CASE WHEN budget_range = 'premium' THEN 1 END) as presupuesto_premium,
    COUNT(CASE WHEN budget_range = 'lujo' THEN 1 END) as presupuesto_lujo
FROM profiles
WHERE role = 'tourist';

-- ========================================
-- VISTA para países de origen
-- ========================================
CREATE OR REPLACE VIEW tourist_origin_countries AS
SELECT 
    country,
    city,
    COUNT(*) as cantidad_turistas,
    AVG(overall_satisfaction) as satisfaccion_promedio
FROM profiles
WHERE role = 'tourist' AND country IS NOT NULL
GROUP BY country, city
ORDER BY cantidad_turistas DESC;

-- ========================================
-- VISTA para análisis de intereses
-- ========================================
CREATE OR REPLACE VIEW tourist_interests_analysis AS
SELECT 
    unnest(interests) as interes,
    COUNT(*) as cantidad
FROM profiles
WHERE role = 'tourist' AND interests IS NOT NULL
GROUP BY interes
ORDER BY cantidad DESC;

-- ========================================
-- COMENTARIOS en las columnas para documentación
-- ========================================
COMMENT ON COLUMN profiles.age IS 'Edad del turista';
COMMENT ON COLUMN profiles.gender IS 'Género del turista';
COMMENT ON COLUMN profiles.country IS 'País de origen';
COMMENT ON COLUMN profiles.city IS 'Ciudad de origen';
COMMENT ON COLUMN profiles.visit_purpose IS 'Propósito de la visita: turismo, negocios, educacion, visita_familiar, trabajo, otro';
COMMENT ON COLUMN profiles.travel_group IS 'Tipo de grupo: solo, pareja, familia, amigos, grupo_turistico';
COMMENT ON COLUMN profiles.accommodation_type IS 'Tipo de alojamiento: hotel, hostel, airbnb, casa_familiar, camping, otro';
COMMENT ON COLUMN profiles.transport_mode IS 'Medio de transporte: auto, auto_alquilado, bus, avion, tren, bicicleta, caminando';
COMMENT ON COLUMN profiles.trip_duration IS 'Duración del viaje en días';
COMMENT ON COLUMN profiles.budget_range IS 'Rango de presupuesto: economico, moderado, premium, lujo';
COMMENT ON COLUMN profiles.interests IS 'Array de intereses turísticos';
COMMENT ON COLUMN profiles.accessibility_needs IS 'Array de necesidades de accesibilidad';
COMMENT ON COLUMN profiles.dietary_restrictions IS 'Array de restricciones alimentarias';
COMMENT ON COLUMN profiles.visit_frequency IS 'Frecuencia de visita: primera_vez, ocasional, frecuente, residente';
COMMENT ON COLUMN profiles.favorite_experiences IS 'Experiencias favoritas del turista';
COMMENT ON COLUMN profiles.recommended_places IS 'Lugares recomendados por el turista';
COMMENT ON COLUMN profiles.would_return IS 'Indica si el turista volvería a visitar';
COMMENT ON COLUMN profiles.overall_satisfaction IS 'Satisfacción general del 1 al 5';
COMMENT ON COLUMN profiles.improvement_suggestions IS 'Sugerencias de mejora';

-- ========================================
-- GRANTS para asegurar que los usuarios puedan actualizar sus perfiles
-- ========================================
GRANT SELECT, UPDATE ON profiles TO authenticated;
GRANT SELECT ON tourist_analytics TO authenticated;
GRANT SELECT ON tourist_origin_countries TO authenticated;
GRANT SELECT ON tourist_interests_analysis TO authenticated;

-- ========================================
-- CONSULTAS DE EJEMPLO para análisis
-- ========================================

-- Ver estadísticas generales
-- SELECT * FROM tourist_analytics;

-- Ver top 10 países de origen
-- SELECT * FROM tourist_origin_countries LIMIT 10;

-- Ver intereses más populares
-- SELECT * FROM tourist_interests_analysis LIMIT 10;

-- Turistas por rango de edad
-- SELECT 
--     CASE 
--         WHEN age BETWEEN 18 AND 25 THEN '18-25'
--         WHEN age BETWEEN 26 AND 35 THEN '26-35'
--         WHEN age BETWEEN 36 AND 50 THEN '36-50'
--         WHEN age > 50 THEN '50+'
--         ELSE 'No especificado'
--     END as rango_edad,
--     COUNT(*) as cantidad
-- FROM profiles
-- WHERE role = 'tourist'
-- GROUP BY rango_edad
-- ORDER BY cantidad DESC;

-- Satisfacción por tipo de alojamiento
-- SELECT 
--     accommodation_type,
--     AVG(overall_satisfaction) as satisfaccion_promedio,
--     COUNT(*) as cantidad_turistas
-- FROM profiles
-- WHERE role = 'tourist' AND accommodation_type IS NOT NULL
-- GROUP BY accommodation_type
-- ORDER BY satisfaccion_promedio DESC;

-- Turistas que volverían vs los que no
-- SELECT 
--     would_return,
--     COUNT(*) as cantidad,
--     ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM profiles WHERE role = 'tourist'), 2) as porcentaje
-- FROM profiles
-- WHERE role = 'tourist'
-- GROUP BY would_return;

COMMIT;
