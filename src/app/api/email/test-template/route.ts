import { NextRequest, NextResponse } from 'next/server';
import { sendTemplateEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
    try {
        const { to, subject, html, templateVars } = await request.json();

        if (!to || !subject || !html) {
            return NextResponse.json(
                { error: 'Faltan campos requeridos: to, subject, html' },
                { status: 400 }
            );
        }

        // Procesar variables de plantilla
        let processedHtml = html;
        let processedSubject = subject;

        if (templateVars) {
            Object.entries(templateVars).forEach(([key, value]) => {
                const regex = new RegExp(`{{${key}}}`, 'g');
                processedHtml = processedHtml.replace(regex, String(value));
                processedSubject = processedSubject.replace(regex, String(value));
            });
        }

        // Enviar email usando Mailjet
        const result = await sendTemplateEmail(to, processedSubject, processedHtml);

        if (!result.success) {
            throw new Error(`Error enviando email: ${result.error}`);
        }

        return NextResponse.json({ success: true, messageId: result.messageId });
    } catch (error) {
        console.error('Error en test-template:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}