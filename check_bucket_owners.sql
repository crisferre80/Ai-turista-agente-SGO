-- SQL para verificar información de los buckets en Supabase
-- Incluye owner, permisos y configuración

-- Ver todos los buckets con su información completa
SELECT
    id,
    name,
    owner,
    public,
    created_at,
    updated_at,
    file_size_limit,
    allowed_mime_types
FROM storage.buckets
ORDER BY created_at DESC;

-- Ver buckets específicos que nos interesan
SELECT
    id,
    name,
    owner,
    public,
    CASE
        WHEN public = true THEN 'Público - Accesible desde navegador'
        ELSE 'Privado - Solo con autenticación'
    END as access_level,
    created_at
FROM storage.buckets
WHERE id IN ('images', 'audios', 'email-images', 'ar-content')
ORDER BY id;

-- Ver políticas RLS actuales en storage.objects
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY policyname;

-- Ver permisos de los buckets (si hay información adicional)
SELECT
    b.id as bucket_id,
    b.name as bucket_name,
    b.owner as bucket_owner,
    b.public as is_public,
    COUNT(o.id) as total_objects
FROM storage.buckets b
LEFT JOIN storage.objects o ON b.id = o.bucket_id
WHERE b.id IN ('images', 'audios', 'email-images', 'ar-content')
GROUP BY b.id, b.name, b.owner, b.public
ORDER BY b.id;