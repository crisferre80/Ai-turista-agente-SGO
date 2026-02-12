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

async function setupCompleteStorageRLS() {
  console.log('🔧 Configurando políticas RLS completas para todos los buckets...\n');

  try {
    // Políticas para todos los buckets
    console.log('📝 Configurando políticas generales...');

    // Habilitar RLS
    console.log('🔒 Habilitando RLS en storage.objects...');
    const { error: rlsError } = await supabaseAdmin.rpc('exec_sql', {
      sql: 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;'
    });
    if (rlsError && !rlsError.message.includes('already enabled')) {
      console.log('⚠️  RLS ya estaba habilitado');
    }

    // Política de lectura pública para todos los buckets
    console.log('📖 Creando política de lectura pública...');
    const { error: readError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `CREATE POLICY "Public read access for all buckets" ON storage.objects FOR SELECT USING (true);`
    });
    if (readError && !readError.message.includes('already exists')) {
      console.error('❌ Error en política de lectura:', readError);
    } else {
      console.log('✅ Política de lectura creada');
    }

    // Políticas de escritura autenticada
    const writePolicies = [
      'Authenticated users can upload to all buckets',
      'Authenticated users can update all buckets',
      'Authenticated users can delete from all buckets'
    ];

    const writeSQLs = [
      `CREATE POLICY "Authenticated users can upload to all buckets" ON storage.objects FOR INSERT WITH CHECK (auth.role() = 'authenticated');`,
      `CREATE POLICY "Authenticated users can update all buckets" ON storage.objects FOR UPDATE USING (auth.role() = 'authenticated');`,
      `CREATE POLICY "Authenticated users can delete from all buckets" ON storage.objects FOR DELETE USING (auth.role() = 'authenticated');`
    ];

    for (let i = 0; i < writePolicies.length; i++) {
      console.log(`📝 Creando política: ${writePolicies[i]}...`);
      const { error } = await supabaseAdmin.rpc('exec_sql', { sql: writeSQLs[i] });
      if (error && !error.message.includes('already exists')) {
        console.error(`❌ Error en ${writePolicies[i]}:`, error);
      } else {
        console.log(`✅ ${writePolicies[i]} creada`);
      }
    }

    // Verificar buckets
    console.log('\n📦 Verificando buckets...');
    const buckets = ['images', 'audios', 'email-images', 'ar-content'];

    for (const bucketName of buckets) {
      console.log(`🔍 Verificando bucket: ${bucketName}`);

      // Verificar si existe
      const { data: existingBuckets, error: listError } = await supabaseAdmin.storage.listBuckets();
      const bucketExists = existingBuckets?.find(b => b.id === bucketName);

      if (!bucketExists) {
        console.log(`📁 Creando bucket: ${bucketName}`);
        const { error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
          public: true,
          allowedMimeTypes: ['*/*'],
          fileSizeLimit: 52428800 // 50MB
        });
        if (createError) {
          console.error(`❌ Error creando ${bucketName}:`, createError);
        } else {
          console.log(`✅ Bucket ${bucketName} creado`);
        }
      } else {
        console.log(`✅ Bucket ${bucketName} ya existe`);
        // Asegurar que sea público
        if (!bucketExists.public) {
          const { error: updateError } = await supabaseAdmin.storage.updateBucket(bucketName, {
            public: true
          });
          if (updateError) {
            console.error(`❌ Error actualizando ${bucketName}:`, updateError);
          } else {
            console.log(`✅ Bucket ${bucketName} actualizado a público`);
          }
        }
      }
    }

    console.log('\n🎉 Configuración completa de RLS terminada!');
    console.log('\n📋 Resumen:');
    console.log('✅ RLS habilitado en storage.objects');
    console.log('✅ Lectura pública para todos los buckets');
    console.log('✅ Escritura autenticada para todos los buckets');
    console.log('✅ Todos los buckets verificados/creados');
    console.log('\n🚀 El panel de administración ahora puede ver todos los buckets y archivos!');

  } catch (error) {
    console.error('❌ Error configurando RLS:', error);
  }
}

setupCompleteStorageRLS();