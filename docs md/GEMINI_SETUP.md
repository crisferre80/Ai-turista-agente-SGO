# Configuración de Google Gemini AI

Este proyecto ahora utiliza **Google Gemini AI** como alternativa a OpenAI para las funcionalidades de chat y generación de contenido.

## ¿Por qué Gemini?

- ✅ **Gratuito**: Tier gratuito generoso con 60 solicitudes por minuto
- ✅ **Rápido**: Modelo `gemini-2.0-flash-exp` es muy veloz
- ✅ **Multilingüe**: Excelente soporte para español
- ✅ **Sin tarjeta de crédito**: No requiere información de pago para empezar

## Cómo obtener tu API Key de Gemini

1. **Ve a Google AI Studio**
   - Visita: https://aistudio.google.com/

2. **Inicia sesión**
   - Usa tu cuenta de Google

3. **Obtén tu API Key**
   - Haz clic en "Get API Key" en la esquina superior derecha
   - Crea un nuevo proyecto si es necesario
   - Copia la API Key generada

4. **Configura tu proyecto**
   - Crea un archivo `.env.local` en la raíz del proyecto (si no existe)
   - Agrega tu API key:
   ```
   GEMINI_API_KEY=tu_api_key_aqui
   ```

## Instalación

Asegúrate de instalar las dependencias:

```bash
npm install
```

Esto instalará automáticamente `@google/generative-ai` que es la librería oficial de Google para usar Gemini.

## Uso

El proyecto está configurado para usar Gemini en:

- **Chat conversacional** (`/api/chat`) - Responde preguntas sobre turismo
- **Contexto de ubicación** (`/api/location-context`) - Describe lugares basándose en coordenadas

## Límites del Tier Gratuito

- **60 solicitudes por minuto**
- **1,500 solicitudes por día**
- **1 millón de tokens por mes**

Esto es más que suficiente para desarrollo y aplicaciones pequeñas/medianas.

## Migración desde OpenAI

Si estabas usando OpenAI anteriormente:

1. La variable `OPENAI_API_KEY` ya no es necesaria (pero puedes mantenerla por compatibilidad)
2. Todos los endpoints ahora usan Gemini automáticamente
3. El formato de respuesta es idéntico, no necesitas cambiar el código del frontend

## Modelos Disponibles

El proyecto usa `gemini-2.0-flash-exp` por defecto, que es:
- Rápido
- Eficiente
- Gratuito
- Multimodal (texto, imágenes, audio)

Puedes cambiar el modelo en `src/lib/gemini.ts` si lo deseas.

## Solución de Problemas

**Error: "Invalid API Key"**
- Verifica que copiaste la API key correctamente
- Asegúrate de que el archivo `.env.local` esté en la raíz del proyecto
- Reinicia el servidor de desarrollo después de agregar la variable

**Error: "Quota exceeded"**
- Has alcanzado el límite de solicitudes gratuitas
- Espera unos minutos o hasta el siguiente día
- Considera actualizar a un plan de pago si necesitas más capacidad

## Recursos

- [Documentación de Gemini](https://ai.google.dev/docs)
- [Ejemplos de código](https://ai.google.dev/tutorials)
- [Precios y límites](https://ai.google.dev/pricing)
