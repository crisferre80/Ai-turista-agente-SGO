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

async function testStorageAccess() {
  console.log('🧪 Probando acceso a Storage...\n');

  try {
    // 1. Verificar buckets
    console.log('1️⃣ Listando buckets...');
    const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets();

    if (bucketsError) {
      console.error('❌ Error listando buckets:', bucketsError);
      return;
    }

    console.log('✅ Buckets encontrados:', buckets.map(b => `${b.name} (${b.public ? 'público' : 'privado'})`));

    // 2. Verificar bucket 'images'
    const imagesBucket = buckets.find(b => b.id === 'images');
    if (!imagesBucket) {
      console.log('❌ Bucket "images" no encontrado');
      return;
    }

    console.log(`✅ Bucket "images" encontrado (${imagesBucket.public ? 'público' : 'privado'})`);

    // 3. Listar contenido del bucket
    console.log('\n2️⃣ Listando contenido del bucket "images"...');
    const { data: files, error: filesError } = await supabaseAdmin.storage
      .from('images')
      .list('', { limit: 10 });

    if (filesError) {
      console.error('❌ Error listando archivos:', filesError);
      return;
    }

    console.log(`✅ Archivos encontrados: ${files.length}`);
    if (files.length > 0) {
      console.log('📁 Archivos de ejemplo:', files.slice(0, 3).map(f => f.name));
    }

    // 4. Probar URL pública
    if (files.length > 0) {
      console.log('\n3️⃣ Probando URL pública...');
      const testFile = files[0];
      const { data: urlData } = supabaseAdmin.storage
        .from('images')
        .getPublicUrl(testFile.name);

      console.log('✅ URL pública generada:', urlData.publicUrl);

      // 5. Verificar si la URL es accesible (simulación)
      console.log('ℹ️  Nota: Para verificar si la imagen carga, abre la URL en un navegador');
    }

    console.log('\n🎉 Prueba de Storage completada exitosamente!');
    console.log('\n📋 Resumen:');
    console.log('- ✅ Buckets accesibles');
    console.log('- ✅ Bucket "images" configurado');
    console.log('- ✅ Archivos listados correctamente');
    console.log('- ✅ URLs públicas generadas');

    if (!imagesBucket.public) {
      console.log('\n⚠️  Advertencia: El bucket no es público. Configura las políticas RLS desde el dashboard.');
    }

  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

testStorageAccess();