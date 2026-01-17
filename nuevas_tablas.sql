-- TABLA DE FOTOS DEL CARRUSEL
CREATE TABLE carousel_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  order_position INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLA DE RESEÑAS Y FOTOS DE USUARIOS
CREATE TABLE user_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  attraction_id UUID REFERENCES attractions(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  review_text TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  location_name TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ÍNDICES para mejorar rendimiento
CREATE INDEX idx_carousel_photos_active ON carousel_photos(is_active, order_position);
CREATE INDEX idx_user_reviews_user ON user_reviews(user_id);
CREATE INDEX idx_user_reviews_attraction ON user_reviews(attraction_id);
CREATE INDEX idx_user_reviews_business ON user_reviews(business_id);
CREATE INDEX idx_user_reviews_public ON user_reviews(is_public, created_at);

-- RLS (Row Level Security) para carousel_photos
ALTER TABLE carousel_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos pueden ver fotos activas del carrusel"
  ON carousel_photos FOR SELECT
  USING (is_active = true);

CREATE POLICY "Solo admins pueden gestionar carrusel"
  ON carousel_photos FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- RLS para user_reviews
ALTER TABLE user_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden ver reseñas públicas"
  ON user_reviews FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Usuarios pueden crear sus propias reseñas"
  ON user_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden actualizar sus propias reseñas"
  ON user_reviews FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden eliminar sus propias reseñas"
  ON user_reviews FOR DELETE
  USING (auth.uid() = user_id);
