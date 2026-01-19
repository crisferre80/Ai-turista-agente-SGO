import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin not configured');
  return createClient(url, key, { auth: { persistSession: false } });
};

// Development-only seed endpoint to add example templates
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 });
  }

  try {
    const admin = getAdmin();

    const sample = [
      {
        name: 'Bienvenida - Nuevo Suscriptor',
        subject: '¡Bienvenido a nuestra app turística, {{name}}!',
        html: '<h1>¡Bienvenido, {{name}}!</h1><p>Gracias por suscribirte a nuestras novedades locales. Estamos felices de tenerte con nosotros.</p>'
      },
      {
        name: 'Bienvenida - Nuevo Negocio',
        subject: '¡Tu negocio ha sido registrado, {{name}}!',
        html: '<h1>¡Gracias por registrarte, {{name}}!</h1><p>En breve revisaremos tu solicitud y te notificaremos cuando tu negocio esté activo en la app.</p>'
      },
      {
        name: 'Novedades Mensuales',
        subject: 'Resumen: cosas nuevas este mes',
        html: '<h1>Novedades del mes</h1><p>Aquí tienes las últimas atracciones y eventos.</p>'
      },
      {
        name: 'Promoción - Descuento',
        subject: 'Oferta especial para visitantes',
        html: '<h1>Oferta limitada</h1><p>Presenta este cupón para obtener un descuento exclusivo.</p>'
      }
    ];

    const { data, error } = await admin.from('email_templates').insert(sample).select();
    if (error) throw error;

    return NextResponse.json({ ok: true, templates: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}