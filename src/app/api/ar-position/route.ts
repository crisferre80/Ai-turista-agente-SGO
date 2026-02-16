import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.warn('Supabase service role not configured for server API /api/ar-position');
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Basic validation
    const { attraction_id, latitude, longitude, altitude, label, model_url } = body;
    if (!attraction_id || typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }

    const { data, error } = await admin
      .from('ar_positioned_objects')
      .insert({ attraction_id, latitude, longitude, altitude: altitude ?? null, label: label ?? null, model_url: model_url ?? null })
      .select();

    if (error) {
      console.error('Supabase insert error (server):', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    console.error('POST /api/ar-position error:', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, latitude, longitude, altitude, label } = body;
    if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (typeof latitude === 'number') updates.latitude = latitude;
    if (typeof longitude === 'number') updates.longitude = longitude;
    if (typeof altitude === 'number') updates.altitude = altitude;
    if (typeof label === 'string') updates.label = label;

    const { data, error } = await admin
      .from('ar_positioned_objects')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Supabase update error (server):', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (err) {
    console.error('PUT /api/ar-position error:', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

    const { data, error } = await admin.from('ar_positioned_objects').delete().eq('id', id).select();
    if (error) {
      console.error('Supabase delete error (server):', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (err) {
    console.error('DELETE /api/ar-position error:', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
