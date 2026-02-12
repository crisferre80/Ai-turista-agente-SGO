-- Función para obtener usuarios con sus emails
-- Esta función combina datos de profiles con auth.users para obtener emails

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

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION get_users_with_profiles() TO authenticated;