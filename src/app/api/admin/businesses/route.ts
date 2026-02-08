import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { data: businesses, error } = await supabase
      .from('business_profiles')
      .select('id, name, category')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching businesses:', error);
      return NextResponse.json({ error: 'Error al cargar negocios' }, { status: 500 });
    }

    return NextResponse.json({ businesses: businesses || [] });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}