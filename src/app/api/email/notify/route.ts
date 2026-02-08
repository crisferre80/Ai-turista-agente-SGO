import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type NotificationData = Record<string, string>;

interface NotificationEvent {
    type: 'welcome' | 'new_business' | 'new_feature' | 'new_story' | 'reminder';
    data: NotificationData;
    recipientEmail?: string; // Para notificaciones específicas como welcome
}

function replaceVariables(content: string, variables: Record<string, string>): string {
    let result = content;
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        result = result.replace(regex, value || '');
    }
    return result;
}

export async function POST(req: Request) {
    try {
        const event: NotificationEvent = await req.json();

        if (!event.type) {
            return NextResponse.json({ error: 'Event type es requerido' }, { status: 400 });
        }

        // Verificar si la notificación está habilitada
        const { data: settings, error: settingsError } = await supabase
            .from('email_notification_settings')
            .select('*')
            .eq('event_type', event.type)
            .single();

        if (settingsError || !settings || !settings.enabled) {
            return NextResponse.json({ 
                success: true, 
                message: 'Notificación deshabilitada o no configurada' 
            });
        }

        // Obtener plantilla
        if (!settings.template_id) {
            return NextResponse.json({ 
                error: 'No hay plantilla configurada para este evento' 
            }, { status: 400 });
        }

        const { data: template, error: templateError } = await supabase
            .from('email_templates')
            .select('*')
            .eq('id', settings.template_id)
            .single();

        if (templateError || !template) {
            return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });
        }

        // Determinar destinatarios
        let recipients: Array<{ email: string; name?: string }> = [];

        if (event.recipientEmail) {
            // Envío específico (ej: welcome)
            recipients = [{ email: event.recipientEmail, name: event.data.name }];
        } else {
            // Envío masivo según configuración
            let query = supabase
                .from('email_contacts')
                .select('email, name')
                .eq('subscribed', true);

            if (settings.recipient_type === 'specific_tags' && settings.recipient_tags?.length > 0) {
                query = query.contains('tags', settings.recipient_tags);
            }

            const { data: contacts } = await query;
            recipients = contacts || [];
        }

        if (recipients.length === 0) {
            return NextResponse.json({ 
                success: true, 
                message: 'No hay destinatarios para esta notificación' 
            });
        }

        // Preparar variables según tipo de evento
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        let baseVariables: Record<string, string> = {
            app_url: appUrl,
            ...event.data
        };

        // Variables específicas por tipo de evento
        switch (event.type) {
            case 'new_business':
                baseVariables = {
                    ...baseVariables,
                    business_name: event.data.name || 'Nuevo negocio',
                    category: event.data.category || '',
                    location: event.data.location || '',
                    description: event.data.description || '',
                    business_url: `${appUrl}/business/${event.data.id}`
                };
                break;
            case 'new_feature':
                baseVariables = {
                    ...baseVariables,
                    feature_name: event.data.name || 'Nueva función',
                    feature_description: event.data.description || '',
                    feature_url: event.data.url || appUrl
                };
                break;
            case 'new_story':
                baseVariables = {
                    ...baseVariables,
                    story_title: event.data.title || 'Nuevo relato',
                    story_excerpt: event.data.excerpt || '',
                    story_url: `${appUrl}/stories/${event.data.id}`
                };
                break;
        }

        // Enviar emails
        const sendPromises = recipients.map(async (recipient) => {
            const variables = {
                ...baseVariables,
                nombre: recipient.name || recipient.email.split('@')[0],
                email: recipient.email
            };

            try {
                // Aplicar delay si está configurado
                if (settings.delay_minutes > 0) {
                    await new Promise(resolve => 
                        setTimeout(resolve, settings.delay_minutes * 60 * 1000)
                    );
                }

                const result = await sendEmail({
                    to: recipient.email,
                    subject: replaceVariables(template.subject, variables),
                    html: replaceVariables(template.html_content, variables)
                });

                return { success: result.success, email: recipient.email };
            } catch (error) {
                console.error(`Error enviando a ${recipient.email}:`, error);
                return { success: false, email: recipient.email };
            }
        });

        // Ejecutar envíos (limitando concurrencia)
        const batchSize = 10;
        const results = [];
        for (let i = 0; i < sendPromises.length; i += batchSize) {
            const batch = sendPromises.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch);
            results.push(...batchResults);
            
            // Pausa entre batches
            if (i + batchSize < sendPromises.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        console.log(`📧 Notificación ${event.type}: ${successCount} enviados, ${failCount} fallidos`);

        return NextResponse.json({
            success: true,
            eventType: event.type,
            sent: successCount,
            failed: failCount,
            total: recipients.length
        });

    } catch (error) {
        console.error('Error en /api/email/notify:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
