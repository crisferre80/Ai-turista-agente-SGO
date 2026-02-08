import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Reemplazar variables en el contenido HTML
function replaceVariables(content: string, variables: Record<string, string>): string {
    let result = content;
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        result = result.replace(regex, value);
    }
    return result;
}

// Enviar email en batch para evitar límites de rate
async function sendEmailBatch(emails: Array<{ to: string; subject: string; html: string }>, batchSize = 10) {
    const results = {
        sent: 0,
        failed: 0,
        errors: [] as string[]
    };

    for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize);
        
        const promises = batch.map(async (email) => {
            try {
                const result = await sendEmail({
                    to: email.to,
                    subject: email.subject,
                    html: email.html
                });
                
                if (result.success) {
                    results.sent++;
                    return { success: true, email: email.to };
                } else {
                    results.failed++;
                    results.errors.push(`${email.to}: ${result.error}`);
                    return { success: false, email: email.to, error: result.error };
                }
            } catch (error) {
                results.failed++;
                const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
                results.errors.push(`${email.to}: ${errorMsg}`);
                return { success: false, email: email.to, error: errorMsg };
            }
        });

        await Promise.all(promises);
        
        // Pequeña pausa entre batches para evitar rate limiting
        if (i + batchSize < emails.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    return results;
}

export async function POST(req: Request) {
    try {
        const { templateId, recipientType, recipientTags, campaignName } = await req.json();

        if (!templateId) {
            return NextResponse.json({ error: 'Template ID es requerido' }, { status: 400 });
        }

        // Obtener plantilla
        const { data: template, error: templateError } = await supabase
            .from('email_templates')
            .select('*')
            .eq('id', templateId)
            .single();

        if (templateError || !template) {
            return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });
        }

        // Obtener contactos según filtros
        let query = supabase
            .from('email_contacts')
            .select('*')
            .eq('subscribed', true);

        if (recipientType === 'specific_tags' && recipientTags?.length > 0) {
            query = query.contains('tags', recipientTags);
        }

        const { data: contacts, error: contactsError } = await query;

        if (contactsError || !contacts || contacts.length === 0) {
            return NextResponse.json({ error: 'No se encontraron contactos' }, { status: 404 });
        }

        // Crear campaña
        const { data: campaign, error: campaignError } = await supabase
            .from('email_campaigns')
            .insert([{
                name: campaignName || `Campaña ${template.name}`,
                template_id: templateId,
                subject: template.subject,
                status: 'sending',
                total_recipients: contacts.length,
                recipients_filter: { type: recipientType, tags: recipientTags }
            }])
            .select()
            .single();

        if (campaignError || !campaign) {
            return NextResponse.json({ error: 'Error creando campaña' }, { status: 500 });
        }

        // Preparar emails
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const emails = contacts.map(contact => {
            const variables = {
                nombre: contact.name || contact.email.split('@')[0],
                email: contact.email,
                app_url: appUrl
            };

            return {
                to: contact.email,
                subject: replaceVariables(template.subject, variables),
                html: replaceVariables(template.html_content, variables),
                contactId: contact.id
            };
        });

        // Enviar emails en background (no bloquear respuesta)
        Promise.resolve().then(async () => {
            const results = await sendEmailBatch(emails);

            // Actualizar campaña
            await supabase
                .from('email_campaigns')
                .update({
                    status: 'sent',
                    sent_count: results.sent,
                    failed_count: results.failed,
                    sent_at: new Date().toISOString()
                })
                .eq('id', campaign.id);

            // Registrar logs
            const logs = emails.map((email, idx) => ({
                campaign_id: campaign.id,
                contact_id: email.contactId,
                email: email.to,
                status: idx < results.sent ? 'sent' : 'failed',
                error_message: idx >= results.sent ? results.errors[idx - results.sent] : null,
                sent_at: new Date().toISOString()
            }));

            await supabase.from('email_logs').insert(logs);

            console.log(`✅ Campaña ${campaign.id} completada: ${results.sent} enviados, ${results.failed} fallidos`);
        });

        return NextResponse.json({
            success: true,
            campaignId: campaign.id,
            totalRecipients: contacts.length,
            message: `Campaña iniciada. Se enviarán ${contacts.length} emails.`,
            sent: contacts.length
        });

    } catch (error) {
        console.error('Error en /api/email/send-campaign:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
