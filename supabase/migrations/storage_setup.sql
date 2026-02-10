-- ==========================================
-- CONFIGURACIÓN DE STORAGE PARA SANTI
-- Ejecuta esto en el SQL Editor de Supabase
-- ==========================================

-- 1. Crear los Buckets (si no existen)
-- El bucket 'images' es para fotos de atractivos y perfiles
-- El bucket 'audios' es para los relatos de los usuarios
insert into storage.buckets (id, name, public)
values 
  ('images', 'images', true),
  ('audios', 'audios', true)
on conflict (id) do nothing;

-- 2. Políticas de Seguridad (RLS) para el bucket 'images'
-- Permitir que CUALQUIERA vea las imágenes
create policy "Ver imágenes públicas"
on storage.objects for select
to public
using ( bucket_id = 'images' );

-- Permitir que CUALQUIERA suba imágenes (Aviso: En producción podrías querer restringir esto a usuarios autenticados)
create policy "Subir imágenes públicas"
on storage.objects for insert
to public
with check ( bucket_id = 'images' );

-- 3. Políticas de Seguridad (RLS) para el bucket 'audios'
-- Permitir que CUALQUIERA escuche los relatos
create policy "Oír relatos públicos"
on storage.objects for select
to public
using ( bucket_id = 'audios' );

-- Permitir que CUALQUIERA suba sus relatos
create policy "Subir relatos públicos"
on storage.objects for insert
to public
with check ( bucket_id = 'audios' );

-- 4. Opcional: Permitir borrar (si quieres que el admin pueda limpiar)
create policy "Borrar objetos de storage"
on storage.objects for delete
to public
using ( bucket_id in ('images', 'audios') );
