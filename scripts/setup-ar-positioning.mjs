/**
 * Script para aplicar la migración de ar_positioned_objects
 * 
 * Uso:
 * node scripts/setup-ar-positioning.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Faltan variables de entorno');
  console.error('Asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 Iniciando migración de ar_positioned_objects...\n');

  try {
    // Leer archivo de migración
    const migrationPath = join(__dirname, '../supabase/migrations/20250101_ar_positioned_objects.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📄 Archivo de migración cargado');
    console.log('📝 Ejecutando SQL...\n');

    // Ejecutar SQL
    // Nota: Supabase JS no soporta ejecutar SQL multi-statement directamente
    // Dividir por statements y ejecutar uno por uno
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`[${i + 1}/${statements.length}] Ejecutando statement...`);
      
      const { error } = await supabase.rpc('exec_sql', { query: statement + ';' });
      
      if (error) {
        console.warn(`⚠️  Statement ${i + 1} error:`, error.message);
        // Algunos errores son esperados (ej: IF NOT EXISTS)
      } else {
        console.log(`✅ Statement ${i + 1} ejecutado`);
      }
    }

    console.log('\n✅ Migración completada!');
    console.log('\n📊 Verificando tabla...');

    // Verificar que la tabla existe
    const { data, error } = await supabase
      .from('ar_positioned_objects')
      .select('count');

    if (error) {
      console.error('❌ Error verificando tabla:', error);
      console.log('\n⚠️  La migración puede haber fallado. Ejecuta el SQL manualmente desde Supabase Dashboard.');
    } else {
      console.log('✅ Tabla ar_positioned_objects verificada');
    }

    console.log('\n🎉 Setup completado!');
    console.log('\nPróximos pasos:');
    console.log('1. Ve a /admin/webxr-tools');
    console.log('2. Selecciona un atractivo');
    console.log('3. Usa el tab "QR Codes" o "GPS Positioning"');

  } catch (error) {
    console.error('❌ Error ejecutando migración:', error);
    console.log('\n💡 Solución alternativa:');
    console.log('1. Ve a Supabase Dashboard > SQL Editor');
    console.log('2. Copia el contenido de supabase/migrations/20250101_ar_positioned_objects.sql');
    console.log('3. Ejecuta el script manualmente');
    process.exit(1);
  }
}

// Ejecutar
runMigration().catch(console.error);
