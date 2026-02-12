-- Squashed baseline schema for Tourist Assistant (2026-02-12)

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helper function for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- PROFILES (auth-linked)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  role TEXT CHECK (role IN ('admin', 'business', 'tourist')) DEFAULT 'tourist',
  avatar_url TEXT,
  bio TEXT,
  preferences JSONB DEFAULT '{}'::jsonb,

  -- Tourist profile fields
  age INT,
  gender VARCHAR(50),
  country VARCHAR(100),
  city VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  visit_purpose VARCHAR(50),
  travel_group VARCHAR(50),
  accommodation_type VARCHAR(50),
  transport_mode VARCHAR(50),
  trip_duration INT,
  budget_range VARCHAR(50),
  interests TEXT[],
  accessibility_needs TEXT[],
  dietary_restrictions TEXT[],
  visit_frequency VARCHAR(50),
  favorite_experiences TEXT,
  recommended_places TEXT,
  would_return BOOLEAN,
  overall_satisfaction INT,
  improvement_suggestions TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CATEGORIES
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('attraction', 'business')),
  description TEXT,
  icon TEXT,
  color TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_type_unique ON public.categories(name, type);
CREATE INDEX IF NOT EXISTS idx_categories_type ON public.categories(type);
CREATE INDEX IF NOT EXISTS idx_categories_active ON public.categories(is_active);

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- BUSINESS PROFILES (unified business entity)
CREATE TABLE IF NOT EXISTS public.business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  role TEXT DEFAULT 'business',

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
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_profiles_auth_id ON public.business_profiles(auth_id);
CREATE INDEX IF NOT EXISTS idx_business_profiles_is_active ON public.business_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_business_profiles_category ON public.business_profiles(category);

DROP TRIGGER IF EXISTS trg_business_profiles_updated_at ON public.business_profiles;
CREATE TRIGGER trg_business_profiles_updated_at
BEFORE UPDATE ON public.business_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Compatibility view: some code reads from `businesses`
DROP VIEW IF EXISTS public.businesses;
CREATE VIEW public.businesses AS
SELECT
  id,
  auth_id AS owner_id,
  name,
  description,
  website_url,
  contact_info,
  phone,
  address,
  category,
  plan,
  is_verified,
  is_active,
  gallery_images,
  payment_status,
  subscription_end,
  created_at,
  lat,
  lng
FROM public.business_profiles;

-- ATTRACTIONS
CREATE TABLE IF NOT EXISTS public.attractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  image_url TEXT,
  info_extra TEXT,
  category TEXT,
  gallery_urls TEXT[],
  video_urls TEXT[],

  is_business_listing BOOLEAN DEFAULT FALSE,
  business_profile_id UUID REFERENCES public.business_profiles(id) ON DELETE SET NULL,

  -- AR fields
  has_ar_content BOOLEAN DEFAULT FALSE,
  ar_model_url TEXT,
  ar_hotspots JSONB DEFAULT '{"hotspots":[],"primitives":[],"modelTransform":{"position":{"x":0,"y":0,"z":0},"rotation":{"x":0,"y":0,"z":0},"scale":{"x":1,"y":1,"z":1}}}'::jsonb,
  qr_code TEXT UNIQUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attractions_created_at ON public.attractions(created_at);
CREATE INDEX IF NOT EXISTS idx_attractions_category ON public.attractions(category);
CREATE INDEX IF NOT EXISTS idx_attractions_has_ar ON public.attractions(has_ar_content) WHERE has_ar_content = TRUE;
CREATE INDEX IF NOT EXISTS idx_attractions_qr_code ON public.attractions(qr_code) WHERE qr_code IS NOT NULL;

DROP TRIGGER IF EXISTS trg_attractions_updated_at ON public.attractions;
CREATE TRIGGER trg_attractions_updated_at
BEFORE UPDATE ON public.attractions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- NARRATIONS
CREATE TABLE IF NOT EXISTS public.narrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attraction_id UUID REFERENCES public.attractions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  text_content TEXT,
  audio_url TEXT,
  language TEXT DEFAULT 'es',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_narrations_attraction_id ON public.narrations(attraction_id);
CREATE INDEX IF NOT EXISTS idx_narrations_user_id ON public.narrations(user_id);

DROP TRIGGER IF EXISTS trg_narrations_updated_at ON public.narrations;
CREATE TRIGGER trg_narrations_updated_at
BEFORE UPDATE ON public.narrations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SANTI PHRASES
CREATE TABLE IF NOT EXISTS public.santis_phrases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phrase TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_santis_phrases_category ON public.santis_phrases(category);

DROP TRIGGER IF EXISTS trg_santis_phrases_updated_at ON public.santis_phrases;
CREATE TRIGGER trg_santis_phrases_updated_at
BEFORE UPDATE ON public.santis_phrases
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- BUSINESS PLANS (admin-managed)
CREATE TABLE IF NOT EXISTS public.business_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly NUMERIC(10,2) NOT NULL DEFAULT 0,
  features JSONB DEFAULT '[]'::jsonb,
  max_images INTEGER DEFAULT 5,
  priority INTEGER DEFAULT 0,
  mercadopago_id VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_plans_name_unique ON public.business_plans(name);
CREATE INDEX IF NOT EXISTS idx_business_plans_priority ON public.business_plans(priority);

DROP TRIGGER IF EXISTS trg_business_plans_updated_at ON public.business_plans;
CREATE TRIGGER trg_business_plans_updated_at
BEFORE UPDATE ON public.business_plans
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PAYMENTS
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_profile_id UUID REFERENCES public.business_profiles(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'ARS',
  payment_method TEXT,
  mercadopago_id TEXT,
  status TEXT DEFAULT 'pending',
  plan_name TEXT,
  period TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_business_profile_id ON public.payments(business_profile_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- WEBHOOKS (MercadoPago)
CREATE TABLE IF NOT EXISTS public.webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  action TEXT,
  payment_id TEXT,
  data JSONB,
  processed BOOLEAN DEFAULT FALSE,
  processing_attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhooks_webhook_id ON public.webhooks(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_processed ON public.webhooks(processed) WHERE processed = FALSE;

-- APP VIDEOS
CREATE TABLE IF NOT EXISTS public.app_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  video_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CAROUSEL PHOTOS
CREATE TABLE IF NOT EXISTS public.carousel_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  order_position INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carousel_photos_active ON public.carousel_photos(is_active, order_position);

DROP TRIGGER IF EXISTS trg_carousel_photos_updated_at ON public.carousel_photos;
CREATE TRIGGER trg_carousel_photos_updated_at
BEFORE UPDATE ON public.carousel_photos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- USER REVIEWS
CREATE TABLE IF NOT EXISTS public.user_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  attraction_id UUID REFERENCES public.attractions(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  review_text TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  location_name TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_reviews_user ON public.user_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_user_reviews_attraction ON public.user_reviews(attraction_id);
CREATE INDEX IF NOT EXISTS idx_user_reviews_business ON public.user_reviews(business_id);
CREATE INDEX IF NOT EXISTS idx_user_reviews_public ON public.user_reviews(is_public, created_at);

DROP TRIGGER IF EXISTS trg_user_reviews_updated_at ON public.user_reviews;
CREATE TRIGGER trg_user_reviews_updated_at
BEFORE UPDATE ON public.user_reviews
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PROMOTIONS
CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  terms TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotions_place ON public.promotions(place_id);

DROP TRIGGER IF EXISTS trg_promotions_updated_at ON public.promotions;
CREATE TRIGGER trg_promotions_updated_at
BEFORE UPDATE ON public.promotions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PROMOTIONAL MESSAGES
CREATE TABLE IF NOT EXISTS public.promotional_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  priority INTEGER DEFAULT 5,
  show_probability INTEGER DEFAULT 25,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotional_messages_active ON public.promotional_messages(is_active);
CREATE INDEX IF NOT EXISTS idx_promotional_messages_priority ON public.promotional_messages(priority);

DROP TRIGGER IF EXISTS trg_promotional_messages_updated_at ON public.promotional_messages;
CREATE TRIGGER trg_promotional_messages_updated_at
BEFORE UPDATE ON public.promotional_messages
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- APP SETTINGS
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- EMAIL SYSTEM
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  subject VARCHAR(500) NOT NULL,
  html_content TEXT NOT NULL,
  html TEXT,
  thumbnail_url TEXT,
  category VARCHAR(100),
  variables JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE OR REPLACE FUNCTION public.email_templates_sync_html()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.html IS NOT NULL AND (NEW.html_content IS NULL OR NEW.html_content = '') THEN
    NEW.html_content = NEW.html;
  ELSIF NEW.html_content IS NOT NULL AND (NEW.html IS NULL OR NEW.html = '') THEN
    NEW.html = NEW.html_content;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_templates_sync_html ON public.email_templates;
CREATE TRIGGER trg_email_templates_sync_html
BEFORE INSERT OR UPDATE ON public.email_templates
FOR EACH ROW EXECUTE FUNCTION public.email_templates_sync_html();

DROP TRIGGER IF EXISTS trg_email_templates_updated_at ON public.email_templates;
CREATE TRIGGER trg_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL UNIQUE,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  recipient_type VARCHAR(20) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.email_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  phone VARCHAR(50),
  tags TEXT[],
  metadata JSONB DEFAULT '{}'::jsonb,
  subscribed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_contacts_email ON public.email_contacts(email);
CREATE INDEX IF NOT EXISTS idx_email_contacts_tags ON public.email_contacts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_email_contacts_subscribed ON public.email_contacts(subscribed);

DROP TRIGGER IF EXISTS trg_email_contacts_updated_at ON public.email_contacts;
CREATE TRIGGER trg_email_contacts_updated_at
BEFORE UPDATE ON public.email_contacts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  subject VARCHAR(500) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  recipients_filter JSONB,
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  external_id TEXT,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON public.email_campaigns(status);

CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.email_contacts(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_logs_campaign ON public.email_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_contact ON public.email_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs(status);

CREATE TABLE IF NOT EXISTS public.email_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT TRUE,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  recipient_type VARCHAR(50),
  recipient_tags TEXT[],
  delay_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_email_notification_settings_updated_at ON public.email_notification_settings;
CREATE TRIGGER trg_email_notification_settings_updated_at
BEFORE UPDATE ON public.email_notification_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
