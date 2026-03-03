-- Fix RLS policies for categories table
-- This script enables RLS and creates public read access policy

-- 1) Enable RLS on categories table
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 2) Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access for categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can manage categories" ON public.categories;

-- 3) Create policy for public read access (anyone can read categories)
CREATE POLICY "Public read access for categories" ON public.categories
  FOR SELECT
  USING (true);

-- 4) Create policy for authenticated users to insert/update/delete
CREATE POLICY "Authenticated users can manage categories" ON public.categories
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
