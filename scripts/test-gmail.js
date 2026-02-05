/**
 * Script de prueba para Gmail API
 * 
 * Ejecutar: node scripts/test-gmail.js
 */

const { google } = require('googleapis');

// Cargar credenciales desde .env.local
require('dotenv').config({ path: '.env.local' });

async function testGmailAPI() {
  console.log('🧪 Iniciando prueba de Gmail API...\n');

  // 1. Verificar credenciales
  console.log('1️⃣ Verificando credenciales...');
  const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const apiKey = process.env.GOOGLE_TTS_API_KEY || process.env.GEMINI_API_KEY;
  
  let authMethod = '';
  let gmail;

  if (credentials) {
    try {
      const creds = JSON.parse(credentials);
      console.log('✅ Credenciales de Service Account encontradas');
      console.log(`   📧 Service Account: ${creds.client_email}`);
      console.log(`   🏷️  Project ID: ${creds.project_id}\n`);
      
      const auth = new google.auth.GoogleAuth({
        credentials: creds,
        scopes: ['https://www.googleapis.com/auth/gmail.send']
      });
      
      gmail = google.gmail({ version: 'v1', auth });
      authMethod = 'Service Account';
    } catch (error) {
      console.error('❌ ERROR: No se pueden parsear las credenciales JSON');
      console.error('   ', error.message, '\n');
      process.exit(1);
    }
  } else if (clientId && clientSecret && refreshToken) {
    console.log('✅ Credenciales OAuth2 encontradas');
    console.log(`   🆔 Client ID: ${clientId.substring(0, 20)}...`);
    console.log(`   🔄 Refresh Token: Configurado\n`);
    
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'http://localhost:3000'
    );
    
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    
    gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    authMethod = 'OAuth2';
  } else if (apiKey) {
    console.log('⚠️ Usando API Key (limitado)');
    console.log(`   🔑 API Key: ${apiKey.substring(0, 20)}...\n`);
    
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/gmail.send']
    });
    
    gmail = google.gmail({ version: 'v1', auth, key: apiKey });
    authMethod = 'API Key';
  } else {
    console.error('❌ ERROR: No hay credenciales configuradas');
    console.log('   Necesitas:');
    console.log('   - GOOGLE_APPLICATION_CREDENTIALS_JSON (Service Account)');
    console.log('   - O GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN (OAuth2)');
    console.log('   - O GOOGLE_TTS_API_KEY/GEMINI_API_KEY (API Key, limitado)\n');
    process.exit(1);
  }

  console.log(`🔐 Método de autenticación: ${authMethod}\n`);

  // 2. Crear cliente de Gmail
  console.log('2️⃣ Cliente de Gmail listo\n');

  // 3. Preparar email de prueba
  console.log('3️⃣ Preparando email de prueba...');
  
  const to = process.env.TEST_EMAIL || 'tu-email@gmail.com'; // Cambia por tu email de prueba
  const fromEmail = authMethod === 'OAuth2' ? 'tu-cuenta@gmail.com' : 'service-account@santiguia-485803.iam.gserviceaccount.com'; // Ajusta según el caso
  
  console.log(`   📨 Destinatario: ${to}`);
  console.log(`   📧 Remitente: ${fromEmail}\n`);
  
  const emailContent = [
    `From: ${fromEmail}`,
    `To: ${to}`,
    'Subject: 🧪 Prueba de Gmail API - Sant IA Go',
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    '<html>',
    '<body style="font-family: Arial, sans-serif; padding: 20px;">',
    '<h1 style="color: #1A3A6C;">✅ Gmail API funciona correctamente!</h1>',
    '<p>Este es un email de prueba enviado desde <strong>Sant IA Go</strong>.</p>',
    '<p>Si recibiste este email, significa que la integración con Gmail API está funcionando perfectamente.</p>',
    '<hr>',
    `<p style="color: #666; font-size: 12px;">Enviado desde: ${fromEmail}</p>`,
    `<p style="color: #666; font-size: 12px;">Fecha: ${new Date().toLocaleString('es-AR')}</p>`,
    `<p style="color: #666; font-size: 12px;">Método: ${authMethod}</p>`,
    '</body>',
    '</html>'
  ].join('\r\n');

  const encodedEmail = Buffer.from(emailContent)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  console.log('✅ Email preparado\n');

  // 4. Enviar email
  console.log('4️⃣ Enviando email...');
  try {
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail
      }
    });

    console.log('✅ ¡Email enviado exitosamente!');
    console.log(`   📬 Message ID: ${response.data.id}`);
    console.log(`   🔗 Thread ID: ${response.data.threadId}\n`);

    // 5. Instrucciones finales
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 ¡PRUEBA EXITOSA!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📝 Próximos pasos:');
    console.log('   1. Revisa tu bandeja de entrada de Gmail');
    console.log(`   2. Busca un email de: ${fromEmail}`);
    console.log('   3. Si no lo ves, revisa SPAM/Promociones');
    console.log('   4. ¡La API está lista para usar en producción!\n');
  } catch (error) {
    console.error('\n❌ ERROR al enviar email:');
    console.error('   ', error.message, '\n');

    if (error.message.includes('Gmail API has not been used')) {
      console.log('💡 SOLUCIÓN:');
      console.log('   Gmail API no está habilitada en tu proyecto.');
      console.log('   Sigue estos pasos:\n');
      console.log('   1. Ve a: https://console.cloud.google.com/apis/library/gmail.googleapis.com');
      console.log('   2. Selecciona tu proyecto en Google Cloud Console');
      console.log('   3. Haz clic en "ENABLE" (Habilitar)');
      console.log('   4. Espera 1-2 minutos y vuelve a ejecutar este script\n');
    } else if (error.message.includes('insufficient_scope')) {
      console.log('💡 SOLUCIÓN:');
      console.log('   El scope no está autorizado.');
      console.log('   Para OAuth2, vuelve a autorizar con el scope correcto.');
      console.log('   Para Service Account, verifica permisos.\n');
    } else if (error.message.includes('Invalid credentials')) {
      console.log('💡 SOLUCIÓN:');
      console.log('   Las credenciales son inválidas.');
      console.log('   Verifica que las variables de entorno estén correctas.\n');
    } else {
      console.log('💡 Para más ayuda, revisa la documentación:');
      console.log('   README_gmail_api.md en la raíz del proyecto\n');
    }

    process.exit(1);
  }
}

// Ejecutar prueba
testGmailAPI().catch(error => {
  console.error('❌ Error inesperado:', error);
  process.exit(1);
});
