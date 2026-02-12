-- Normalizar categorías en attractions para que coincidan con la tabla categories
UPDATE attractions SET category = 'histórico' WHERE category = 'historico';
UPDATE attractions SET category = 'naturaleza' WHERE category = 'natural';
UPDATE attractions SET category = 'compras' WHERE category = 'shopping';
UPDATE attractions SET category = 'cultura' WHERE category = 'cultural';
UPDATE attractions SET category = 'arquitectura' WHERE category = 'arquitectonico';
UPDATE attractions SET category = 'monumentos' WHERE category = 'monument';
UPDATE attractions SET category = 'reservas naturales' WHERE category = 'reserva natural';
UPDATE attractions SET category = 'gastronomía' WHERE category = 'gastronomia';
UPDATE attractions SET category = 'artesanía' WHERE category = 'artesania';

-- Verificar que todas las categorías en attractions estén en categories
SELECT DISTINCT a.category, c.name IS NOT NULL as exists_in_categories
FROM attractions a
LEFT JOIN categories c ON a.category = c.name
ORDER BY a.category;