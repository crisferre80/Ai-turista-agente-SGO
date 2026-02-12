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

async function setupSimpleRLS() {
  console.log('🔧 Configurando RLS simple para panel de administración...\n');

  try {
    // Verificar buckets existentes
    console.log('📦 Verificando buckets...');
    const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets();

    if (bucketsError) {
      console.error('❌ Error listando buckets:', bucketsError);
      return;
    }

    console.log('✅ Buckets encontrados:', buckets.map(b => `${b.name} (${b.public ? 'público' : 'privado'})`));

    // Asegurar que todos los buckets sean públicos
    console.log('\n🔓 Asegurando que todos los buckets sean públicos...');
    for (const bucket of buckets) {
      if (!bucket.public) {
        console.log(`📝 Actualizando ${bucket.name} a público...`);
        const { error: updateError } = await supabaseAdmin.storage.updateBucket(bucket.name, {
          public: true
        });
        if (updateError) {
          console.error(`❌ Error actualizando ${bucket.name}:`, updateError);
        } else {
          console.log(`✅ ${bucket.name} ahora es público`);
        }
      } else {
        console.log(`✅ ${bucket.name} ya es público`);
      }
    }

    // Probar acceso de lectura con usuario anónimo
    console.log('\n🧪 Probando acceso de lectura...');
    const supabaseAnon = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    const { data: testBuckets, error: testError } = await supabaseAnon.storage.listBuckets();
    if (testError) {
      console.error('❌ Error de acceso anónimo:', testError);
      console.log('⚠️  Las políticas RLS pueden estar bloqueando el acceso');
      console.log('💡 Necesitas configurar las políticas manualmente en el dashboard');
    } else {
      console.log('✅ Acceso anónimo funciona:', testBuckets?.length || 0, 'buckets visibles');

      // Probar listar contenido de un bucket
      if (testBuckets && testBuckets.length > 0) {
        const testBucket = testBuckets[0];
        const { data: files, error: filesError } = await supabaseAnon.storage
          .from(testBucket.name)
          .list('', { limit: 5 });

        if (filesError) {
          console.error(`❌ Error listando archivos en ${testBucket.name}:`, filesError);
        } else {
          console.log(`✅ Archivos listados en ${testBucket.name}:`, files?.length || 0, 'archivos');
        }
      }
    }

    console.log('\n📋 Instrucciones para completar la configuración:');
    console.log('1. Ve a https://supabase.com/dashboard');
    console.log('2. Selecciona tu proyecto');
    console.log('3. Ve a SQL Editor');
    console.log('4. Ejecuta el contenido del archivo: supabase/migrations/20260212000033_simple_storage_rls.sql');
    console.log('\n🎯 Después de ejecutar el SQL, el panel de administración podrá ver todos los buckets!');

  } catch (error) {
    console.error('❌ Error en configuración:', error);
  }
}

setupSimpleRLS();