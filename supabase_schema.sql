-- TABLA DE PERFILES (Usuarios y Admin)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user', -- 'user', 'business', 'admin'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLA DE NEGOCIOS
CREATE TABLE IF NOT EXISTS businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id),
  name TEXT NOT NULL,
  description TEXT,
  website_url TEXT,
  contact_info TEXT,
  phone TEXT,
  address TEXT,
  category TEXT, -- 'restaurante', 'hotel', 'artesania', etc.
  plan TEXT DEFAULT 'basic', -- 'basic', 'pro', 'premium'
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT FALSE,
  gallery_images TEXT[], -- Array de URLs de imágenes
  payment_status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'expired'
  subscription_end DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLA DE ATRACTIVOS (Puntos en el mapa)
CREATE TABLE attractions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  image_url TEXT,
  info_extra TEXT,
  category TEXT, -- 'historico', 'naturaleza', 'compras'
  is_business_listing BOOLEAN DEFAULT FALSE,
  business_id UUID REFERENCES businesses(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLA DE RELATOS (Historias de usuarios)
CREATE TABLE narrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attraction_id UUID REFERENCES attractions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  text_content TEXT,
  audio_url TEXT,
  language TEXT DEFAULT 'es',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLA DE FRASES DE SANTI
CREATE TABLE santis_phrases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phrase TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLA DE PLANES DE NEGOCIOS
CREATE TABLE business_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, -- 'basic', 'pro', 'premium'
  display_name TEXT NOT NULL,
  price_monthly DECIMAL(10,2) NOT NULL,
  price_yearly DECIMAL(10,2) NOT NULL,
  features JSONB, -- Array de características
  max_images INTEGER DEFAULT 5,
  priority INTEGER DEFAULT 0, -- Para ordenamiento en listados
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLA DE PAGOS
CREATE TABLE payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'ARS',
  payment_method TEXT, -- 'mercadopago'
  mercadopago_id TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  plan_name TEXT,
  period TEXT, -- 'monthly', 'yearly'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- HABILITAR STORAGE (Buckets: images, audios)
-- Nota: Esto se configura manualmente en la UI de Supabase o vía políticas RLS.

-- POLÍTICAS DE SEGURIDAD (RLS)
ALTER TABLE app_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Videos públicos" ON app_videos FOR SELECT TO public USING (true);
CREATE POLICY "Admin inserta videos" ON app_videos FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Admin borra videos" ON app_videos FOR DELETE TO public USING (true);
