# 📧 Configuración de Gmail API

## ✅ Cambio de OneSignal a Gmail API

Se ha reemplazado completamente la implementación de OneSignal con Gmail API de Google Cloud para envío de emails.

## 🔧 Configuración

### 1. Variables de Entorno

La aplicación ya utiliza las credenciales de Google Cloud para Text-to-Speech (TTS). **Las mismas credenciales se usan para Gmail API**.

Asegúrate de tener en tu `.env.local`:

```bash
GOOGLE_APPLICATION_CREDENTIALS_JSON='{
  "type": "service_account",
  "project_id": "tu-proyecto",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "tu-service-account@tu-proyecto.iam.gserviceaccount.com",
  ...
}'
```

### 2. Habilitar Gmail API en Google Cloud

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto (el mismo que usas para TTS)
3. Ve a **APIs & Services** > **Library**
4. Busca "Gmail API" y haz clic en **Enable**
5. Listo! Ya puedes usar las mismas credenciales

### 3. Permisos del Service Account

Asegúrate de que tu service account tenga el scope:
- `https://www.googleapis.com/auth/gmail.send`

Esto se configura automáticamente en el código cuando se usa `GoogleAuth`.

## 📂 Archivos Modificados

### Nuevos archivos:
- ✅ `src/lib/gmail.ts` - Servicio de Gmail API

### Archivos actualizados:
- ✅ `src/app/api/email/welcome/route.ts` - Reemplazado OneSignal con Gmail
- ✅ `src/app/api/admin/email/send/route.ts` - Reemplazado OneSignal con Gmail
- ✅ `src/app/api/admin/email/campaigns/route.ts` - Reemplazado OneSignal con Gmail
- ✅ `src/app/layout.tsx` - Eliminado componente OneSignalConsent
- ✅ `src/email/EmailManager.tsx` - Actualizado texto de referencia

### Archivos eliminados:
- ❌ `src/components/OneSignalConsent.tsx`
- ❌ `public/OneSignalSDKWorker.js`
- ❌ `public/OneSignalSDKUpdaterWorker.js`
- ❌ `scripts/test-onesignal.js`
- ❌ `src/app/api/admin/email/onesignal-test/`

## 🚀 Funciones Disponibles

### `sendEmail(options)`
Envía un email usando Gmail API.

```typescript
import { sendEmail } from '@/lib/gmail';

const result = await sendEmail({
  to: 'usuario@ejemplo.com',
  subject: 'Hola!',
  html: '<h1>Bienvenido</h1>',
  from: 'noreply@tu-dominio.com' // Opcional
});

if (result.success) {
  console.log('Email enviado:', result.messageId);
} else {
  console.error('Error:', result.error);
}
```

### `sendWelcomeEmail(to, name)`
Envía un email de bienvenida personalizado.

```typescript
import { sendWelcomeEmail } from '@/lib/gmail';

const result = await sendWelcomeEmail(
  'usuario@ejemplo.com',
  'Juan Pérez'
);
```

### `sendTemplateEmail(to, subject, html)`
Envía un email basado en una plantilla HTML.

```typescript
import { sendTemplateEmail } from '@/lib/gmail';

const result = await sendTemplateEmail(
  'usuario@ejemplo.com',
  'Promoción especial',
  '<div>HTML del email...</div>'
);
```

## 📊 Endpoints de API

### POST `/api/email/welcome`
Envía email de bienvenida al registrarse.

```json
{
  "email": "usuario@ejemplo.com",
  "name": "Juan Pérez"
}
```

### POST `/api/admin/email/send`
Envía una campaña de email a todos los suscriptores.

```json
{
  "campaign_id": "uuid-de-la-campaña"
}
```

### POST `/api/admin/email/campaigns`
Crea una nueva campaña y opcionalmente la envía.

```json
{
  "name": "Campaña de verano",
  "template_id": "uuid-del-template",
  "sendNow": true
}
```

## 🔐 Seguridad

- ✅ Las credenciales se almacenan de forma segura en variables de entorno
- ✅ Se usa el mismo service account que para TTS (ya configurado)
- ✅ Solo se envían emails a contactos suscritos en la base de datos
- ✅ Todos los endpoints requieren autenticación de admin

## 🎯 Ventajas sobre OneSignal

1. **Sin dependencias externas**: No requiere SDK de terceros
2. **Mismo proveedor**: Usa la misma cuenta de Google Cloud que TTS
3. **Más control**: Control total sobre el envío y formato de emails
4. **Sin límites**: No hay restricciones de plan gratuito de OneSignal
5. **Más seguro**: No expone App IDs públicos en el frontend

## 📝 Notas

- Los emails se envían desde la cuenta de service account de Google
- Para envíos masivos, considera implementar rate limiting
- Gmail API tiene límites de cuota diarios (consultar Google Cloud Console)
- Los emails se envían uno por uno en campañas (puede ser lento para muchos destinatarios)

## 🐛 Troubleshooting

### Error: "GOOGLE_APPLICATION_CREDENTIALS_JSON no está configurado"
- Verifica que la variable de entorno esté en `.env.local`
- Asegúrate de que el JSON esté correctamente escapado

### Error: "Gmail API not enabled"
- Ve a Google Cloud Console y habilita Gmail API
- Espera unos minutos para que se propague

### Error: "Permission denied"
- Verifica que el service account tenga permisos de Gmail
- Revisa que el scope `gmail.send` esté configurado

## 🔄 Migración desde OneSignal

Si tenías configuración de OneSignal, puedes remover estas variables de `.env.local`:
- `NEXT_PUBLIC_ONESIGNAL_APP_ID`
- `ONESIGNAL_REST_KEY`
- `NEXT_PUBLIC_ONESIGNAL_ENABLE_IN_DEV`

Ya no son necesarias! 🎉
