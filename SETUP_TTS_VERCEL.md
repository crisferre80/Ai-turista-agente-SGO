# 🚀 Configuración de TTS en Vercel (Producción)

## ⚠️ Problema Actual

```
POST /api/speech 401 (Unauthorized)
TTS Error: Error: API_KEY_MISSING
```

**Causa:** El archivo `santiguia-service-account.json` no está (ni debe estar) en el repositorio, por lo que Vercel no puede acceder a las credenciales.

**Solución:** Usar **variables de entorno** en Vercel.

---

## 📋 Configuración en Vercel

### Paso 1: Preparar el JSON del Service Account

1. Abre el archivo local `santiguia-service-account.json`
2. **Copia TODO el contenido** del archivo (es un JSON completo)
3. **Minifícalo** (elimina saltos de línea y espacios extra) para que sea una sola línea:

**Puedes usar este comando en PowerShell:**

```powershell
# Minificar el JSON
$json = Get-Content santiguia-service-account.json -Raw | ConvertFrom-Json
$minified = $json | ConvertTo-Json -Compress
$minified | Set-Clipboard
Write-Host "✅ JSON minificado copiado al portapapeles"
```

O simplemente copia el contenido y minifícalo en: https://jsonformatter.org/json-minify

### Paso 2: Agregar Variable de Entorno en Vercel

1. Ve al Dashboard de Vercel: https://vercel.com/dashboard
2. Selecciona tu proyecto: **santiagoguia**
3. Ve a **Settings** → **Environment Variables**
4. Agrega una nueva variable:

   - **Name:** `GOOGLE_SERVICE_ACCOUNT_JSON`
   - **Value:** *(pega el JSON minificado del paso 1)*
   - **Environment:** Marca **Production**, **Preview**, y **Development**

5. Click en **Save**

### Paso 3: Redeploy

Después de agregar la variable de entorno, necesitas hacer redeploy:

**Opción A - Desde Vercel Dashboard:**
1. Ve a **Deployments**
2. Click en los 3 puntos del último deployment
3. Click en **Redeploy**

**Opción B - Desde Git:**
```bash
git add .
git commit -m "fix: Update TTS to use service account from env"
git push
```

---

## 🔍 Verificación

Después del deploy, verifica en los logs de Vercel:

✅ **Éxito:**
```
Google TTS using Service Account from environment variable
Google TTS success, audio size: XXXXX
```

❌ **Error:**
```
Google TTS Service Account not configured
```
→ La variable de entorno no se configuró correctamente

---

## 🏠 Funcionamiento Local vs Producción

El código ahora soporta **ambos entornos**:

| Entorno | Método | Archivo |
|---------|--------|---------|
| **Local (dev)** | Archivo | `santiguia-service-account.json` |
| **Vercel (prod)** | Variable de entorno | `GOOGLE_SERVICE_ACCOUNT_JSON` |

### Prioridad de carga:
1. 🔍 Intenta cargar desde archivo (local)
2. 🌐 Si no existe, usa variable de entorno (producción)
3. ❌ Si ninguno existe, retorna error 401

---

## 🔐 Seguridad

### ✅ Buenas Prácticas

- ✅ El archivo `santiguia-service-account.json` está en `.gitignore`
- ✅ Las credenciales NUNCA se suben al repositorio
- ✅ En producción se usan variables de entorno de Vercel (encriptadas)
- ✅ El JSON se minifica para evitar problemas con saltos de línea

### ⚠️ Importante

**NUNCA** hagas esto:
```bash
# ❌ MAL - No subas las credenciales al repositorio
git add santiguia-service-account.json
```

---

## 🐛 Troubleshooting

### Error: "Invalid JSON in GOOGLE_SERVICE_ACCOUNT_JSON"

**Causa:** El JSON tiene caracteres especiales o saltos de línea problemáticos

**Solución:**
1. Asegúrate de minificar el JSON (sin saltos de línea)
2. Verifica que no haya comillas sin escapar
3. Usa el comando de PowerShell del Paso 1

### Error: "Failed to authenticate with Google Cloud"

**Causa:** El service account no tiene permisos

**Solución:**
1. Ve a [Google Cloud IAM](https://console.cloud.google.com/iam-admin/iam?project=santiguia-mail)
2. Edita el service account: `santiguia@santiguia-mail.iam.gserviceaccount.com`
3. Agrega el rol: **"Cloud Text-to-Speech User"**

### Error: "Cloud Text-to-Speech API has not been used"

**Causa:** La API no está habilitada en el proyecto

**Solución:**
1. Ve a: https://console.cloud.google.com/apis/library/texttospeech.googleapis.com?project=santiguia-mail
2. Click en **"ENABLE"**

---

## 📝 Ejemplo de Variable de Entorno

**Formato esperado (minificado en una sola línea):**

```json
{"type":"service_account","project_id":"santiguia-mail","private_key_id":"0659caa...","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvQIBAD...","client_email":"santiguia@santiguia-mail.iam.gserviceaccount.com","client_id":"112852156758101947769","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/santiguia%40santiguia-mail.iam.gserviceaccount.com"}
```

---

## ✅ Checklist Final

- [ ] JSON del service account minificado
- [ ] Variable `GOOGLE_SERVICE_ACCOUNT_JSON` agregada en Vercel
- [ ] Variable configurada para Production, Preview y Development
- [ ] Proyecto redeployado
- [ ] API Text-to-Speech habilitada en Google Cloud
- [ ] Service account tiene rol "Cloud Text-to-Speech User"
- [ ] Logs de Vercel muestran éxito

---

**Fecha:** 21 de mayo de 2026  
**Archivo modificado:** `src/app/api/speech/route.ts`
