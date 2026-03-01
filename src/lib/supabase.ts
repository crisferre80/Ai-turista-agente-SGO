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

// global safeguard: network errors when contacting auth endpoint often manifest
// as "TypeError: Failed to fetch" and currently bubble out of every call site.
// patch the auth client methods to catch those and return null user/session.
if (supabase && supabase.auth) {
  const auth = supabase.auth as any;
  const wrap = (orig: Function) => {
    return async function(this: any, ...args: any[]) {
      try {
        return await orig.apply(this, args);
      } catch (err: any) {
        if (err instanceof TypeError && /failed to fetch/i.test(err.message)) {
          console.warn('Supabase auth network error (swallowed):', err.message);
          // return shape matching the real SDK so callers continue gracefully
          if (orig.name.includes('getUser')) {
            return { data: { user: null }, error: err };
          }
          if (orig.name.includes('getSession')) {
            return { data: { session: null }, error: err };
          }
        }
        throw err;
      }
    };
  };

  try {
    auth.getUser = wrap(auth.getUser);
    auth.getSession = wrap(auth.getSession);
  } catch {}
}

