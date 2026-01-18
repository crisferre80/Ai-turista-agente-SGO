import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  // Development-only safety
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Supabase service role not configured in env' }, { status: 500 });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    const counts: Record<string, any> = {};

    const c1 = await admin.from('email_contacts').select('id', { count: 'estimated' }).limit(1);
    counts.email_contacts = (c1.count ?? null) || null;

    const c2 = await admin.from('email_templates').select('id', { count: 'estimated' }).limit(1);
    counts.email_templates = (c2.count ?? null) || null;

    const c3 = await admin.from('email_campaigns').select('id', { count: 'estimated' }).limit(1);
    counts.email_campaigns = (c3.count ?? null) || null;

    return NextResponse.json({ ok: true, counts });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
  }
}
