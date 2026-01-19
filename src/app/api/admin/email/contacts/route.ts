import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin not configured');
  return createClient(url, key, { auth: { persistSession: false } });
};

type ContactRecord = { id?: string; name?: string; email?: string; created_at?: string };

export async function GET() {
  try {
    const admin = getAdmin();

    // Fetch manual contacts table
    const { data: contactsData, error: contactsErr } = await admin.from('email_contacts').select('*').order('created_at', { ascending: false });
    if (contactsErr) {
      console.error('Error fetching email_contacts:', contactsErr);
      const msg = (contactsErr && typeof (contactsErr as { message?: unknown }).message === 'string') ? ((contactsErr as { message?: string }).message) : JSON.stringify(contactsErr);
      throw new Error(String(msg));
    }

    // Also include profiles and their corresponding auth users (email is stored in auth.users)
    const { data: profilesData, error: profilesErr } = await admin.from('profiles').select('id, name').order('created_at', { ascending: false });
    if (profilesErr) {
      console.error('Error fetching profiles:', profilesErr);
      const msg = (profilesErr && typeof (profilesErr as { message?: unknown }).message === 'string') ? ((profilesErr as { message?: string }).message) : JSON.stringify(profilesErr);
      throw new Error(String(msg));
    }

    console.debug('Contacts fetched:', { contactsCount: (contactsData || []).length, profilesCount: (profilesData || []).length });

    // Normalize and merge by email (profiles included only if they have an email field)
    type ContactRecordOut = { id?: string; name?: string | null; email?: string | null; source?: 'manual' | 'profile' };
    const map = new Map<string, ContactRecordOut>();

    // Add manual contacts (from email_contacts)
    (contactsData || []).forEach((c: Record<string, unknown>) => {
      const email = (c.email as string | undefined | null) || null;
      if (email) map.set(String(email).toLowerCase(), { id: (c.id as string | undefined) || undefined, name: (c.name as string | null) || null, email, source: 'manual' });
    });

    // Add profiles only when they explicitly include an email attribute (some schemas store email in auth.users)
    (profilesData || []).forEach((p: Record<string, unknown>) => {
      const email = (p.email as string | undefined | null) || null;
      if (email) {
        const profileId = p.id as string | undefined;
        map.set(String(email).toLowerCase(), { id: profileId || undefined, name: (p.name as string | null) || null, email, source: 'profile' });
      }
    });

    const merged = Array.from(map.values());

    console.debug('Merged contacts count:', merged.length);

    return NextResponse.json({ ok: true, contacts: merged, counts: { contacts: (contactsData || []).length, profiles: (profilesData || []).length, merged: merged.length } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('GET /api/admin/email/contacts failed:', message, err);
    // In development include stack if available
    return NextResponse.json({ error: message, details: process.env.NODE_ENV !== 'production' ? (err instanceof Error ? err.stack : undefined) : undefined }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, email } = await request.json();
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    // basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return NextResponse.json({ error: 'Invalid email' }, { status: 400 });

    const admin = getAdmin();
    const { data, error } = await admin.from('email_contacts').insert([{ name: name || null, email }]).select().single();
    if (error) throw error;
    const inserted = data as ContactRecord;
    return NextResponse.json({ ok: true, contact: inserted });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const admin = getAdmin();
    const { error } = await admin.from('email_contacts').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}