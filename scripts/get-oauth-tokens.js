require('dotenv').config({ path: '.env.local' });

const { google } = require('googleapis');
const readline = require('readline');

const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

async function getOAuthTokens() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('❌ GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET deben estar configurados en .env.local');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'http://localhost:3000' // redirect URI
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('🔗 Ve a esta URL para autorizar la aplicación:');
  console.log(authUrl);
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('📋 Pega el código de autorización aquí: ', async (code) => {
    rl.close();

    try {
      const { tokens } = await oauth2Client.getToken(code);
      console.log('✅ Tokens obtenidos exitosamente!');
      console.log('');
      console.log('📝 Agrega esta línea a tu .env.local:');
      console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log('');
      console.log('⚠️  Guarda el refresh_token de forma segura. No lo compartas.');
    } catch (error) {
      console.error('❌ Error al obtener tokens:', error.message);
    }
  });
}

getOAuthTokens();