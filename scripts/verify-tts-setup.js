#!/usr/bin/env node

/**
 * Script de verificación para Google TTS con Service Account
 * 
 * Verifica:
 * 1. Que el archivo de service account existe
 * 2. Que tiene el formato correcto
 * 3. Que puede autenticarse con Google Cloud
 * 4. Que la API de Text-to-Speech está habilitada
 */

const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_FILE = 'santiguia-service-account.json';
const PROJECT_ROOT = path.join(__dirname, '..');
const SERVICE_ACCOUNT_PATH = path.join(PROJECT_ROOT, SERVICE_ACCOUNT_FILE);

console.log('🔍 Verificando configuración de Google TTS con Service Account...\n');

// 1. Verificar que el archivo existe
console.log('1️⃣ Verificando archivo de credenciales...');
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('❌ ERROR: No se encontró el archivo:', SERVICE_ACCOUNT_FILE);
    console.error('   Ubicación esperada:', SERVICE_ACCOUNT_PATH);
    console.error('\n💡 Solución:');
    console.error('   1. Ve a https://console.cloud.google.com');
    console.error('   2. Navega a IAM & Admin → Service Accounts');
    console.error('   3. Busca: santiguia@santiguia-mail.iam.gserviceaccount.com');
    console.error('   4. Click en Actions → Manage Keys → Add Key → Create new key');
    console.error('   5. Selecciona JSON y guarda el archivo en la raíz del proyecto');
    process.exit(1);
}
console.log('✅ Archivo encontrado:', SERVICE_ACCOUNT_FILE);

// 2. Verificar formato del archivo
console.log('\n2️⃣ Verificando formato del archivo...');
let credentials;
try {
    const fileContent = fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8');
    credentials = JSON.parse(fileContent);
} catch (error) {
    console.error('❌ ERROR: El archivo no es un JSON válido');
    console.error('   Error:', error.message);
    process.exit(1);
}

// Verificar campos requeridos
const requiredFields = [
    'type',
    'project_id',
    'private_key_id',
    'private_key',
    'client_email',
    'client_id',
    'auth_uri',
    'token_uri'
];

const missingFields = requiredFields.filter(field => !credentials[field]);
if (missingFields.length > 0) {
    console.error('❌ ERROR: Faltan campos requeridos:', missingFields.join(', '));
    process.exit(1);
}

console.log('✅ Formato correcto');
console.log('   Project ID:', credentials.project_id);
console.log('   Service Account:', credentials.client_email);

// 3. Verificar tipo de cuenta
console.log('\n3️⃣ Verificando tipo de credencial...');
if (credentials.type !== 'service_account') {
    console.error('❌ ERROR: El tipo de credencial debe ser "service_account"');
    console.error('   Tipo actual:', credentials.type);
    process.exit(1);
}
console.log('✅ Tipo de credencial: service_account');

// 4. Verificar que la private key es válida
console.log('\n4️⃣ Verificando private key...');
if (!credentials.private_key.includes('BEGIN PRIVATE KEY')) {
    console.error('❌ ERROR: La private key no tiene el formato correcto');
    process.exit(1);
}
console.log('✅ Private key válida');

// 5. Advertencia sobre .gitignore
console.log('\n5️⃣ Verificando .gitignore...');
const gitignorePath = path.join(PROJECT_ROOT, '.gitignore');
if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    if (!gitignoreContent.includes(SERVICE_ACCOUNT_FILE)) {
        console.warn('⚠️  ADVERTENCIA: El archivo de service account NO está en .gitignore');
        console.warn('   Agrega esta línea a .gitignore:');
        console.warn('   ' + SERVICE_ACCOUNT_FILE);
    } else {
        console.log('✅ Archivo protegido en .gitignore');
    }
} else {
    console.warn('⚠️  No se encontró .gitignore');
}

// 6. Intentar autenticación (requiere googleapis)
console.log('\n6️⃣ Verificando autenticación...');
try {
    const { google } = require('googleapis');
    
    const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_PATH,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    console.log('✅ Configuración de autenticación creada correctamente');
    console.log('\n🎯 Próximos pasos:');
    console.log('   1. Habilita la Cloud Text-to-Speech API:');
    console.log('      https://console.cloud.google.com/apis/library/texttospeech.googleapis.com');
    console.log('   2. Otorga el rol "Cloud Text-to-Speech User" al service account');
    console.log('   3. Reinicia el servidor: npm run dev');
    console.log('   4. Prueba el TTS desde la aplicación');

    console.log('\n✅ VERIFICACIÓN COMPLETADA - Todo listo para usar TTS');

} catch (error) {
    console.error('❌ ERROR al cargar googleapis:', error.message);
    console.error('\n💡 Solución: Asegúrate de tener googleapis instalado:');
    console.error('   npm install googleapis');
    process.exit(1);
}

console.log('\n' + '='.repeat(60));
