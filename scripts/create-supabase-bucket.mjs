#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketName = process.env.NEXT_PUBLIC_AR_ASSETS_BUCKET || 'ar-assets';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Faltan variables de entorno. Asegúrate de definir NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

async function run() {
  try {
    console.log('🔎 Verificando si el bucket existe mediante listBuckets:', bucketName);
    const { data: buckets, error: listErr } = await supabaseAdmin.storage.listBuckets();
    if (listErr) {
      console.error('Error listando buckets:', listErr);
      process.exit(1);
    }

    const exists = Array.isArray(buckets) && buckets.find(b => b.name === bucketName);
    if (exists) {
      console.log(`✅ El bucket '${bucketName}' ya existe.`);
      process.exit(0);
    }

    console.log('⚙️ Creando bucket público:', bucketName);
    const { data, error } = await supabaseAdmin.storage.createBucket(bucketName, { public: true });
    if (error) {
      console.error('❌ Error creando bucket:', error);
      process.exit(1);
    }

    console.log('✅ Bucket creado correctamente:', data.name || bucketName);
    console.log('Puedes usar NEXT_PUBLIC_AR_ASSETS_BUCKET=' + bucketName + ' si necesitas personalizarlo');
    process.exit(0);
  } catch (err) {
    console.error('Excepción ejecutando script:', err);
    process.exit(1);
  }
}

run();
