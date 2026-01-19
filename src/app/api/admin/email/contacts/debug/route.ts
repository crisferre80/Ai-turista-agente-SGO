import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin not configured');
  return createClient(url, key, { auth: { persistSession: false } });
};

export async function GET() {
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  try {
    const admin = getAdmin();

    const contactsRes = await admin.from('email_contacts').select('*').order('created_at', { ascending: false });
    const profilesRes = await admin.from('profiles').select('id, name').order('created_at', { ascending: false });
    const usersRes = await admin.from('auth.users').select('id, email');

    return NextResponse.json({ ok: true, contactsRes, profilesRes, usersRes }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message, details: err instanceof Error ? err.stack : undefined }, { status: 500 });
  }
}