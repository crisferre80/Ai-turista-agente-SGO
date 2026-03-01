import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing attraction ID' }, { status: 400 });
    }

    console.log('🔄 API: Updating attraction', id, 'with:', Object.keys(updates));

    // Update in Supabase
    const { error } = await admin
      .from('attractions')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('❌ API: Supabase update error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.log('✅ API: Attraction updated successfully, revalidating cache...');

    // Revalidate all routes that might display this attraction
    try {
      // Revalidate the specific detail page
      revalidatePath(`/explorar/${id}`);
      console.log(`✅ Revalidated /explorar/${id}`);

      // Revalidate explore page (catalog)
      revalidatePath('/explorar');
      console.log('✅ Revalidated /explorar');

      // Revalidate home page (might show featured places)
      revalidatePath('/');
      console.log('✅ Revalidated /');
    } catch (revalidateError) {
      console.warn('⚠️ Revalidation warning:', revalidateError);
      // Don't fail the request if revalidation fails
    }

    return NextResponse.json({ 
      ok: true, 
      message: 'Attraction updated and cache revalidated' 
    });
  } catch (err) {
    console.error('❌ API: Error updating attraction:', err);
    const message = err instanceof Error ? err.message : 'Failed to update attraction';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    console.log('🆕 API: Creating NEW attraction with:', Object.keys(body));

    // Insert in Supabase
    const { data, error } = await admin
      .from('attractions')
      .insert([body])
      .select()
      .single();

    if (error) {
      console.error('❌ API: Supabase insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ error: 'No data returned from insert' }, { status: 400 });
    }

    console.log('✅ API: Attraction created successfully, revalidating cache...');

    // Revalidate explore pages
    try {
      revalidatePath('/explorar');
      console.log('✅ Revalidated /explorar');

      revalidatePath('/');
      console.log('✅ Revalidated /');
    } catch (revalidateError) {
      console.warn('⚠️ Revalidation warning:', revalidateError);
    }

    return NextResponse.json({ 
      ok: true, 
      id: data.id,
      message: 'Attraction created and cache revalidated'
    });
  } catch (err) {
    console.error('❌ API: Error creating attraction:', err);
    const message = err instanceof Error ? err.message : 'Failed to create attraction';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
