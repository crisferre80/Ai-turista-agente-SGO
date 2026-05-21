# 🔐 Seguridad de API Keys - Guía de Mejores Prácticas

## ⚠️ Problema Actual
Google Cloud ha detectado que tienes API keys sin restricciones para Gemini API, lo cual representa un riesgo de seguridad y puede generar costos no autorizados.

## ✅ Cambios Implementados en el Código

### 1. Validación Mejorada de API Keys
- **Archivo**: `src/lib/gemini.ts`
- Validación del formato de la clave antes de usar
- Detección de claves de ejemplo o placeholders
- Mensajes de error claros y específicos

### 2. Sanitización de Logs
- Las claves API nunca se muestran completas en logs
- Solo se muestran los primeros 8 y últimos 4 caracteres
- Ejemplo: `AIzaSyAB...xyz9`

### 3. Verificación en Endpoints API
- **Archivo**: `src/app/api/admin/gemini/models/route.ts`
- Validación antes de hacer requests a Google API
- Fallback a modelos predeterminados si la clave no está configurada

### 4. Documentación Mejorada
- **Archivo**: `.env.local.example`
- Instrucciones claras sobre cómo restringir las claves
- Enlaces a documentación oficial

## 🛡️ Pasos de Seguridad que Debes Completar en Google Cloud Console

### Paso 1: Acceder a Credentials
1. Ve a: https://console.cloud.google.com/apis/credentials
2. Selecciona tu proyecto
3. Busca las claves API relacionadas con `generativelanguage.googleapis.com`

### Paso 2: Restringir Aplicación
Elige UNA de estas opciones según tu caso:

#### Opción A: Restricción por HTTP Referrers (Recomendado para Web)
```
https://tu-dominio.com/*
https://tu-dominio.vercel.app/*
http://localhost:3000/*
```

#### Opción B: Restricción por Direcciones IP (Recomendado para Servidores)
```
Tu_IP_Servidor
203.0.113.0/24  (ejemplo de rango)
```

#### Opción C: Aplicaciones Android
```
Nombre del paquete: com.tuempresa.tuapp
SHA-1: (tu certificado SHA-1)
```

### Paso 3: Restringir APIs (MUY IMPORTANTE)
1. En "API restrictions", selecciona "Restrict key"
2. Marca SOLO estas APIs:
   - ✅ **Generative Language API** (para Gemini)
   - ⚠️ NO marques otras APIs innecesarias

### Paso 4: Guardar Cambios
- Haz clic en "Save"
- Espera 5 minutos para que los cambios se propaguen
- Prueba tu aplicación para verificar que funciona

## 🔄 Alternativa Más Segura: Service Accounts (Producción)

Para entornos de producción, considera usar Service Accounts en lugar de API Keys:

### Ventajas
- ✅ Credenciales con tiempo de expiración
- ✅ Permisos granulares (IAM)
- ✅ Mejor auditoría y rastreo
- ✅ Puede revocarse sin cambiar código

### Implementación
```typescript
// Ejemplo con Service Account (NO implementado aún)
import { GoogleAuth } from 'google-auth-library';

const auth = new GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/generative-language']
});

const client = await auth.getClient();
```

## 📋 Checklist de Seguridad

### En Google Cloud Console
- [ ] API Keys restringidas por aplicación (HTTP referrers, IP, o App)
- [ ] API Keys restringidas solo a "Generative Language API"
- [ ] Rotación periódica de claves (cada 3-6 meses)
- [ ] Monitoreo de uso en Google Cloud Console
- [ ] Alertas de facturación configuradas

### En el Código
- [x] Variables de entorno para todas las claves
- [x] `.env*` incluido en `.gitignore`
- [x] Validación de formato de claves
- [x] Sanitización de logs
- [x] Manejo de errores sin exponer información sensible
- [x] Documentación en `.env.local.example`

### En el Repositorio
- [ ] Verificar que no hay claves en el historial de Git
- [ ] Si hay claves expuestas, rotarlas inmediatamente
- [ ] Usar `git-secrets` o `gitleaks` para prevención

## 🚨 Si Tu Clave Fue Expuesta

### Acciones Inmediatas
1. **Revoca la clave** en Google Cloud Console inmediatamente
2. **Genera una nueva clave** con las restricciones apropiadas
3. **Actualiza** tu archivo `.env.local` con la nueva clave
4. **Verifica** el uso en Google Cloud para detectar uso no autorizado
5. **Configura alertas** de facturación para prevenir cargos inesperados

### Verificar Exposición en Git
```bash
# Buscar claves en el historial de Git
git log -p | grep -i "AIza"

# Si encuentras algo, considera limpiar el historial con git-filter-branch
# o BFG Repo-Cleaner (https://rtyley.github.io/bfg-repo-cleaner/)
```

## 📚 Recursos Adicionales

- [Google AI Studio - API Keys](https://aistudio.google.com/app/apikey)
- [Google Cloud - Restricting API Keys](https://cloud.google.com/docs/authentication/api-keys)
- [Best Practices for API Keys](https://cloud.google.com/docs/authentication/best-practices-api-keys)
- [Gemini API Documentation](https://ai.google.dev/docs)

## 🔍 Monitoreo Continuo

### En Google Cloud Console
1. Ve a: https://console.cloud.google.com/apis/credentials
2. Verifica regularmente la sección "API key usage"
3. Configura alertas de cuotas y facturación

### En tu Aplicación
```typescript
// Los logs ahora muestran claves sanitizadas
[GEMINI] ✓ API key configurada: AIzaSyAB...xyz9
```

## ⚡ Próximos Pasos Recomendados

1. **Corto Plazo** (Hoy):
   - ✅ Código actualizado con validaciones
   - ⏳ Restringir claves en Google Cloud Console (TÚ)
   - ⏳ Verificar que la app sigue funcionando después

2. **Mediano Plazo** (Esta semana):
   - Configurar alertas de facturación
   - Documentar las restricciones aplicadas
   - Revisar otros servicios de Google Cloud

3. **Largo Plazo** (Próximo mes):
   - Evaluar migración a Service Accounts para producción
   - Implementar rotación automática de claves
   - Configurar monitoreo avanzado con Cloud Monitoring

---

**Última actualización**: Mayo 2026  
**Responsable**: Desarrollo  
**Revisión**: Cada 3 meses
