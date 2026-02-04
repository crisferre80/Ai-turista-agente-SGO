-- Script de verificación rápida
-- Ejecutar en Supabase SQL Editor para ver qué columnas existen

-- ==========================================
-- VERIFICAR COLUMNAS EN BUSINESS_PROFILES
-- ==========================================

SELECT 
    'business_profiles' as tabla,
    column_name as columna,
    data_type as tipo,
    is_nullable as permite_nulos,
    column_default as valor_default
FROM information_schema.columns 
WHERE table_name = 'business_profiles'
  AND column_name IN ('lat', 'lng')
ORDER BY column_name;

-- ==========================================
-- VERIFICAR COLUMNAS EN BUSINESSES
-- ==========================================

SELECT 
    'businesses' as tabla,
    column_name as columna,
    data_type as tipo,
    is_nullable as permite_nulos,
    column_default as valor_default
FROM information_schema.columns 
WHERE table_name = 'businesses'
  AND column_name IN ('lat', 'lng')
ORDER BY column_name;

-- ==========================================
-- LISTAR TODAS LAS COLUMNAS DE BUSINESS_PROFILES
-- ==========================================

SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'business_profiles'
ORDER BY ordinal_position;

-- ==========================================
-- VERIFICAR SI HAY DATOS CON COORDENADAS
-- ==========================================

-- business_profiles con coordenadas
SELECT 
    'business_profiles' as tabla,
    COUNT(*) as total_registros,
    COUNT(lat) as con_lat,
    COUNT(lng) as con_lng,
    COUNT(CASE WHEN lat IS NOT NULL AND lng IS NOT NULL THEN 1 END) as con_ambas_coordenadas
FROM business_profiles;

-- businesses con coordenadas
SELECT 
    'businesses' as tabla,
    COUNT(*) as total_registros,
    COUNT(lat) as con_lat,
    COUNT(lng) as con_lng,
    COUNT(CASE WHEN lat IS NOT NULL AND lng IS NOT NULL THEN 1 END) as con_ambas_coordenadas
FROM businesses;
