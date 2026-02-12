import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

// Configuración de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltan variables de entorno de Supabase');
  process.exit(1);
}

// Cliente con permisos de admin
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createGetUsersWithEmailsFunction() {
  console.log('🔧 Creando función get_users_with_profiles...');
  
  const functionSQL = `
    -- Función para obtener usuarios con sus emails
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
  `;

  try {
    const { error } = await supabaseAdmin.rpc('exec', { sql: functionSQL });
    
    if (error) {
      console.error('❌ Error creando función RPC:', error);
      // Intento alternativo usando raw SQL
      const { error: rawError } = await supabaseAdmin
        .from('_supabase_sql')
        .insert({ sql: functionSQL });
        
      if (rawError) {
        console.error('❌ Error con método alternativo:', rawError);
        throw rawError;
      }
    }
    
    console.log('✅ Función get_users_with_profiles creada exitosamente');
    return true;
  } catch (error) {
    console.error('💥 Error crítico:', error);
    return false;
  }
}

async function verifyFunction() {
  console.log('🔍 Verificando función...');
  
  try {
    const { data, error } = await supabaseAdmin.rpc('get_users_with_profiles');
    
    if (error) {
      console.error('❌ La función no existe o falló:', error);
      return false;
    }
    
    console.log(`✅ Función verificada. Encontrados ${data?.length || 0} usuarios con emails.`);
    if (data?.length > 0) {
      console.log('📋 Muestra de datos:', data.slice(0, 3));
    }
    return true;
  } catch (error) {
    console.error('💥 Error verificando función:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Iniciando configuración de Supabase...');
  console.log(`📡 Conectando a: ${supabaseUrl}`);
  
  // Verificar si la función ya existe
  const functionExists = await verifyFunction();
  
  if (!functionExists) {
    console.log('💡 La función no existe, creándola...');
    const created = await createGetUsersWithEmailsFunction();
    
    if (created) {
      console.log('⏳ Esperando propagación...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verificar de nuevo
      await verifyFunction();
    }
  } else {
    console.log('✅ La función ya existe y funciona correctamente');
  }
  
  console.log('🎯 Configuración completada!');
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { createGetUsersWithEmailsFunction, verifyFunction };