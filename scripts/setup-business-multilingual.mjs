#!/usr/bin/env node

/**
 * Script para agregar campos multilingües a business_profiles en Supabase
 * Uso: node scripts/setup-business-multilingual.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function setupBusinessMultilingual() {
  console.log('🔧 Agregando campos multilingües a business_profiles...');

  try {
    // Ejecutar la migración SQL
    const { error } = await supabase.rpc('execute_sql', {
      sql: `
        -- Agregar campos multilingües a business_profiles si no existen
        
        -- description_en
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'business_profiles' AND column_name = 'description_en'
          ) THEN
            ALTER TABLE business_profiles ADD COLUMN description_en TEXT;
          END IF;
        END $$;

        -- description_pt
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'business_profiles' AND column_name = 'description_pt'
          ) THEN
            ALTER TABLE business_profiles ADD COLUMN description_pt TEXT;
          END IF;
        END $$;

        -- description_fr
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'business_profiles' AND column_name = 'description_fr'
          ) THEN
            ALTER TABLE business_profiles ADD COLUMN description_fr TEXT;
          END IF;
        END $$;

        -- tts_voice_gender
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'business_profiles' AND column_name = 'tts_voice_gender'
          ) THEN
            ALTER TABLE business_profiles ADD COLUMN tts_voice_gender VARCHAR(20) DEFAULT 'MALE';
          END IF;
        END $$;

        -- tts_voice_name
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'business_profiles' AND column_name = 'tts_voice_name'
          ) THEN
            ALTER TABLE business_profiles ADD COLUMN tts_voice_name VARCHAR(255);
          END IF;
        END $$;
      `
    });

    if (error) {
      throw error;
    }

    // Verificar que los campos fueron creados
    const { data: columns, error: checkError } = await supabase
      .from('business_profiles')
      .select('*')
      .limit(1);

    if (checkError) {
      throw checkError;
    }

    console.log('✅ Campos multilingües agregados correctamente a business_profiles');
    console.log('✨ Campos disponibles:');
    console.log('   - description (español)');
    console.log('   - description_en (inglés)');
    console.log('   - description_pt (portugués)');
    console.log('   - description_fr (francés)');
    console.log('   - tts_voice_gender (preferencia de voz: MALE/FEMALE)');
    console.log('   - tts_voice_name (nombre específico de voz)');

  } catch (err) {
    console.error('❌ Error al agregar campos:', err);
    console.log('\n📝 Alternativamente, ejecuta este SQL directamente en el SQL Editor de Supabase:');
    console.log('scripts/add_multilingual_business_fields.sql');
    process.exit(1);
  }
}

setupBusinessMultilingual();
