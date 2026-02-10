# 🚀 Guía de Configuración y Prueba - Gmail API

## 📋 Requisitos Previos

✅ Ya tienes las credenciales de Google Cloud en `.env.local` (las mismas que usas para TTS)
✅ El proyecto ya tiene `googleapis` instalado
✅ Ya tienes un proyecto en Google Cloud Console

## 🔧 Configuración (3 pasos)

### Paso 1: Habilitar Gmail API en Google Cloud

1. **Ir a Google Cloud Console**
   ```
   https://console.cloud.google.com/
   ```

2. **Seleccionar tu proyecto**
   - En la parte superior, haz clic en el selector de proyectos
   - Busca el proyecto que usas para TTS (debería ser el mismo de `GOOGLE_APPLICATION_CREDENTIALS_JSON`)

3. **Ir a la biblioteca de APIs**
   ```
   https://console.cloud.google.com/apis/library
   ```

4. **Buscar "Gmail API"**
   - En el buscador, escribe: `Gmail API`
   - Haz clic en "Gmail API"

5. **Habilitar la API**
   - Haz clic en el botón azul **"ENABLE"** (Habilitar)
   - Espera 1-2 minutos para que se propague

### Paso 2: Verificar Service Account

Tu service account ya existe (es el que usas para TTS). Solo necesitas verificar:

1. **Ir a Service Accounts**
   ```
   https://console.cloud.google.com/iam-admin/serviceaccounts
   ```

2. **Encontrar tu service account**
   - Busca el email que aparece en `GOOGLE_APPLICATION_CREDENTIALS_JSON`
   - Ejemplo: `mi-app@mi-proyecto.iam.gserviceaccount.com`

3. **Verificar permisos** (opcional)
   - Haz clic en el service account
   - Ve a la pestaña "PERMISSIONS"
   - Debería tener rol "Service Account Token Creator" o similar

### Paso 3: Configurar Email de Prueba (opcional)

En tu `.env.local`, agrega:

```bash
# Email para recibir la prueba (opcional, por defecto usa el service account email)
TEST_EMAIL=tu-email@gmail.com
```

## 🧪 Pruebas

### Opción 1: Script de Prueba Automático (Recomendado)

```bash
# 1. Instalar dotenv (si no lo tienes)
npm install dotenv

# 2. Ejecutar script de prueba
node scripts/test-gmail.js
```

**Salida esperada:**
```
🧪 Iniciando prueba de Gmail API...

1️⃣ Verificando credenciales...
✅ Credenciales encontradas
   📧 Service Account: mi-app@mi-proyecto.iam.gserviceaccount.com
   🏷️  Project ID: mi-proyecto-123456

2️⃣ Creando cliente de Gmail...
✅ Cliente de Gmail creado

3️⃣ Preparando email de prueba...
   📨 Destinatario: tu-email@gmail.com
✅ Email preparado

4️⃣ Enviando email...
✅ ¡Email enviado exitosamente!
   📬 Message ID: 18d4f7a1b2c3d4e5
   🔗 Thread ID: 18d4f7a1b2c3d4e5

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 ¡PRUEBA EXITOSA!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Opción 2: Prueba desde la API

```bash
# 1. Iniciar el servidor
npm run dev

# 2. En otra terminal, enviar una solicitud de prueba
curl -X POST http://localhost:3000/api/email/welcome \
  -H "Content-Type: application/json" \
  -d '{"email":"tu-email@gmail.com","name":"Cristian"}'
```

**Respuesta esperada:**
```json
{
  "ok": true,
  "messageId": "18d4f7a1b2c3d4e5"
}
```

### Opción 3: Desde el Panel de Admin

1. Iniciar la app: `npm run dev`
2. Ir a: `http://localhost:3000/admin/email`
3. Crear una plantilla de prueba
4. Enviar un email de prueba

## ✅ Verificar que Funciona

1. **Revisa tu bandeja de Gmail**
   - Busca emails de: `tu-service-account@tu-proyecto.iam.gserviceaccount.com`

2. **Si no lo ves, revisa:**
   - 📁 Carpeta SPAM/Correo no deseado
   - 📁 Carpeta Promociones
   - 📁 Carpeta Social

3. **El email de prueba contiene:**
   - ✅ Asunto: "🧪 Prueba de Gmail API - Sant IA Go"
   - ✅ Mensaje HTML con estilos
   - ✅ Confirmación de que la API funciona

## 🐛 Solución de Problemas

### Error: "Gmail API has not been used"

**Causa:** Gmail API no está habilitada

**Solución:**
1. Ve a: https://console.cloud.google.com/apis/library/gmail.googleapis.com
2. Haz clic en "ENABLE"
3. Espera 2 minutos y vuelve a intentar

### Error: "insufficient authentication scopes"

**Causa:** El scope de Gmail no está configurado

**Solución:**
- El código ya incluye el scope correcto: `gmail.send`
- Verifica que las credenciales sean correctas
- Regenera las credenciales en Google Cloud si es necesario

### Error: "Invalid credentials"

**Causa:** Las credenciales en `.env.local` están mal formateadas

**Solución:**
1. Abre `.env.local`
2. Verifica que `GOOGLE_APPLICATION_CREDENTIALS_JSON` esté en una sola línea
3. Verifica que el JSON esté completo (especialmente la private_key)
4. No debe tener comillas extra ni espacios

**Ejemplo correcto:**
```bash
GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account","project_id":"mi-proyecto",...}'
```

### Error: "The caller does not have permission"

**Causa:** El service account no tiene permisos de Gmail

**Solución:**
1. Ve a: https://console.cloud.google.com/iam-admin/serviceaccounts
2. Encuentra tu service account
3. Asegúrate de que Gmail API esté habilitada en el proyecto

### Los emails llegan a SPAM

**Causa:** El dominio del service account no está verificado

**Soluciones:**
1. **Temporal:** Marca el email como "No es spam"
2. **Permanente:** Configura SPF/DKIM en tu dominio (avanzado)
3. **Alternativa:** Usa un dominio personalizado con Google Workspace

## 📊 Monitoreo

### Ver logs en Google Cloud

```
https://console.cloud.google.com/logs
```

Filtra por:
- Resource: `Service Account`
- Log name: `gmail.googleapis.com`

### Ver cuota de Gmail API

```
https://console.cloud.google.com/apis/api/gmail.googleapis.com/quotas
```

**Límites por defecto:**
- 1,000,000,000 cuota units por día
- ~250 emails por día (aproximadamente)

## 🎯 Pruebas Adicionales

### Enviar email de bienvenida personalizado

```bash
curl -X POST http://localhost:3000/api/email/welcome \
  -H "Content-Type: application/json" \
  -d '{"email":"amigo@ejemplo.com","name":"Juan Pérez"}'
```

### Enviar campaña a suscriptores

1. Agrega contactos en la tabla `email_contacts` de Supabase
2. Crea una campaña en `/admin/email`
3. Envía la campaña

## 📝 Checklist de Verificación

Marca cada item cuando lo completes:

- [ ] Gmail API habilitada en Google Cloud Console
- [ ] Service account existe y tiene credenciales
- [ ] Variable `GOOGLE_APPLICATION_CREDENTIALS_JSON` en `.env.local`
- [ ] Script de prueba ejecutado exitosamente
- [ ] Email de prueba recibido (revisa SPAM si es necesario)
- [ ] Endpoint `/api/email/welcome` probado y funcionando
- [ ] Plantillas de email creadas en Supabase
- [ ] Contactos agregados en tabla `email_contacts`

## 🎉 ¡Listo para Producción!

Una vez que todos los tests pasen, tu sistema de emails está listo para:

- ✅ Enviar emails de bienvenida automáticos
- ✅ Enviar campañas de marketing
- ✅ Notificaciones por email a usuarios
- ✅ Emails transaccionales personalizados

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs del servidor: `npm run dev`
2. Ejecuta el script de prueba: `node scripts/test-gmail.js`
3. Revisa la consola de Google Cloud para errores de API
4. Consulta la documentación completa en `README_gmail_api.md`

---

**Última actualización:** 4 de febrero de 2026
