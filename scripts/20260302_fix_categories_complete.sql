-- ============================================================================
-- FIX: Limpieza completa de tabla de categorías
-- Objetivo: Eliminar duplicados, usar tipos correctos, mantener atractivos+negocios
-- ============================================================================

-- 1. Borrar tabla existente (cuidado - esto borra todos los datos!)
-- Si prefieres ser más cauteloso, use UPDATE + DELETE selectados
DROP TABLE IF EXISTS public.categories CASCADE;

-- 2. Recrear tabla con estructura correcta
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    type TEXT NOT NULL DEFAULT 'attraction' CHECK (type IN ('attraction', 'business')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, type)
);

-- 3. Insertar categorías limpias para ATRACCIONES
INSERT INTO public.categories (name, description, icon, color, is_active, type, created_at, updated_at) VALUES
-- Gastronomía
('Gastronomía', 'Lugares para comer y degustar la cocina local', '🍽️', '#FF6347', true, 'attraction', NOW(), NOW()),

-- Sitios Históricos
('Histórico', 'Sitios históricos, monumentos y lugares conmemorativos', '🏛️', '#8B4513', true, 'attraction', NOW(), NOW()),

-- Naturaleza y Parques
('Naturaleza', 'Parques, reservas naturales y espacios protegidos', '🌳', '#228B22', true, 'attraction', NOW(), NOW()),

-- Cultura
('Cultura', 'Museos, teatros, galerías y eventos culturales', '🎭', '#DAA520', true, 'attraction', NOW(), NOW()),

-- Compras
('Compras', 'Centros comerciales, tiendas y plazas de mercado', '🛍️', '#9370DB', true, 'attraction', NOW(), NOW()),

-- Arquitectura
('Arquitectura', 'Edificios y obras arquitectónicas destacadas', '🏗️', '#4169E1', true, 'attraction', NOW(), NOW()),

-- Artesanía
('Artesanía', 'Productos artesanales y cultura local', '🎨', '#FF1493', true, 'attraction', NOW(), NOW());

-- 4. Insertar categorías limpias para NEGOCIOS
INSERT INTO public.categories (name, description, icon, color, is_active, type, created_at, updated_at) VALUES
-- Restaurante/Gastronomía para negocios
('Restaurante', 'Restaurantes, bares y establecimientos culinarios', '🍽️', '#FF6347', true, 'business', NOW(), NOW()),

-- Alojamiento
('Alojamiento', 'Hoteles, hostales y servicios de hospedaje', '🏨', '#4169E1', true, 'business', NOW(), NOW()),

-- Artesanía para negocios
('Artesanía', 'Tiendas de artesanías y productos regionales', '🎨', '#FF1493', true, 'business', NOW(), NOW()),

-- Servicios Culturales
('Cultura', 'Servicios y espacios culturales', '🎭', '#DAA520', true, 'business', NOW(), NOW()),

-- Servicios Generales
('Servicios', 'Servicios varios y establecimientos de apoyo', '🛠️', '#696969', true, 'business', NOW(), NOW()),

-- Compras para negocios
('Compras', 'Tiendas y comercios especializados', '🛍️', '#9370DB', true, 'business', NOW(), NOW());

-- 5. Crear índices para mejorar rendimiento
CREATE INDEX idx_categories_type ON public.categories(type);
CREATE INDEX idx_categories_name ON public.categories(name);
CREATE INDEX idx_categories_active ON public.categories(is_active);

-- 6. Habilitar Row Level Security (RLS)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 7. Crear políticas de seguridad
-- Permitir SELECT a usuarios anónimos
CREATE POLICY "categories_select_public" 
ON public.categories 
FOR SELECT 
USING (is_active = true);

-- Permitir INSERT/UPDATE/DELETE solo a administradores
CREATE POLICY "categories_admin_all"
ON public.categories
USING (auth.role() = 'authenticated' AND 
       EXISTS (
           SELECT 1 FROM public.user_profiles 
           WHERE id = auth.uid() AND role = 'admin'
       ));

-- 8. Verificación final
SELECT 
    COUNT(*) as total_categories,
    COUNT(DISTINCT type) as types,
    COUNT(DISTINCT name) as unique_names
FROM public.categories;

-- Listar todas las categorías por tipo
SELECT type, COUNT(*) as count FROM public.categories GROUP BY type ORDER BY type;

-- Listar todas con detalles
SELECT id, name, icon, color, type FROM public.categories ORDER BY type, name;
