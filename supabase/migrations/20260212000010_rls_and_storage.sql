-- RLS + Storage buckets/policies (2026-02-12)

-- Helper: admin check
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  );
$$;

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.narrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.santis_phrases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carousel_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotional_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_notification_settings ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "profiles_upsert_own" ON public.profiles;
CREATE POLICY "profiles_upsert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- BUSINESS PROFILES policies
DROP POLICY IF EXISTS "business_profiles_public_read_active" ON public.business_profiles;
CREATE POLICY "business_profiles_public_read_active" ON public.business_profiles
  FOR SELECT TO public
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "business_profiles_owner_read" ON public.business_profiles;
CREATE POLICY "business_profiles_owner_read" ON public.business_profiles
  FOR SELECT TO authenticated
  USING (auth_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "business_profiles_owner_insert" ON public.business_profiles;
CREATE POLICY "business_profiles_owner_insert" ON public.business_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "business_profiles_owner_update" ON public.business_profiles;
CREATE POLICY "business_profiles_owner_update" ON public.business_profiles
  FOR UPDATE TO authenticated
  USING (auth_id = auth.uid() OR public.is_admin())
  WITH CHECK (auth_id = auth.uid() OR public.is_admin());

-- CATEGORIES policies
DROP POLICY IF EXISTS "categories_public_read" ON public.categories;
CREATE POLICY "categories_public_read" ON public.categories
  FOR SELECT TO public
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "categories_admin_write" ON public.categories;
CREATE POLICY "categories_admin_write" ON public.categories
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ATTRACTIONS policies
DROP POLICY IF EXISTS "attractions_public_read" ON public.attractions;
CREATE POLICY "attractions_public_read" ON public.attractions
  FOR SELECT TO public
  USING (TRUE);

DROP POLICY IF EXISTS "attractions_admin_write" ON public.attractions;
CREATE POLICY "attractions_admin_write" ON public.attractions
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- NARRATIONS policies
DROP POLICY IF EXISTS "narrations_public_read" ON public.narrations;
CREATE POLICY "narrations_public_read" ON public.narrations
  FOR SELECT TO public
  USING (TRUE);

DROP POLICY IF EXISTS "narrations_owner_insert" ON public.narrations;
CREATE POLICY "narrations_owner_insert" ON public.narrations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "narrations_owner_update" ON public.narrations;
CREATE POLICY "narrations_owner_update" ON public.narrations
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "narrations_owner_delete" ON public.narrations;
CREATE POLICY "narrations_owner_delete" ON public.narrations
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- USER REVIEWS policies
DROP POLICY IF EXISTS "user_reviews_public_read" ON public.user_reviews;
CREATE POLICY "user_reviews_public_read" ON public.user_reviews
  FOR SELECT TO public
  USING (is_public = TRUE);

DROP POLICY IF EXISTS "user_reviews_owner_read" ON public.user_reviews;
CREATE POLICY "user_reviews_owner_read" ON public.user_reviews
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "user_reviews_owner_insert" ON public.user_reviews;
CREATE POLICY "user_reviews_owner_insert" ON public.user_reviews
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_reviews_owner_update" ON public.user_reviews;
CREATE POLICY "user_reviews_owner_update" ON public.user_reviews
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "user_reviews_owner_delete" ON public.user_reviews;
CREATE POLICY "user_reviews_owner_delete" ON public.user_reviews
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- CAROUSEL
DROP POLICY IF EXISTS "carousel_public_read_active" ON public.carousel_photos;
CREATE POLICY "carousel_public_read_active" ON public.carousel_photos
  FOR SELECT TO public
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "carousel_admin_write" ON public.carousel_photos;
CREATE POLICY "carousel_admin_write" ON public.carousel_photos
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- PROMOTIONS
DROP POLICY IF EXISTS "promotions_public_read_active" ON public.promotions;
CREATE POLICY "promotions_public_read_active" ON public.promotions
  FOR SELECT TO public
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "promotions_admin_write" ON public.promotions;
CREATE POLICY "promotions_admin_write" ON public.promotions
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- APP VIDEOS
DROP POLICY IF EXISTS "app_videos_public_read" ON public.app_videos;
CREATE POLICY "app_videos_public_read" ON public.app_videos
  FOR SELECT TO public
  USING (TRUE);

DROP POLICY IF EXISTS "app_videos_admin_write" ON public.app_videos;
CREATE POLICY "app_videos_admin_write" ON public.app_videos
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- SANTI PHRASES
DROP POLICY IF EXISTS "santis_phrases_public_read" ON public.santis_phrases;
CREATE POLICY "santis_phrases_public_read" ON public.santis_phrases
  FOR SELECT TO public
  USING (TRUE);

DROP POLICY IF EXISTS "santis_phrases_admin_write" ON public.santis_phrases;
CREATE POLICY "santis_phrases_admin_write" ON public.santis_phrases
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- PROMOTIONAL MESSAGES
DROP POLICY IF EXISTS "promotional_messages_public_read_active" ON public.promotional_messages;
CREATE POLICY "promotional_messages_public_read_active" ON public.promotional_messages
  FOR SELECT TO public
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "promotional_messages_admin_write" ON public.promotional_messages;
CREATE POLICY "promotional_messages_admin_write" ON public.promotional_messages
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- BUSINESS PLANS
DROP POLICY IF EXISTS "business_plans_public_read_active" ON public.business_plans;
CREATE POLICY "business_plans_public_read_active" ON public.business_plans
  FOR SELECT TO public
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "business_plans_admin_write" ON public.business_plans;
CREATE POLICY "business_plans_admin_write" ON public.business_plans
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- APP SETTINGS (admin only)
DROP POLICY IF EXISTS "app_settings_admin_all" ON public.app_settings;
CREATE POLICY "app_settings_admin_all" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- EMAIL TABLES (admin only via profiles)
DROP POLICY IF EXISTS "email_templates_admin_all" ON public.email_templates;
CREATE POLICY "email_templates_admin_all" ON public.email_templates
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "email_notifications_admin_all" ON public.email_notifications;
CREATE POLICY "email_notifications_admin_all" ON public.email_notifications
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "email_contacts_admin_all" ON public.email_contacts;
CREATE POLICY "email_contacts_admin_all" ON public.email_contacts
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "email_campaigns_admin_all" ON public.email_campaigns;
CREATE POLICY "email_campaigns_admin_all" ON public.email_campaigns
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "email_logs_admin_select" ON public.email_logs;
CREATE POLICY "email_logs_admin_select" ON public.email_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "email_notification_settings_admin_all" ON public.email_notification_settings;
CREATE POLICY "email_notification_settings_admin_all" ON public.email_notification_settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- PAYMENTS & WEBHOOKS: admin only (service_role bypasses RLS on server)
DROP POLICY IF EXISTS "payments_admin_all" ON public.payments;
CREATE POLICY "payments_admin_all" ON public.payments
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "webhooks_admin_all" ON public.webhooks;
CREATE POLICY "webhooks_admin_all" ON public.webhooks
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('images', 'images', true),
  ('audios', 'audios', true),
  ('ar-content', 'ar-content', true),
  ('email-images', 'email-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (idempotent via DROP POLICY)
-- Note: policies live on storage.objects

-- Public read for all public buckets
DROP POLICY IF EXISTS "public_read_images" ON storage.objects;
CREATE POLICY "public_read_images" ON storage.objects FOR SELECT
USING (bucket_id IN ('images','audios','ar-content','email-images'));

-- Authenticated upload/update/delete
DROP POLICY IF EXISTS "auth_write_public_buckets" ON storage.objects;
CREATE POLICY "auth_write_public_buckets" ON storage.objects FOR INSERT
WITH CHECK (bucket_id IN ('images','audios','ar-content','email-images') AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "auth_update_public_buckets" ON storage.objects;
CREATE POLICY "auth_update_public_buckets" ON storage.objects FOR UPDATE
USING (bucket_id IN ('images','audios','ar-content','email-images') AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "auth_delete_public_buckets" ON storage.objects;
CREATE POLICY "auth_delete_public_buckets" ON storage.objects FOR DELETE
USING (bucket_id IN ('images','audios','ar-content','email-images') AND auth.role() = 'authenticated');
