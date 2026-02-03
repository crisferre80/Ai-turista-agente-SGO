import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Obtener promociones automáticas
    const { data: promotions, error } = await supabase
      .from('auto_promotions')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching auto promotions:', error);
      return NextResponse.json({ error: 'Error al cargar promociones automáticas' }, { status: 500 });
    }

    return NextResponse.json({ promotions: promotions || [] });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const promotion = await request.json();
    console.log('Received promotion data:', promotion);

    // Validaciones
    if (!promotion.business_name || !promotion.title || !promotion.message) {
      console.log('Validation failed - missing fields:', { 
        business_name: promotion.business_name, 
        title: promotion.title, 
        message: promotion.message 
      });
      return NextResponse.json({ error: 'Faltan campos requeridos: negocio, título y mensaje son obligatorios' }, { status: 400 });
    }

    if (promotion.frequency_value < 1) {
      return NextResponse.json({ error: 'La frecuencia debe ser mayor a 0' }, { status: 400 });
    }

    if (promotion.priority < 1 || promotion.priority > 10) {
      return NextResponse.json({ error: 'La prioridad debe estar entre 1 y 10' }, { status: 400 });
    }

    // Si es edición
    if (promotion.id) {
      const { data, error } = await supabase
        .from('auto_promotions')
        .update({
          business_id: promotion.business_id,
          business_name: promotion.business_name,
          title: promotion.title,
          message: promotion.message,
          frequency_type: promotion.frequency_type,
          frequency_value: promotion.frequency_value,
          is_active: promotion.is_active,
          start_time: promotion.start_time || null,
          end_time: promotion.end_time || null,
          days_of_week: promotion.days_of_week || '[]',
          priority: promotion.priority,
          updated_at: new Date().toISOString()
        })
        .eq('id', promotion.id)
        .select();

      if (error) {
        console.error('Error updating auto promotion:', error);
        return NextResponse.json({ error: 'Error al actualizar promoción automática' }, { status: 500 });
      }

      return NextResponse.json({ success: true, promotion: data?.[0] });
    } else {
      // Nueva promoción
      const { data, error } = await supabase
        .from('auto_promotions')
        .insert([{
          business_id: promotion.business_id || '',
          business_name: promotion.business_name,
          title: promotion.title,
          message: promotion.message,
          frequency_type: promotion.frequency_type,
          frequency_value: promotion.frequency_value,
          is_active: promotion.is_active,
          start_time: promotion.start_time || null,
          end_time: promotion.end_time || null,
          days_of_week: promotion.days_of_week || '[]',
          priority: promotion.priority,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select();

      if (error) {
        console.error('Error creating auto promotion:', error);
        return NextResponse.json({ error: 'Error al crear promoción automática' }, { status: 500 });
      }

      return NextResponse.json({ success: true, promotion: data?.[0] });
    }
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    const { error } = await supabase
      .from('auto_promotions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting auto promotion:', error);
      return NextResponse.json({ error: 'Error al eliminar promoción automática' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}