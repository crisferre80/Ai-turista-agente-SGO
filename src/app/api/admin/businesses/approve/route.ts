import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendBusinessApprovalEmail } from '@/lib/email-notifications';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación del admin
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Verificar que sea admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ error: 'No tienes permisos de admin' }, { status: 403 });
    }

    const { businessId } = await request.json();

    if (!businessId) {
      return NextResponse.json({ error: 'ID de negocio requerido' }, { status: 400 });
    }

    // Obtener datos del negocio antes de aprobar
    const { data: business, error: businessError } = await supabase
      .from('business_profiles')
      .select('name, email, auth_id')
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });
    }

    // Aprobar el negocio
    const { error: updateError } = await supabase
      .from('business_profiles')
      .update({
        is_active: true,
        payment_status: 'paid'
      })
      .eq('id', businessId);

    if (updateError) {
      return NextResponse.json({ error: 'Error al aprobar negocio' }, { status: 500 });
    }

    // Enviar email de aprobación
    try {
      // Obtener nombre del owner desde profiles
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', business.auth_id)
        .single();

      const ownerName = ownerProfile?.name || business.email.split('@')[0];

      await sendBusinessApprovalEmail(
        business.email,
        ownerName,
        business.name
      );

      console.log('📧 Email de aprobación enviado al negocio:', business.email);
    } catch (emailError) {
      console.error('❌ Error al enviar email de aprobación:', emailError);
      // No fallar la aprobación por error en email
    }

    return NextResponse.json({
      success: true,
      message: 'Negocio aprobado exitosamente'
    });

  } catch (error) {
    console.error('Error en aprobación de negocio:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}