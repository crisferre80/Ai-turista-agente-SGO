import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET() {
  try {
    const { data, error } = await supabase.from('app_settings').select('key, value');
    if (error) throw error;
    const settings: Record<string, unknown> = {};
    (data || []).forEach((r) => {
      try {
        settings[r.key] = JSON.parse(r.value);
      } catch {
        settings[r.key] = r.value;
      }
    });
    return NextResponse.json({ settings });
  } catch (err) {
    console.error('/api/admin/settings GET error', err);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('/api/admin/settings POST payload:', JSON.stringify(body));

    if (!body || Object.keys(body).length === 0) {
      return NextResponse.json({ error: 'No settings provided' }, { status: 400 });
    }

    const entries = Object.entries(body as Record<string, unknown>);
    const payload: { key: string; value: string }[] = entries.map(([key, value]) => ({ key, value: JSON.stringify(value) }));

    const { error } = await supabase.from('app_settings').upsert(payload, { onConflict: 'key' });
    if (error) {
      console.error('/api/admin/settings SUPABASE error', error);
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as Error & { details?: unknown };
    console.error('/api/admin/settings POST error', e);
    const message = e?.message || 'Failed to save settings';
    const details = (e as { details?: unknown }).details ?? null;
    const suggestion = message.includes('relation') ? 'Did you run the DB migration to create table app_settings?' : undefined;
    const payload: Record<string, unknown> = { error: message, details, suggestion };
    if (process.env.NODE_ENV !== 'production' && e instanceof Error) Object.assign(payload, { stack: e.stack });
    return NextResponse.json(payload, { status: 500 });
  }
}
