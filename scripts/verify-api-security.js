#!/usr/bin/env node

/**
 * Script de Verificación de Seguridad de API Keys
 * 
 * Este script verifica que tus API keys estén correctamente configuradas
 * y que no haya claves expuestas en el código.
 * 
 * Uso: node scripts/verify-api-security.js
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function header(message) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(message, 'cyan');
  log('='.repeat(60), 'cyan');
}

function checkmark(message) {
  log(`✓ ${message}`, 'green');
}

function warning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function error(message) {
  log(`✗ ${message}`, 'red');
}

function info(message) {
  log(`ℹ ${message}`, 'blue');
}

// Verificaciones
let hasErrors = false;
let hasWarnings = false;

header('🔐 Verificación de Seguridad de API Keys');

// 1. Verificar que .env.local existe
info('\n1. Verificando archivo .env.local...');
if (fs.existsSync('.env.local')) {
  checkmark('.env.local existe');
} else {
  warning('.env.local NO existe. Crea uno basándote en .env.local.example');
  hasWarnings = true;
}

// 2. Verificar configuración de Gemini
info('\n2. Verificando configuración de Gemini API...');
const geminiKey = process.env.GEMINI_API_KEY;

if (!geminiKey) {
  warning('GEMINI_API_KEY no está configurada');
  info('  → Si no usas Gemini, puedes ignorar esto');
  info('  → Si usas Gemini, configura la clave en .env.local');
  hasWarnings = true;
} else if (geminiKey === 'tu-gemini-api-key' || geminiKey === 'key_not_set') {
  error('GEMINI_API_KEY tiene un valor de ejemplo. Configura una clave real.');
  hasErrors = true;
} else if (geminiKey.length < 30) {
  error('GEMINI_API_KEY parece inválida (muy corta)');
  hasErrors = true;
} else {
  const sanitized = geminiKey.substring(0, 8) + '...' + geminiKey.substring(geminiKey.length - 4);
  checkmark(`GEMINI_API_KEY configurada: ${sanitized}`);
  info('  → Longitud: ' + geminiKey.length + ' caracteres');
  
  // Advertencia si parece una clave sin restringir
  warning('⚠️  IMPORTANTE: Verifica que tu clave esté RESTRINGIDA en Google Cloud Console');
  info('  → https://console.cloud.google.com/apis/credentials');
  info('  → Restricción de aplicación: HTTP referrers o IP addresses');
  info('  → Restricción de API: Solo "Generative Language API"');
}

// 3. Verificar .gitignore
info('\n3. Verificando .gitignore...');
if (fs.existsSync('.gitignore')) {
  const gitignore = fs.readFileSync('.gitignore', 'utf8');
  
  if (gitignore.includes('.env')) {
    checkmark('.env* está en .gitignore');
  } else {
    error('.env* NO está en .gitignore - ¡PELIGRO DE EXPONER CLAVES!');
    hasErrors = true;
  }
  
  if (gitignore.includes('service-account') || gitignore.includes('*-service-account.json')) {
    checkmark('Service account credentials están protegidas');
  } else {
    warning('Considera agregar *-service-account.json a .gitignore');
    hasWarnings = true;
  }
} else {
  error('.gitignore no existe');
  hasErrors = true;
}

// 4. Buscar claves hardcodeadas (búsqueda básica)
info('\n4. Buscando claves hardcodeadas en el código...');
const searchPaths = ['src', 'lib', 'pages', 'app'];
let foundHardcodedKeys = false;

function searchInFile(filePath) {
  if (!filePath.match(/\.(ts|tsx|js|jsx)$/)) return;
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Patrones sospechosos
    const patterns = [
      /GEMINI_API_KEY\s*=\s*["']AIza[^"']+["']/,
      /apiKey\s*=\s*["']AIza[^"']+["']/,
      /Authorization.*Bearer.*AIza/,
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        error(`⚠️  Posible clave hardcodeada encontrada en: ${filePath}`);
        foundHardcodedKeys = true;
        hasErrors = true;
      }
    }
  } catch (e) {
    // Ignorar archivos que no se pueden leer
  }
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules') {
        walkDir(filePath);
      }
    } else {
      searchInFile(filePath);
    }
  }
}

for (const searchPath of searchPaths) {
  walkDir(searchPath);
}

if (!foundHardcodedKeys) {
  checkmark('No se encontraron claves hardcodeadas en el código');
}

// 5. Verificar que service account no esté en el repo (si existe)
info('\n5. Verificando service accounts...');
const serviceAccountFiles = fs.readdirSync('.').filter(f => 
  f.includes('service-account') && f.endsWith('.json')
);

if (serviceAccountFiles.length > 0) {
  for (const file of serviceAccountFiles) {
    warning(`Archivo de service account encontrado: ${file}`);
    info('  → Asegúrate de que esté en .gitignore');
    info('  → Verifica con: git check-ignore ' + file);
    hasWarnings = true;
  }
} else {
  checkmark('No se encontraron archivos de service account en el directorio raíz');
}

// 6. Verificar configuración de otras APIs
info('\n6. Verificando otras API keys...');
const otherKeys = {
  'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY,
  'GMAIL_CLIENT_SECRET': process.env.GMAIL_CLIENT_SECRET,
  'MERCADOPAGO_ACCESS_TOKEN': process.env.MERCADOPAGO_ACCESS_TOKEN,
};

for (const [name, value] of Object.entries(otherKeys)) {
  if (value) {
    const sanitized = value.substring(0, 8) + '...' + value.substring(value.length - 4);
    checkmark(`${name}: ${sanitized}`);
  }
}

// Resumen final
header('📊 Resumen de Verificación');

if (hasErrors) {
  error('\n❌ Se encontraron ERRORES críticos de seguridad');
  error('   Por favor, corrígelos antes de continuar');
  process.exit(1);
} else if (hasWarnings) {
  warning('\n⚠️  Se encontraron ADVERTENCIAS');
  info('   Revisa las recomendaciones anteriores');
  process.exit(0);
} else {
  checkmark('\n✅ Todas las verificaciones pasaron');
  checkmark('   Tu configuración de API keys parece segura');
  info('\n📌 Recuerda:');
  info('   1. Restringir claves en Google Cloud Console');
  info('   2. Rotar claves periódicamente (cada 3-6 meses)');
  info('   3. Monitorear el uso en Google Cloud Console');
  process.exit(0);
}
