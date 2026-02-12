-- Verificación de datos restaurados
SELECT
    '✅ Admin configurado' as status,
    COUNT(*) as count,
    'Usuario admin@cristian.com debe existir' as notes
FROM profiles
WHERE role = 'admin'
UNION ALL
SELECT
    '✅ Negocios restaurados',
    COUNT(*),
    'Heladería Limar y Capitán Club'
FROM businesses
WHERE name IN ('Heladería Limar', 'Capitán Club')
UNION ALL
SELECT
    '✅ Atractivos con AR',
    COUNT(*),
    'Catedral con contenido AR'
FROM attractions
WHERE has_ar_content = true
UNION ALL
SELECT
    '✅ Planes de suscripción',
    COUNT(*),
    'Free y Premium'
FROM plans
WHERE is_active = true
UNION ALL
SELECT
    '✅ Categorías activas',
    COUNT(*),
    'Histórico, Naturaleza, Restaurantes, etc.'
FROM categories
WHERE is_active = true;