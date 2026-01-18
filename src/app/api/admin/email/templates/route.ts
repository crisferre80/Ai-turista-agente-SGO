import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin not configured');
  return createClient(url, key, { auth: { persistSession: false } });
};

export async function GET() {
  try {
    const admin = getAdmin();
    const { data, error } = await admin.from('email_templates').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ ok: true, templates: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, subject, html } = body;
    if (!name || !subject) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const admin = getAdmin();

    if (id) {
      const { data, error } = await admin.from('email_templates').update({ name, subject, html }).eq('id', id).select().single();
      if (error) throw error;
      return NextResponse.json({ ok: true, template: data });
    } else {
      const { data, error } = await admin.from('email_templates').insert([{ name, subject, html }]).select().single();
      if (error) throw error;
      return NextResponse.json({ ok: true, template: data });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
