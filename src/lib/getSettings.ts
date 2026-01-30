import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

let cache: Record<string, any> | null = null;
let cacheAt = 0;

export async function getAppSettings(force = false) {
  const now = Date.now();
  if (!force && cache && now - cacheAt < 5000) return cache;
  try {
    const { data, error } = await supabase.from('app_settings').select('key, value');
    if (error) throw error;
    const settings: Record<string, any> = {};
    (data || []).forEach((r: any) => {
      try {
        settings[r.key] = JSON.parse(r.value);
      } catch {
        settings[r.key] = r.value;
      }
    });
    cache = settings;
    cacheAt = Date.now();
    return settings;
  } catch (err) {
    console.error('getAppSettings error, falling back to env defaults', err);
    cache = {
      ia_provider: process.env.GEMINI_API_KEY ? 'gemini' : (process.env.OPENAI_API_KEY ? 'openai' : 'openai'),
      ia_model: process.env.GEMINI_API_KEY ? process.env.GEMINI_DEFAULT_MODEL ?? 'gemini-2.0-flash-exp' : process.env.OPENAI_MODEL ?? 'gpt-4o',
      tts_provider: 'openai',
      tts_engine: 'alloy'
    };
    cacheAt = Date.now();
    return cache;
  }
}
