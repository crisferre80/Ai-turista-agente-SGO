-- Actualizar la categoría del Nodo Tecnologico a arquitectura
UPDATE attractions SET category = 'arquitectura' WHERE id = '4cdb9556-77d5-49ad-9506-214ba4dc59c3';

-- Verificar el cambio
SELECT id, name, category FROM attractions WHERE id = '4cdb9556-77d5-49ad-9506-214ba4dc59c3';