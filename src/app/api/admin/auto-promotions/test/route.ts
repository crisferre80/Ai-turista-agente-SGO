import { NextRequest, NextResponse } from 'next/server';
import { sendTemplateEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { promotion, testEmail } = await request.json();

    if (!promotion || !testEmail) {
      return NextResponse.json({ error: 'Faltan datos: promoción y email de prueba' }, { status: 400 });
    }

    // Procesar el mensaje con variables de plantilla si las hay
    let processedMessage = promotion.message;
    if (processedMessage.includes('{{business_name}}')) {
      processedMessage = processedMessage.replace(/\{\{business_name\}\}/g, promotion.business_name || 'Tu Negocio');
    }

    // Enviar email de prueba
    const result = await sendTemplateEmail(
      testEmail,
      `PRUEBA: ${promotion.title}`,
      processedMessage
    );

    if (!result.success) {
      return NextResponse.json({ error: `Error enviando email: ${result.error}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error) {
    console.error('Error en test email:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}