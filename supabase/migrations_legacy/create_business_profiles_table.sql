-- TABLA UNIFICADA PARA PERFILES DE NEGOCIOS
CREATE TABLE IF NOT EXISTS business_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- FK a auth.users
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  role TEXT DEFAULT 'business',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Campos específicos del negocio
  description TEXT,
  website_url TEXT,
  contact_info TEXT,
  phone TEXT,
  address TEXT,
  category TEXT,
  plan TEXT DEFAULT 'basic',
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT FALSE,
  gallery_images TEXT[],
  payment_status TEXT DEFAULT 'pending',
  payment_method TEXT,
  mercadopago_id TEXT,
  subscription_end DATE,
  lat FLOAT,
  lng FLOAT
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_business_profiles_auth_id ON business_profiles(auth_id);
CREATE INDEX IF NOT EXISTS idx_business_profiles_email ON business_profiles(email);
CREATE INDEX IF NOT EXISTS idx_business_profiles_payment_status ON business_profiles(payment_status);

-- Políticas RLS (si se habilita)
-- ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Usuarios pueden ver su propio perfil" ON business_profiles FOR SELECT USING (auth_id = auth.uid());
-- CREATE POLICY "Usuarios pueden actualizar su propio perfil" ON business_profiles FOR UPDATE USING (auth_id = auth.uid());
-- CREATE POLICY "Usuarios pueden insertar su propio perfil" ON business_profiles FOR INSERT WITH CHECK (auth_id = auth.uid());