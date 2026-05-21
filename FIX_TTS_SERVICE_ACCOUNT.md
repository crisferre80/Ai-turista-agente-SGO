# ✅ Solución: Error 403 TTS (API_KEY_HTTP_REFERRER_BLOCKED)

## 🎯 Problema Resuelto

**Error Original:**
```
API_KEY_HTTP_REFERRER_BLOCKED
Requests from referer <empty> are blocked
```

**Causa:** La API key de Google TTS tenía restricciones de HTTP referrer configuradas, pero las peticiones server-to-server no envían referrer.

**Solución:** Migración a **Service Account** con autenticación OAuth2.

---

## 🔧 Cambios Implementados

### 1. Modificación de `/src/app/api/speech/route.ts`

✅ **Antes:** Usaba API key como query parameter
```typescript
const apiUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
```

✅ **Ahora:** Usa Service Account con SDK oficial de Google
```typescript
const auth = new google.auth.GoogleAuth({
    keyFile: 'santiguia-service-account.json',
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});
```

### 2. Beneficios de Service Account

- ✅ Sin restricciones de HTTP referrer
- ✅ Autenticación OAuth2 automática
- ✅ Más seguro (no expone API keys)
- ✅ Mejor para backend server-to-server
- ✅ Control granular de permisos IAM

---

## 🚀 Pasos para Habilitar la API

### 1. Verificar que el Service Account tenga habilitada Text-to-Speech API

```bash
# Opción A: Desde Google Cloud Console
1. Ve a https://console.cloud.google.com
2. Selecciona el proyecto: santiguia-mail
3. Ve a "APIs & Services" → "Enabled APIs & services"
4. Busca "Cloud Text-to-Speech API"
5. Si no está habilitada, habilítala desde:
   https://console.cloud.google.com/apis/library/texttospeech.googleapis.com
```

### 2. Otorgar Permisos al Service Account

El service account necesita el rol: **Cloud Text-to-Speech User**

```bash
# Opción B: Desde Cloud Shell o terminal con gcloud CLI
gcloud projects add-iam-policy-binding santiguia-mail \
  --member="serviceAccount:santiguia@santiguia-mail.iam.gserviceaccount.com" \
  --role="roles/cloudtexttospeech.user"
```

**O desde la consola:**
1. Ve a **IAM & Admin** → **IAM**
2. Busca `santiguia@santiguia-mail.iam.gserviceaccount.com`
3. Click en editar (lápiz)
4. "Add Another Role" → Busca "Cloud Text-to-Speech User"
5. Guarda

---

## 📋 Verificación

### Paso 1: Reinicia el servidor

```bash
npm run dev
```

### Paso 2: Prueba el TTS desde la app

1. Abre la aplicación
2. Intenta usar el chat con audio habilitado
3. Verifica en la consola del servidor:

```
✅ Éxito:
Google TTS using Service Account: /path/to/santiguia-service-account.json
Google TTS success, audio size: XXXXX

❌ Error común:
Google TTS SDK error: Cloud Text-to-Speech API has not been used...
→ Necesitas habilitar la API (ver paso 1 arriba)
```

---

## 🔐 Seguridad

### Archivo de Credenciales

⚠️ **Importante:** El archivo `santiguia-service-account.json` contiene credenciales sensibles:

```bash
# Ya está en .gitignore (verifica):
cat .gitignore | grep -i "service-account"

# Si no está, agrégalo:
echo "santiguia-service-account.json" >> .gitignore
```

### Variables de Entorno (Alternativa)

Si prefieres usar variables de entorno en vez de archivo:

```bash
# .env.local
GOOGLE_APPLICATION_CREDENTIALS="./santiguia-service-account.json"
```

---

## 📊 Comparación: API Key vs Service Account

| Aspecto | API Key (Antes) | Service Account (Ahora) |
|---------|----------------|------------------------|
| **Seguridad** | ❌ Expuesta en URL | ✅ OAuth2 tokens |
| **HTTP Referrer** | ❌ Requiere configuración | ✅ No necesario |
| **Server-to-Server** | ⚠️ Limitado | ✅ Diseñado para esto |
| **Permisos** | ❌ Amplios | ✅ Granulares (IAM) |
| **Rotación** | ❌ Manual | ✅ Automática |

---

## 🐛 Troubleshooting

### Error: "Service Account file not found"

```bash
# Verifica que el archivo existe:
ls -la santiguia-service-account.json

# Si no existe, descárgalo desde:
# Google Cloud Console → IAM & Admin → Service Accounts → 
# santiguia@santiguia-mail.iam.gserviceaccount.com → Keys → Add Key
```

### Error: "Permission denied"

```bash
# Verifica los permisos del service account:
gcloud projects get-iam-policy santiguia-mail \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:santiguia@santiguia-mail.iam.gserviceaccount.com"
```

### Error: "API not enabled"

```bash
# Habilita la API via CLI:
gcloud services enable texttospeech.googleapis.com --project=santiguia-mail
```

---

## 📝 Notas Adicionales

- El proyecto ya tiene `googleapis` instalado en `package.json`
- El service account `santiguia@santiguia-mail.iam.gserviceaccount.com` ya existe
- Solo necesitas habilitar la API y otorgar permisos

---

## ✅ Checklist

- [ ] API Text-to-Speech habilitada en el proyecto `santiguia-mail`
- [ ] Service account tiene rol `roles/cloudtexttospeech.user`
- [ ] Archivo `santiguia-service-account.json` existe en la raíz del proyecto
- [ ] Archivo está en `.gitignore`
- [ ] Servidor reiniciado con `npm run dev`
- [ ] Prueba realizada desde la app
- [ ] Audio se reproduce correctamente sin error 403

---

**Fecha de implementación:** 21 de mayo de 2026  
**Archivo modificado:** `src/app/api/speech/route.ts`
