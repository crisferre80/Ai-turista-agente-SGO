# 🚀 Guía Rápida de Configuración y Prueba

## ⚡ Inicio Rápido (5 minutos)

### Paso 1: Habilitar Gmail API

1. Ve a: **https://console.cloud.google.com/apis/library/gmail.googleapis.com**
2. Selecciona tu proyecto (el mismo que usas para TTS)
3. Haz clic en **"ENABLE"** (botón azul)
4. Espera 1-2 minutos ⏱️

### Paso 2: Instalar dependencia

```bash
npm install dotenv
```

### Paso 3: Ejecutar prueba

```bash
node scripts/test-gmail.js
```

### Paso 4: Revisar tu email

Busca un email de: `tu-service-account@tu-proyecto.iam.gserviceaccount.com`

⚠️ **Si no lo ves, revisa SPAM**

---

## 🧪 Salida esperada del script

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

🎉 ¡PRUEBA EXITOSA!
```

---

## 🐛 Errores comunes

### "Gmail API has not been used"
👉 Ve al paso 1 y habilita la API. Espera 2 minutos.

### "GOOGLE_APPLICATION_CREDENTIALS_JSON no está configurado"
👉 Verifica que esté en `.env.local` (las mismas credenciales de TTS)

### "Invalid credentials"
👉 Verifica que el JSON en `.env.local` esté completo y en una sola línea

---

## 🎯 Probar desde la aplicación

```bash
# 1. Iniciar el servidor
npm run dev

# 2. Abrir en el navegador
http://localhost:3000/admin/email

# 3. O usar curl
curl -X POST http://localhost:3000/api/email/welcome \
  -H "Content-Type: application/json" \
  -d '{"email":"tu-email@gmail.com","name":"Test"}'
```

---

## ✅ Si todo funciona

¡Ya puedes usar Gmail API en tu aplicación! 🎉

- Emails de bienvenida automáticos
- Campañas de marketing
- Notificaciones por email

Para más detalles, ver: **SETUP_gmail.md**
