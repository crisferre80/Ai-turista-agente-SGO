-- Initial database structure for Tourist Assistant App
-- This migration represents the current state of the database

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    name TEXT,
    role TEXT CHECK (role IN ('admin', 'business', 'tourist')) DEFAULT 'tourist',
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create business_profiles table (unified table for business data)
CREATE TABLE IF NOT EXISTS public.business_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    role TEXT DEFAULT 'business',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Business specific fields
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

-- Create email_templates table
CREATE TABLE IF NOT EXISTS public.email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    subject VARCHAR(255) NOT NULL,
    html_content TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create email_notifications table
CREATE TABLE IF NOT EXISTS public.email_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL UNIQUE,
    template_id UUID REFERENCES email_templates(id),
    recipient_type VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RPC function to get users with emails
CREATE OR REPLACE FUNCTION get_users_with_profiles()
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  role text,
  created_at timestamptz
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    p.id,
    p.name,
    au.email,
    p.role,
    p.created_at
  FROM profiles p
  LEFT JOIN auth.users au ON p.id = au.id
  WHERE p.role = 'tourist'
    AND au.email IS NOT NULL
  ORDER BY p.created_at DESC
  LIMIT 100;
$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_business_profiles_auth_id ON public.business_profiles(auth_id);
CREATE INDEX IF NOT EXISTS idx_business_profiles_email ON public.business_profiles(email);
CREATE INDEX IF NOT EXISTS idx_business_profiles_is_active ON public.business_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_email_templates_name ON public.email_templates(name);
CREATE INDEX IF NOT EXISTS idx_email_notifications_event_type ON public.email_notifications(event_type);

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_users_with_profiles() TO authenticated;

-- Enable Row Level Security (RLS) policies can be added here if needed
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;