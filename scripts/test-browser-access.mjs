import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltan variables de entorno de Supabase');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testBrowserAccess() {
  console.log('🌐 Probando acceso desde navegador (simulado)...\n');

  let hasBucketsError = false;
  let hasFilesError = false;

  try {
    // Simular lo que hace el navegador: intentar listar buckets sin service key
    const supabaseAnon = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    console.log('1️⃣ Intentando listar buckets con clave anónima...');
    const { data: buckets, error: bucketsError } = await supabaseAnon.storage.listBuckets();

    if (bucketsError) {
      console.error('❌ Error con clave anónima:', bucketsError.message);
      hasBucketsError = true;
    } else {
      console.log('✅ Buckets accesibles con clave anónima:', buckets.map(b => b.name));
    }

    // Intentar listar contenido del bucket images
    console.log('\n2️⃣ Intentando listar contenido de "images"...');
    const { data: files, error: filesError } = await supabaseAnon.storage
      .from('images')
      .list('', { limit: 10 });

    if (filesError) {
      console.error('❌ Error listando archivos:', filesError.message);
      hasFilesError = true;
    } else {
      console.log('✅ Archivos listados:', files?.length || 0);
      if (files && files.length > 0) {
        console.log('📁 Ejemplos:', files.slice(0, 3).map(f => f.name));
      }
    }

    console.log('\n📋 Diagnóstico:');
    if (hasBucketsError || hasFilesError) {
      console.log('❌ PROBLEMA: Las políticas RLS no están configuradas correctamente');
      console.log('🔧 SOLUCIÓN: Configurar políticas desde https://supabase.com/dashboard');
    } else {
      console.log('✅ Las políticas RLS están funcionando correctamente');
    }

  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

testBrowserAccess();