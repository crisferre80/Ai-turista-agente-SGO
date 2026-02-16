import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Verificación mejorada de credenciales
export const isSupabaseConfigured = (): boolean => {
  const configured = !!supabaseUrl && !!supabaseAnonKey && 
                     supabaseUrl !== '' && supabaseAnonKey !== '';
  
  if (!configured) {
    console.error('❌ Supabase NO está configurado correctamente');
    console.error('Variables requeridas:');
    console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓ Definida' : '✗ Falta');
    console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓ Definida' : '✗ Falta');
  } else {
    console.log('✅ Supabase configurado:', supabaseUrl);
  }
  
  return configured;
};

// Verificar en tiempo de importación
if (typeof window !== 'undefined' && !isSupabaseConfigured()) {
  console.warn('⚠️ Supabase credentials missing. Data persistence will not work until .env.local is configured.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
