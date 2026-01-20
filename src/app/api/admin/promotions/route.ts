import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin not configured');
  return createClient(url, key, { auth: { persistSession: false } });
};

export async function GET(request: Request) {
  try {
    const admin = getAdmin();
    const url = new URL(request.url);
    const placeId = url.searchParams.get('place_id');

    let query = admin.from('promotions').select('*').order('created_at', { ascending: false });
    if (placeId) query = query.eq('place_id', placeId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ ok: true, promotions: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, place_id, title, description, image_url, terms, starts_at, ends_at, is_active } = body;
    if (!title) return NextResponse.json({ error: 'Missing title' }, { status: 400 });

    const admin = getAdmin();

    if (id) {
      const { data, error } = await admin.from('promotions').update({ place_id, title, description, image_url, terms, starts_at, ends_at, is_active }).eq('id', id).select().single();
      if (error) throw error;
      return NextResponse.json({ ok: true, promotion: data });
    } else {
      const { data, error } = await admin.from('promotions').insert([{ place_id, title, description, image_url, terms, starts_at, ends_at, is_active }]).select().single();
      if (error) throw error;
      return NextResponse.json({ ok: true, promotion: data });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const admin = getAdmin();
    const { error } = await admin.from('promotions').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}