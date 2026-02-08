import Mailjet from 'node-mailjet';

/**
 * Tipos para la respuesta de Mailjet
 */
interface MailjetMessageResponse {
  Status: string;
  To: Array<{ MessageID?: string }>;
  ErrorMessage?: string;
}

interface MailjetSendResponse {
  body: {
    Messages: MailjetMessageResponse[];
  };
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Crea el cliente de Mailjet
 */
function getMailjetClient() {
  const apiKey = process.env.MAILJET_API_KEY;
  const secretKey = process.env.MAILJET_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error('MAILJET_API_KEY y MAILJET_SECRET_KEY son requeridos');
  }

  return new Mailjet({
    apiKey,
    apiSecret: secretKey
  });
}

/**
 * Envía un email usando Mailjet
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const mailjet = getMailjetClient();
    const fromEmail = process.env.MAIL_FROM_EMAIL || 'noreply@santiguia.com';
    const { to, subject, html } = options;

    const request = mailjet
      .post('send', { version: 'v3.1' })
      .request({
        Messages: [
          {
            From: {
              Email: fromEmail,
              Name: 'SantiGuía'
            },
            To: [
              {
                Email: to,
                Name: to.split('@')[0] // Nombre simple del destinatario
              }
            ],
            Subject: subject,
            HTMLPart: html
          }
        ]
      });

    const result = await request;

    // Mailjet devuelve un array de mensajes enviados
    const body = (result as unknown as MailjetSendResponse).body;
    if (body && body.Messages && body.Messages.length > 0) {
      const message = body.Messages[0];
      if (message.Status === 'success') {
        return {
          success: true,
          messageId: message.To[0]?.MessageID || undefined
        };
      } else {
        return {
          success: false,
          error: `Error de Mailjet: ${message.ErrorMessage || 'Error desconocido'}`
        };
      }
    }

    return {
      success: false,
      error: 'Respuesta inesperada de Mailjet'
    };
  } catch (error) {
    console.error('Error al enviar email con Mailjet:', error);

    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Envía un email basado en una plantilla (simulado con reemplazo de variables)
 */
export async function sendTemplateEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return sendEmail({ to, subject, html });
}

/**
 * Envía un email de bienvenida
 */
export async function sendWelcomeEmail(to: string, name: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1A3A6C 0%, #2C5AA0 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #F1C40F; color: #1A3A6C; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>¡Bienvenido/a a Santiago del Estero!</h1>
        </div>
        <div class="content">
          <h2>Hola ${name},</h2>
          <p>¡Qué alegría tenerte con nosotros! Gracias por unirte a nuestra comunidad de exploradores de Santiago del Estero.</p>
          <p>Con nuestra aplicación podrás:</p>
          <ul>
            <li>🗺️ Descubrir lugares increíbles de la provincia</li>
            <li>🎙️ Grabar tus historias y experiencias</li>
            <li>⭐ Dejar reseñas de los lugares que visites</li>
            <li>🤖 Chatear con Santi, tu guía turístico virtual</li>
          </ul>
          <p style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}" class="button">Comenzar a Explorar</a>
          </p>
          <p>¡Que disfrutes tu aventura en Santiago del Estero!</p>
        </div>
        <div class="footer">
          <p>Este es un correo automático. Por favor no responder a este mensaje.</p>
          <p>&copy; ${new Date().getFullYear()} Santiago del Estero Turismo</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: '¡Bienvenido/a a Santiago del Estero! 🌵',
    html
  });
}