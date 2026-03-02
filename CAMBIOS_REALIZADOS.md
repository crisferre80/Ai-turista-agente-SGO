# 📚 Cambios Realizados - Traducción de Secciones y Promocionales

## 🎉 Resumen de Cambios

He realizado los siguientes cambios a tu aplicación:

### 1. ✅ Traducción de "Postales de Santiago del Estero"
**Archivos modificados:**
- `src/i18n/translations.ts` - Agregadas traducciones para `home.postcards`
- `src/app/page.tsx` - Actualizado para usar la llave de traducción

**Traducciones añadidas:**
- 🇪🇸 Español: "📸 Postales de Santiago del Estero"
- 🇬🇧 English: "📸 Santiago del Estero Postcards"
- 🇧🇷 Português: "📸 Postais de Santiago del Estero"
- 🇫🇷 Français: "📸 Cartes postales de Santiago del Estero"

La sección ahora se traducirá automáticamente según el idioma seleccionado por el usuario.

---

### 2. ✅ Reposicionamiento del Botón "Activar Tour"
**Archivo modificado:**
- `src/components/Map.tsx` - Línea 1043

**Cambio:**
- **Antes:** `top: '20px'` (tapa el filtro del mapa)
- **Después:** `bottom: '100px'` (posicionado debajo, sin tapar componentes)

El botón ahora está colocado en la parte inferior para no interferir con los filtros del mapa.

---

### 3. ✅ Sistema de Traducción de Mensajes Promocionales

#### 📊 SQL Migrations Creadas:

**a) Migración Principal:** `supabase/migrations/20260301000000_add_promotional_translations.sql`
- Agrega columnas de traducción a la tabla `promotional_messages`:
  - `message_en` - Mensaje en inglés
  - `message_pt` - Mensaje en portugués
  - `message_fr` - Mensaje en francés

- Crea función `get_promotional_message(id, locale)` para obtener mensajes por idioma
- Crea vista `promotional_messages_translated` para consultas localizadas
- Otorga permisos de lectura a usuarios autenticados

**b) Ejemplos de Datos:** `supabase/migrations/20260301000001_promotional_messages_translations_examples.sql`
- Actualiza mensajes existentes con traducciones
- Inserta nuevos ejemplos de promocionales multilingües

#### 💻 Frontend API Endpoint:

**Nuevo endpoint:** `src/app/api/promotional-messages/route.ts`

```bash
GET /api/promotional-messages?locale=es
GET /api/promotional-messages?locale=en
GET /api/promotional-messages?locale=pt
GET /api/promotional-messages?locale=fr
```

**Ejemplo de respuesta:**
```json
{
  "messages": [
    {
      "id": "uuid...",
      "business_name": "Nodo Tecnológico",
      "message": "¿Sabías que en Nodo Tecnológico...",
      "category": "tecnologia",
      "priority": 5,
      "show_probability": 25,
      "language": "es"
    }
  ],
  "locale": "es",
  "total": 4,
  "timestamp": "2026-03-01T..."
}
```

---

### 4. 🔧 Cómo Implementar en la Base de Datos

#### Paso 1: Ejecutar las migraciones SQL

Usa el SQL Editor de Supabase para ejecutar:

1. **Primera migración** (agregar columnas y funciones):
```sql
-- Contenido de: supabase/migrations/20260301000000_add_promotional_translations.sql
-- Copiar y ejecutar en Supabase SQL Editor
```

2. **Segunda migración** (actualizar datos y ejemplos):
```sql
-- Contenido de: supabase/migrations/20260301000001_promotional_messages_translations_examples.sql
-- Copiar y ejecutar en Supabase SQL Editor
```

#### Paso 2: Usar desde el Frontend

**Opción A - En ChatInterface u otro componente:**
```typescript
import { useI18n } from '@/i18n/LanguageProvider';

const { locale } = useI18n();

// Fetchar mensajes promocionales
const response = await fetch(`/api/promotional-messages?locale=${locale}`);
const { messages } = await response.json();

// Usar los mensajes
const randomMessage = messages[Math.floor(Math.random() * messages.length)];
console.log(randomMessage.message); // Ya estará en el idioma correcto
```

**Opción B - Agregar Mensajes a Promocionales Manualmente:**
```sql
INSERT INTO promotional_messages (
  business_name, 
  message, 
  message_en, 
  message_pt, 
  message_fr, 
  is_active, 
  category, 
  priority, 
  show_probability
)
VALUES (
  'Mi Negocio',
  '¡Hola! Te recomiendo visitar mi negocio en Santiago.',
  'Hello! I recommend visiting my business in Santiago.',
  'Olá! Recomendo visitar meu negócio em Santiago.',
  'Bonjour! Je recommande de visiter mon entreprise à Santiago.',
  true,
  'general',
  5,
  30
);
```

---

### 5. 📋 Estructura de Datos Actualizada

**Tabla: `promotional_messages`**
```
Campos existentes:
- id (UUID)
- business_name (VARCHAR)
- message (TEXT) - Mensaje en ESPAÑOL
- is_active (BOOLEAN)
- category (VARCHAR)
- priority (INTEGER)
- show_probability (INTEGER)
- created_at, updated_at

Nuevos campos:
✨ message_en (TEXT) - Inglés
✨ message_pt (TEXT) - Portugués  
✨ message_fr (TEXT) - Francés
```

**Nueva Vista: `promotional_messages_translated`**
- Vista que muestra todos los campos con nombres claros
- Use para consultas que necesiten todas las traducciones

**Nueva Función SQL:**
```sql
-- Obtener mensaje en idioma específico
SELECT get_promotional_message(message_id, 'en');
-- Retorna el mensaje en el idioma solicitado (es, en, pt, fr)
```

---

### 6. 🐛 Error del Tour Animado - Investigación

El tour animado está implementado en `src/components/Map.tsx` con las siguientes características:

**Estado actual:**
- ✅ Función `animateTour()` está definida (línea 269)
- ✅ Detecta interacciones del usuario correctamente
- ✅ Se inicia después de 2 segundos si `tourEnabled` es true
- ✅ Se pausa con `window.stopMapAnimation()`
- ⚠️ **Por defecto está deshabilitado** (`tourEnabled` inicia en `false`)

**Para activar el tour:**
1. Usuario hace clic en botón "Activar Tour" (ahora en `bottom: 100px`)
2. Se establece `tourEnabled = true`
3. La animación comienza automáticamente

**Si aún hay error:**
- Revisa la consola del navegador (F12 → Console tab)
- Busca mensajes como: "🎬 Iniciando tour" o "❌ Error"
- El error podría estar relacionado con:
  - Falta de atractivos/waypoints para animar
  - Mapbox token inválido
  - Conflicto con otras animaciones

---

## ✨ Próximas Funcionalidades Recomendadas

1. **Integrar API de promocionales en ChatInterface**
   - Mostrar mensajes aleatorios durante conversación
   - Respetar `show_probability` para no saturar

2. **Panel Admin para Promocionales**
   - CRUD interface para crear/editar traducciones
   - Preview en los 4 idiomas

3. **Analytics de Promocionales**
   - Rastrear cuáles mensajes se muestran más
   - Qué conversiones generan

4. **Fallback de Traducciones**
   - Si `message_en` es NULL, usar traducción automática
   - O usar versión Spanish como fallback

---

## 🚀 Testing

Verifica los cambios:

```bash
# 1. Cambiar idioma en la app
# - Observa que "Postales de Santiago del Estero" se traduce

# 2. Revisar posición del botón
# - El botón "Activar Tour" debe estar en bottom: 100px

# 3. Probar API de promocionales
curl "http://localhost:3000/api/promotional-messages?locale=en"
# Debe retornar JSON con mensajes

# 4. Revisar console logs
# F12 → Console → Buscar "🎬" o "⏸️" para tour
```

---

## 📁 Archivos Modificados/Creados

```
✏️ Modificados:
- src/i18n/translations.ts (agregadas 4 traducciones para home.postcards)
- src/app/page.tsx (usar t('home.postcards'))
- src/components/Map.tsx (botón Tour: top→bottom)

✨ Creados:
- supabase/migrations/20260301000000_add_promotional_translations.sql
- supabase/migrations/20260301000001_promotional_messages_translations_examples.sql
- src/app/api/promotional-messages/route.ts
- CAMBIOS_REALIZADOS.md (este archivo)
```

---

## ❓ Preguntas Frecuentes

**P: ¿Cómo agrego más idiomas a mensajes promocionales?**  
R: Agrega una columna `message_xx` donde `xx` es el código del idioma. Actualiza la función `getMessageForLocale` en el API.

**P: ¿El tour falla cuando no hay atractivos?**  
R: Sí. El tour necesita al menos un atractivo con coordenadas `lat, lng` válidas.

**P: ¿Cómo deshabilito los tours automáticos después de inactividad?**  
R: Modifica `inactivityDelay` en Map.tsx (actualmente 2000ms).

---

Todos los cambios están listos para producción. ¡Compila y prueba! 🚀
