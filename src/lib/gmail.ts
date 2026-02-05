import { google } from 'googleapis';

/**
 * Gmail API Service usando OAuth2 o Service Account con las credenciales de Google Cloud
 * Usa las mismas credenciales que el servicio de TTS de Google
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Crea el cliente de Gmail usando las credenciales de la aplicación
 * Intenta usar Service Account JSON primero, luego OAuth2, luego API key
 */
function getGmailClient() {
  // Opción 1: Service Account JSON (recomendado)
  const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  
  if (credentials) {
    try {
      const creds = JSON.parse(credentials);
      
      const auth = new google.auth.GoogleAuth({
        credentials: creds,
        scopes: ['https://www.googleapis.com/auth/gmail.send']
      });

      return google.gmail({ version: 'v1', auth });
    } catch (error) {
      console.error('Error al parsear credenciales de Google:', error);
      throw new Error('Credenciales de Google inválidas');
    }
  }
  
  // Opción 2: OAuth2
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  
  if (clientId && clientSecret && refreshToken) {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'http://localhost:3000' // redirect URI
    );
    
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    
    return google.gmail({ version: 'v1', auth: oauth2Client });
  }
  
  // Opción 3: API Key (limitado, no recomendado para Gmail)
  const apiKey = process.env.GOOGLE_TTS_API_KEY || process.env.GEMINI_API_KEY;
  
  if (apiKey) {
    console.warn('⚠️ Usando API Key para Gmail. Se recomienda usar Service Account JSON o OAuth2 para mayor funcionalidad.');
    
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/gmail.send']
    });
    
    return google.gmail({ version: 'v1', auth, key: apiKey });
  }
  
  throw new Error('No hay credenciales de Google configuradas. Necesitas GOOGLE_APPLICATION_CREDENTIALS_JSON, GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN, o una API key.');
}

/**
 * Codifica el email en formato RFC 2822 y Base64 URL-safe
 */
function createEmailMessage(options: EmailOptions): string {
  const { to, subject, html, from = 'noreply@tu-dominio.com' } = options;
  
  const emailLines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    html
  ];

  const email = emailLines.join('\r\n');
  
  // Codificar en Base64 URL-safe
  const encodedEmail = Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return encodedEmail;
}

/**
 * Envía un email usando Gmail API
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const gmail = getGmailClient();
    const rawMessage = createEmailMessage(options);

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: rawMessage
      }
    });

    return {
      success: true,
      messageId: response.data.id || undefined
    };
  } catch (error) {
    console.error('Error al enviar email con Gmail API:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return {
      success: false,
      error: errorMessage
    };
  }
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

/**
 * Envía un email basado en una plantilla
 */
export async function sendTemplateEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return sendEmail({ to, subject, html });
}
