# 🔧 Solución de problemas: TTS Voice Selector - "0 voces disponibles"

## ❌ Problema
Cuando haces clic en un idioma (Español, Inglés, etc.), aparece el mensaje:
```
⚠️ No hay voces disponibles para [IDIOMA] en género [MASCULINO/FEMENINO]
```

## ✅ Solución paso a paso

### 1. **Verifica que tengas una API Key de Google Cloud TTS**

#### Opción A: Usar API Key en el Panel Admin (LOCAL)
- Ve a **"Configuración de IA y TTS"** en el panel admin
- En la sección **"Clave API de Google Cloud TTS"**:
  - Si ya tienes una clave, pégala en el campo de texto
  - Si no tienes una, obtén una en: https://console.cloud.google.com
- **Importante**: Haz clic en **"Guardar"** para guardar la clave
- Deberías ver un mensaje verde: ✓ API Key detectada

#### Opción B: Usar API Key del Servidor (.env)
- Si prefieres guardarla en tu servidor, agrega a `.env.local`:
  ```
  GOOGLE_TTS_API_KEY=tu_clave_aqui
  ```
- Reinicia el servidor
- No necesitas ingresar la clave en el panel

### 2. **Habilita la API de Text-to-Speech en Google Cloud**

1. Ve a https://console.cloud.google.com
2. Busca "Cloud Text-to-Speech API"
3. Haz clic en él y selecciona **"Enable"** (Habilitar)
4. Espera unos segundos a que se active

### 3. **Verifica los permisos de tu API Key**

La API Key debe tener permisos para:
- ✓ Cloud Text-to-Speech API
- ✓ Acceso desde aplicaciones web (restricción: ninguna)

Para verificar/cambiar:
1. Ve a https://console.cloud.google.com/apis/credentials
2. Busca tu API Key
3. Haz clic en ella
4. Asegúrate de que **Cloud Text-to-Speech API** esté en la lista de "API restrictions"

### 4. **Verifica en la Consola del Navegador**

Para ver logs detallados:
1. Abre el navegador (Chrome/Firefox/Edge)
2. Presiona **F12** para abrir Developer Tools
3. Ve a la pestaña **"Console"**
4. Haz clic en un idioma en la sección de voces
5. Deberías ver logs como:

```
📡 Enviando API key (39 chars)
🔍 Buscando voces: /api/admin/tts/voices?provider=google&gender=MALE&lang=es

Response: {
  status: 200,
  voicesCount: 5,
  filterApplied: { gender: "MALE", lang: "es" },
  ...
}
```

### 5. **Si ves error de API Key**

Si en la consola ves:
```
❌ Error: "API key may not have Text-to-Speech API enabled"
```

**Solución:**
1. Ve a https://console.cloud.google.com/apis/library
2. Busca "Cloud Text-to-Speech API"
3. Haz clic en **Enable**
4. Espera 1-2 minutos
5. Intenta de nuevo

### 6. **Si ves "0 voces disponibles" pero sin errores**

Si los logs muestran:
```
voicesCount: 0,
filteredAvailable: 0
```

**Posibles causas:**
1. Las voces no están siendo filtradas correctamente por idioma
2. El filtro de género es muy restrictivo

**Solución:**
1. Haz clic en **"Listar voces (Google)"** arriba (sin filtro de género)
2. Esto mostrará TODAS las voces de Google disponibles
3. Identifica una voz y cópiala manualmente en el campo de texto
4. O intenta cambiar el género de Masculino a Femenino y viceversa

### 7. **Reinicia todo**

Si nada funciona:
1. Cierra el navegador completamente
2. Presiona `Ctrl + Shift + Supr` para limpiar cache
3. Reinicia el servidor Next.js:
   ```bash
   npm run dev
   ```
4. Abre http://localhost:3000 en una pestaña nueva
5. Intenta de nuevo

## 📝 Información del Sistema

**Voces soportadas por idioma:**

| Idioma | Códigos* |
|--------|----------|
| 🇪🇸 Español | es-ES, es-419, es-AR, es-MX, es-CO, ... |
| 🇬🇧 Inglés | en-US, en-GB, en-AU, en-IN, en-CA |
| 🇧🇷 Portugués | pt-BR, pt-PT |
| 🇫🇷 Francés | fr-FR, fr-CA |

*Nota: La API de Google tiene docenas de variantes de idiomas

## 🚀 Flujo esperado una vez funcionando

1. Selecciona **Género** (Masculino/Femenino)
2. Haz clic en un **Idioma** (Español/English/etc)
3. Se cargan las voces disponibles (5-10 voces por idioma)
4. Haz clic en una voz para seleccionarla (se resalta en verde)
5. Repite para otros idiomas
6. Haz clic en **"Guardar"** al final
7. Las voces se guardan en `app_settings`

## 💡 Tips

- **Género Masculino**: Ideal para Santi (tu avatar masculino) – recomendado
- **Género Femenino**: Para voces de staff / personajes femeninos
- **Idiomas**: Puedes tener diferentes voces para Español, Inglés, Portugués y Francés
- **Nombres de voces**: Son como `es-ES-Standard-A`, `en-US-Standard-B`, etc.

## ❓ ¿Aún no funciona?

1. Revisa los logs del servidor:
   ```bash
   # En la terminal donde corre Next.js
   npm run dev
   ```
   Busca líneas que contengan "Google TTS" o errores

2. Verifica el endpoint directamente en el navegador:
   ```
   https://tu-app.com/api/admin/tts/voices?provider=google&gender=MALE&lang=es
   ```
   (Debe retornar un JSON con voces)

3. Abre un issue en el repositorio con los logs de consola
