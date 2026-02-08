import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

export async function POST(req: Request) {
    try {
        const { to, subject, html, text } = await req.json();

        if (!to || !subject) {
            return NextResponse.json(
                { error: 'Faltan parámetros requeridos: to, subject' },
                { status: 400 }
            );
        }

        const result = await sendEmail({
            to,
            subject,
            html: html || `<p>${text || 'Email de prueba desde SantiGuía'}</p>`
        });

        if (result.success) {
            return NextResponse.json({
                success: true,
                messageId: result.messageId,
                message: 'Email enviado correctamente'
            });
        } else {
            return NextResponse.json(
                { error: result.error || 'Error al enviar email' },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('Error en /api/send-email:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

// Endpoint de prueba GET
export async function GET() {
    try {
        // Enviar email de prueba
        const result = await sendEmail({
            to: 'test@example.com', // Cambiar por tu email para pruebas
            subject: 'Email de prueba desde SantiGuía',
            html: `
                <h1>¡Hola desde SantiGuía!</h1>
                <p>Este es un email de prueba para verificar la configuración de Mailjet.</p>
                <p>Si recibís este mensaje, la configuración está funcionando correctamente.</p>
            `
        });

        if (result.success) {
            return NextResponse.json({
                success: true,
                messageId: result.messageId,
                message: 'Email de prueba enviado correctamente'
            });
        } else {
            return NextResponse.json(
                { error: result.error },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('Error en GET /api/send-email:', error);
        return NextResponse.json(
            { error: 'Error al enviar email de prueba' },
            { status: 500 }
        );
    }
}
