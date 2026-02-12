-- Seeds: negocios importados por el usuario
-- Fecha: 2026-01-21
-- Inserta dos negocios en la tabla public.businesses

INSERT INTO "public"."businesses" ("id", "owner_id", "name", "website_url", "contact_info", "category", "is_verified", "created_at", "image_url", "lat", "lng") VALUES
('516b54e9-b403-400e-b027-4c0dc41d09b9', null, 'Heladería Limar', 'https://heladerialimar.com.ar/', '3856987845', 'restaurante', false, '2026-01-15 04:40:45.81376+00', 'https://gcoptrxyfjmekdtxuqns.supabase.co/storage/v1/object/public/images/uploads/1768452050893-0547v.jpg', '-27.7863148153177', '-64.2586906602197'),
('76b8d55b-ba29-4267-a747-dc77630d8085', null, 'Capitán Club', '', '', 'restaurante', false, '2026-01-21 02:48:42.335237+00', 'https://gcoptrxyfjmekdtxuqns.supabase.co/storage/v1/object/public/images/uploads/1768963719986-wdqth.jpg', '-27.7834', '-64.2599');

-- Nota: los registros usan owner_id = NULL (negocios sin cuenta aún)
-- Si quieres enlazar estos negocios a usuarios, proporciona los user_id y puedo generar UPDATEs/INSERTs para la tabla profiles y actualizar owner_id.
