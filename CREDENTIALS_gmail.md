# 🔑 Cómo Obtener las Credenciales de Service Account para Gmail

## 🎯 Lo que necesitas

Para usar Gmail API necesitas un **Service Account** de Google Cloud con sus credenciales JSON completas.

> ⚠️ **Nota:** Una API Key sola NO es suficiente para Gmail API. Necesitas un Service Account.

---

## 📝 Pasos para Crear Service Account

### 1. Ir a Google Cloud Console

Ve a: https://console.cloud.google.com/

### 2. Seleccionar o Crear un Proyecto

- Si ya tienes un proyecto para tu app, selecciónalo
- Si no, crea uno nuevo:
  - Clic en el selector de proyectos (arriba)
  - "New Project"
  - Nombre: "Tourist Assistant" (o el que prefieras)
  - Clic en "Create"

### 3. Habilitar las APIs Necesarias

Ve a: https://console.cloud.google.com/apis/library

Busca y habilita:
- ✅ **Gmail API** (para enviar emails)
- ✅ **Cloud Text-to-Speech API** (ya debería estar habilitada)

### 4. Crear Service Account

1. Ve a: https://console.cloud.google.com/iam-admin/serviceaccounts

2. Clic en **"+ CREATE SERVICE ACCOUNT"**

3. Llenar el formulario:
   - **Service account name:** `tourist-assistant-mailer`
   - **Service account ID:** (se genera automático)
   - **Description:** `Service account para enviar emails con Gmail API`
   - Clic en **"CREATE AND CONTINUE"**

4. **Grant access** (Opcional, puedes saltar este paso):
   - Clic en "CONTINUE"

5. **Grant users access** (Opcional):
   - Clic en "DONE"

### 5. Crear y Descargar las Credenciales

1. En la lista de service accounts, **clic en el que acabas de crear**

2. Ve a la pestaña **"KEYS"**

3. Clic en **"ADD KEY"** → **"Create new key"**

4. Selecciona **JSON**

5. Clic en **"CREATE"**

6. Se descargará un archivo JSON (ej: `tourist-assistant-mailer-abc123.json`)

### 6. Agregar las Credenciales a tu Proyecto

1. **Abre el archivo JSON descargado** con un editor de texto

2. **Copia TODO el contenido** (debe verse así):
   ```json
   {
     "type": "service_account",
     "project_id": "tu-proyecto-123456",
     "private_key_id": "abc123...",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "tourist-assistant-mailer@tu-proyecto.iam.gserviceaccount.com",
     "client_id": "123456789",
     "auth_uri": "https://accounts.google.com/o/oauth2/auth",
     "token_uri": "https://oauth2.googleapis.com/token",
     ...
   }
   ```

3. **Abre tu archivo `.env.local`**

4. **Agrega esta línea** (todo en UNA sola línea):
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account","project_id":"tu-proyecto",...}'
   ```

   ⚠️ **IMPORTANTE:**
   - Todo el JSON debe estar en UNA SOLA LÍNEA
   - Envuelto en comillas simples `'...'`
   - NO debe tener saltos de línea dentro del JSON

### 7. Ejemplo de cómo debe quedar en .env.local

```bash
# ... otras variables ...

GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account","project_id":"tourist-assistant-123","private_key_id":"abc123def456","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkq...\n-----END PRIVATE KEY-----\n","client_email":"tourist-assistant-mailer@tourist-assistant-123.iam.gserviceaccount.com","client_id":"123456789","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/..."}'
```

---

## ✅ Verificar que Funciona

Después de agregar la variable:

1. **Reinicia tu servidor** (si está corriendo):
   ```bash
   # Ctrl+C para detener
   npm run dev
   ```

2. **Ejecuta el script de prueba**:
   ```bash
   node scripts/test-gmail.js
   ```

3. **Deberías ver**:
   ```
   ✅ Credenciales encontradas
   ✅ Cliente de Gmail creado
   ✅ ¡Email enviado exitosamente!
   ```

---

## 🛠️ Herramienta para Formatear el JSON (opcional)

Si tienes problemas formateando el JSON en una línea, puedes usar este comando de Node.js:

```bash
node -e "console.log(JSON.stringify(require('./ruta-al-archivo.json')))"
```

O usar un formateador online:
- https://www.freeformatter.com/json-formatter.html
- Pegar tu JSON
- Seleccionar "Compact" o "Minify"
- Copiar el resultado

---

## 🔐 Seguridad

⚠️ **NUNCA** subas el archivo JSON o el contenido de `.env.local` a Git

Ya tienes en `.gitignore`:
```
.env.local
*.json (service account keys)
```

---

## 📞 ¿Problemas?

### "Gmail API has not been used"
→ Ve al paso 3 y habilita Gmail API

### "Invalid credentials"
→ Verifica que el JSON esté completo y en una sola línea

### "Permission denied"
→ El service account necesita los permisos correctos. Gmail API debe estar habilitada.

---

## 🎉 Próximos Pasos

Una vez que tengas las credenciales configuradas:

1. Ejecuta: `node scripts/test-gmail.js`
2. Revisa tu email
3. ¡Listo para usar Gmail API en tu app! 🚀

---

**Tiempo estimado:** 10-15 minutos

**¿Necesitas ayuda?** Revisa `SETUP_gmail.md` para más detalles.
