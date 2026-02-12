-- Verificación rápida de datos restaurados
SELECT 'Admin users:' as check, COUNT(*) as count FROM profiles WHERE role = 'admin'
UNION ALL
SELECT 'Businesses:', COUNT(*) FROM businesses
UNION ALL
SELECT 'Attractions with AR:', COUNT(*) FROM attractions WHERE has_ar_content = true
UNION ALL
SELECT 'Active plans:', COUNT(*) FROM plans WHERE is_active = true
UNION ALL
SELECT 'Active categories:', COUNT(*) FROM categories WHERE is_active = true;