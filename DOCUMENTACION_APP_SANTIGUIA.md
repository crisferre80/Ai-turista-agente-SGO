# 🏔️ SantiGuía - Asistente Turístico de Santiago del Estero

## 📱 Descripción General

**SantiGuía** es una aplicación web y móvil de asistencia turística inteligente para Santiago del Estero, Argentina. La aplicación cuenta con un avatar conversacional llamado **Santi** que utiliza inteligencia artificial para ayudar a turistas y visitantes a descubrir y explorar la provincia.

### Tecnologías Principales
- **Frontend**: Next.js 16.1.6, React 19.2.3, TypeScript
- **Backend**: Supabase (PostgreSQL), Edge Functions
- **IA/ML**: OpenAI GPT-4o, Google Generative AI (Gemini)
- **Mapas**: Mapbox GL
- **Móvil**: Capacitor (iOS y Android)
- **Notificaciones**: OneSignal
- **Emails**: Gmail API, Node-Mailjet

---

## 🎯 Características Principales

### 1. 🤖 Asistente Virtual "Santi"

**Descripción**: Avatar conversacional con voz e inteligencia artificial que guía a los turistas.

**Funcionalidades**:
- Chat interactivo con IA (OpenAI GPT-4o)
- Síntesis de voz (Text-to-Speech) en español argentino
- Respuestas contextuales sobre lugares, historia y cultura
- Recomendaciones personalizadas según intereses del turista
- Integración con información geográfica en tiempo real

**Características Avanzadas**:
- Descripción de ubicación actual del usuario usando geocoding reverso
- Mensajes promocionales inteligentes sobre negocios locales
- Sistema de engagement proactivo (cada 2 minutos de inactividad)
- Detección automática de contenido multimedia relevante

---

### 2. 🗺️ Sistema de Mapas Interactivo

**Funcionalidades**:
- Mapa interactivo con Mapbox GL
- Geolocalización del usuario en tiempo real
- Marcadores de atracciones turísticas y negocios
- Navegación y rutas hacia puntos de interés
- Clusters de marcadores para mejor visualización
- Filtrado por categorías (histórico, naturaleza, gastronomía, etc.)

**Categorías Disponibles**:
- 🏛️ Histórico
- 🌿 Naturaleza
- 🛍️ Compras
- 🎭 Cultura
- 🏗️ Arquitectura
- 🗿 Monumentos
- 🏞️ Reservas Naturales
- 🍽️ Gastronomía
- 🎨 Artesanía

---

### 3. 👤 Sistema de Autenticación Dual

#### Para Turistas
- **Email/Password tradicional** con persistencia de sesión
- Confirmación por email
- Creación automática de perfil al registrarse
- Recuperación de contraseña

#### Para Negocios
- **Autenticación tradicional** con permisos especiales
- Panel de administración de negocio
- Sincronización automática entre perfil y negocio
- Estados activo/inactivo para negocios

**Características de Seguridad**:
- Row Level Security (RLS) en Supabase
- Políticas de acceso por rol (tourist/business/admin)
- Sesiones seguras con JWT
- Refresh tokens de 30 días

---

### 4. 📊 Perfil de Turista Completo

**Información Personal**:
- Edad, género, país/ciudad de origen
- Email y teléfono de contacto
- Foto de perfil

**Información del Viaje**:
- Propósito de la visita
- Tipo de grupo (solo, pareja, familia, amigos)
- Tipo de alojamiento
- Medio de transporte
- Duración de estadía
- Rango de presupuesto

**Intereses y Preferencias**:
- Selección múltiple de intereses (naturaleza, cultura, gastronomía, aventura, etc.)
- Necesidades de accesibilidad
- Restricciones alimentarias

**Experiencia y Feedback**:
- Frecuencia de visita
- Experiencias favoritas (texto libre)
- Lugares recomendados
- ¿Volvería a visitar?
- Calificación de satisfacción (1-5 estrellas)
- Sugerencias de mejora

**Estadísticas del Turista**:
- Lugares visitados
- Reseñas dejadas
- Historias grabadas

---

### 5. ⭐ Sistema de Reseñas

**Funcionalidades**:
- Turistas pueden dejar reseñas en lugares visitados
- Calificación por estrellas (1-5)
- Comentarios de texto libre
- Carga de fotos (múltiples imágenes)
- Marcado como favorito
- Reseñas públicas/privadas

**Visualización**:
- Galería de reseñas por lugar
- Galería de reseñas por usuario
- Estadísticas de reseñas por lugar
- Promedio de calificaciones

**Políticas RLS**:
- Cualquiera puede leer reseñas públicas
- Solo usuarios autenticados pueden crear reseñas
- Solo propietarios pueden editar/eliminar sus reseñas

---

### 6. 🎙️ Grabación de Historias (Story Recorder)

**Descripción**: Los turistas pueden grabar historias en audio sobre sus experiencias.

**Funcionalidades**:
- Grabación de audio en el navegador
- Transcripción automática con IA
- Almacenamiento en Supabase Storage
- Visualización de narraciones por usuario
- Contador de historias grabadas en perfil

---

### 7. 💼 Mensajes Promocionales

**Sistema Inteligente de Promociones**:
- Base de datos de mensajes promocionales
- Prioridad y probabilidad configurables
- Activación/pausado de mensajes
- Categorización (tecnología, gastronomía, general, etc.)
- Santi menciona promociones cada 2 minutos de inactividad (25% probabilidad)

**Generación con IA**:
- Botón "Generar con IA" en panel admin
- OpenAI GPT-4o-mini crea mensajes personalizados
- Tono conversacional y natural
- Adaptación según categoría de negocio

**Panel de Administración**:
- Crear/editar/eliminar mensajes
- Gestionar prioridad y probabilidad
- Vista de estado (activo/pausado)
- Estadísticas de mensajes

---

### 8. 📧 Sistema de Email Marketing

**Gestión de Plantillas**:
- Editor HTML con variables dinámicas
- Categorías: Marketing, Transaccional, Notificación
- Variables: `{{nombre}}`, `{{email}}`, `{{app_url}}`, etc.
- Vista previa en tiempo real

**Base de Contactos**:
- Importación y gestión de contactos
- Segmentación por tags (turista, negocio, VIP, local)
- Estado de suscripción
- Metadata personalizada

**Campañas de Email**:
- Envío masivo segmentado
- Estadísticas (enviados, fallidos, abiertos)
- Programación de envíos
- Historial de campañas

**Notificaciones Automáticas**:
- Email de bienvenida
- Notificación de nuevos negocios
- Anuncios de nuevas funciones
- Alertas de nuevos relatos
- Recordatorios personalizados

**Integración**:
- Gmail API con cuenta de servicio
- Plantillas HTML responsive
- Sistema de variables dinámicas

---

### 9. 🎥 Sistema de Videos

**Detección Inteligente**:
- Análisis contextual de preguntas del usuario
- Búsqueda de videos relevantes en base de datos
- Coincidencia por palabras clave en títulos
- Normalización de texto (sin acentos)

**Visualización**:
- Modal interactivo con reproductor YouTube embebido
- Diseño responsive (16:9)
- Mensaje de Santi: "Te muestro imágenes de [título]..."
- Aparición automática después de 1.5 segundos

**Base de Datos**:
- Tabla `app_videos` con títulos y URLs
- Integración con chat de Santi
- Priorizació del primer video relevante

---

### 10. 🏢 Panel de Administración

**Gestión de Negocios**:
- Lista de todos los negocios registrados
- Activar/desactivar negocios
- Editar información de negocios
- Ver estadísticas

**Gestión de Atracciones**:
- CRUD completo de atracciones turísticas
- Carga de imágenes y datos
- Categorización
- Coordenadas GPS

**Gestión de Categorías**:
- Tabla estandarizada de categorías
- Íconos para cada categoría
- Categorías para attractions y businesses

**Gestión de Usuarios**:
- Lista de turistas registrados
- Estadísticas de usuarios
- Administración de perfiles

**Panel de Email Marketing**:
- Gestión de plantillas
- Gestión de contactos
- Creación de campañas
- Estadísticas de envíos

**Panel de Mensajes Promocionales**:
- CRUD de mensajes
- Generación con IA
- Configuración de probabilidades
- Activación/pausado

---

### 11. 🔄 Sincronización Automática

**Business Profiles Sync**:
- Trigger automático al crear negocio → actualiza perfil a rol 'business'
- Trigger automático al cambiar rol a 'business' → crea negocio placeholder
- Sincronización bidireccional automática
- Mantenimiento de integridad de datos

**Auto-creación de Perfiles**:
- Trigger al registrar usuario → crea perfil automáticamente
- Metadata de rol incluido en registro
- Fallback en página principal para garantizar creación

---

### 12. 📍 Descripción de Ubicación con IA

**Funcionalidad**:
- Usuario pregunta "¿Dónde estoy?"
- Sistema obtiene coordenadas GPS
- Geocoding reverso con Mapbox (coordenadas → nombre de lugar)
- OpenAI GPT-4o genera descripción contextual
- Incluye datos culturales, históricos y turísticos
- Santi narra la descripción con voz

**Preguntas Soportadas**:
- "¿Dónde estoy?"
- "¿Cuál es mi ubicación actual?"
- "Describe este lugar"
- "¿En qué parte estoy?"
- "Háblame de donde estoy"
- Y variaciones similares...

---

### 13. 📱 Aplicación Móvil

**Capacitor Integration**:
- Versión iOS (App Store)
- Versión Android (Google Play)
- Acceso a cámara nativa
- Almacenamiento local
- Preferencias del usuario

**Características Móviles**:
- Diseño responsive
- Touch-friendly UI
- Geolocalización nativa
- Notificaciones push (OneSignal)

---

## 🎨 Diseño y Experiencia de Usuario

### Interfaz
- Diseño moderno con Tailwind CSS
- Componentes de Radix UI
- Animaciones suaves
- Tema consistente con colores de Santiago del Estero
- Iconos de Lucide React

### Responsive Design
- Adaptado para móvil, tablet y desktop
- Navegación intuitiva
- Cards y layouts flexibles

### Accesibilidad
- Soporte para lectores de pantalla
- Alto contraste
- Navegación por teclado
- Opciones de accesibilidad en perfil de turista

---

## 📊 Analítica y Estadísticas

### Vistas SQL Creadas

**tourist_analytics**:
- Total de turistas
- Edad promedio
- Distribución por género
- Frecuencia de visita
- Satisfacción promedio
- Duración promedio de estadía
- Porcentaje que volvería
- Distribución por propósito de visita
- Distribución por rango de presupuesto

**tourist_origin_countries**:
- Análisis de origen geográfico
- Cantidad por país/ciudad
- Satisfacción por ubicación

**tourist_interests_analysis**:
- Intereses más populares
- Cantidad de turistas por interés

### Consultas Personalizadas
- Turistas por rango de edad
- Satisfacción por tipo de alojamiento
- Distribución de presupuesto por país
- Análisis de feedback y sugerencias

---

## 🗄️ Estructura de Base de Datos

### Tablas Principales

**profiles**
- Información de usuarios (turistas y negocios)
- Campos de perfil turista completo
- Role: tourist/business/admin

**businesses**
- Información de negocios locales
- Categorías, coordenadas, contacto
- Estado activo/inactivo
- Relación con owner_id (profiles)

**attractions**
- Lugares turísticos
- Categorías, descripciones
- Coordenadas GPS
- Imágenes

**user_reviews**
- Reseñas de turistas
- Calificaciones por estrellas
- Comentarios e imágenes
- Público/privado

**narrations**
- Grabaciones de audio de turistas
- Transcripciones
- URLs de archivos

**promotional_messages**
- Mensajes promocionales de Santi
- Prioridad y probabilidad
- Categorización
- Estado activo/pausado

**categories**
- Categorías estandarizadas
- Íconos para UI
- Para attractions y businesses

**email_templates**
- Plantillas HTML de emails
- Categorías y variables dinámicas

**email_contacts**
- Base de datos de contactos
- Segmentación por tags

**email_campaigns**
- Campañas de email enviadas
- Estadísticas de envío

**app_videos**
- Videos de YouTube relevantes
- Títulos y URLs
- Usado por sistema de videos de Santi

---

## 🔐 Seguridad

### Row Level Security (RLS)
- Políticas configuradas en todas las tablas
- Acceso basado en roles
- Separación de datos por usuario

### Autenticación
- JWT tokens seguros
- Refresh tokens de larga duración
- Confirmación de email
- Recuperación de contraseña

### Storage
- Políticas de acceso a archivos
- Límites de tamaño
- Validación de tipos de archivo

---

## 🚀 Funcionalidades Futuras Sugeridas

### En Desarrollo
- Sistema de reservas para hoteles/restaurantes
- Integración con MercadoPago para pagos
- Sistema de cupones y descuentos
- Gamificación (badges por visitas)
- Tours guiados virtuales
- Realidad aumentada para monumentos
- Chat multiidioma
- Integración con redes sociales
- Sistema de referidos
- App offline mode

---

## 📱 Plataformas Soportadas

- ✅ Web (Next.js)
- ✅ iOS (Capacitor)
- ✅ Android (Capacitor)
- ✅ Progressive Web App (PWA)

---

## 🌍 Idiomas

- Español (principal)
- Soporta inglés, portugués y francés además de español.
- La aplicación detecta automáticamente el idioma del navegador o cabecera `Accept-Language` en el primer acceso.
- Hay un selector en la cabecera que permite forzar manualmente un idioma o volver al modo **Automático**.
- Las traducciones se gestionan en `src/i18n/translations.ts` y se pueden ampliar con nuevos textos y lenguajes.

---

## 📞 Integración con Servicios

### APIs Externas
- **OpenAI API**: Chat inteligente y generación de contenido
- **Google Generative AI**: Asistencia con Gemini
- **Mapbox**: Mapas y geocoding
- **Gmail API**: Envío de emails
- **Node-Mailjet**: Email marketing alternativo
- **OneSignal**: Notificaciones push

### Servicios de Google Cloud
- Gmail API
- Service Accounts
- OAuth 2.0

---

## 🎓 Casos de Uso

### Para Turistas
1. **Explorar la Provincia**: Descubrir lugares turísticos en el mapa
2. **Consultar a Santi**: Preguntar sobre historia, cultura, gastronomía
3. **Dejar Reseñas**: Compartir experiencias en lugares visitados
4. **Grabar Historias**: Narrar experiencias en audio
5. **Completar Perfil**: Proporcionar información para análisis turístico
6. **Ver Videos**: Acceder a contenido audiovisual sobre lugares

### Para Negocios
1. **Registrar Negocio**: Crear perfil empresarial
2. **Actualizar Información**: Mantener datos al día
3. **Recibir Reseñas**: Feedback de clientes
4. **Promocionarse**: Mensajes promocionales con Santi
5. **Ver Estadísticas**: Análisis de visitas y reseñas

### Para Administradores
1. **Gestionar Contenido**: Agregar/editar atracciones y negocios
2. **Email Marketing**: Enviar campañas a turistas
3. **Analítica**: Ver estadísticas de uso y turismo
4. **Moderación**: Gestionar reseñas y contenido
5. **Configuración**: Ajustar mensajes promocionales

---

## 📈 Métricas y KPIs

### Métricas de Usuario
- Turistas registrados
- Tasa de retención
- Tiempo promedio en app
- Interacciones con Santi
- Lugares visitados por turista

### Métricas de Contenido
- Reseñas totales
- Calificación promedio por lugar
- Historias grabadas
- Videos visualizados

### Métricas de Negocio
- Negocios registrados
- Tasa de activación
- Mensajes promocionales enviados
- Clicks en promociones

### Métricas de Email
- Tasa de apertura
- Tasa de clicks
- Campañas enviadas
- Contactos activos

---

## 🛠️ Stack Tecnológico Completo

### Frontend
- Next.js 16.1.6
- React 19.2.3
- TypeScript
- Tailwind CSS
- Radix UI
- Lucide React Icons

### Backend
- Supabase (PostgreSQL)
- Edge Functions
- Row Level Security (RLS)
- Database Triggers

### IA/ML
- OpenAI GPT-4o
- OpenAI GPT-4o-mini
- Google Generative AI (Gemini)
- Text-to-Speech

### Mapas y Geolocalización
- Mapbox GL
- Geocoding API
- Reverse Geocoding

### Móvil
- Capacitor 8.x
- iOS Native
- Android Native

### Emails
- Gmail API
- Node-Mailjet
- Nodemailer

### Notificaciones
- OneSignal Web SDK

### Almacenamiento
- Supabase Storage
- File Upload

### Autenticación
- Supabase Auth
- JWT Tokens
- OAuth 2.0

### Pagos (Preparado)
- MercadoPago SDK

---

## 📝 Documentación Disponible

La aplicación cuenta con extensa documentación técnica:

- `README.md` - Guía principal
- `README_autenticacion_tradicional.md` - Sistema de autenticación
- `README_auth_turistas_magic_link.md` - Magic links (deprecated)
- `README_business_sync.md` - Sincronización de negocios
- `README_categorias_mejoradas.md` - Sistema de categorías
- `README_email_system.md` - Email marketing
- `README_generacion_ia_promocionales.md` - Generación con IA
- `README_location_feature.md` - Ubicación con IA
- `README_mensajes_promocionales.md` - Mensajes promocionales
- `README_perfil_turista_completo.md` - Perfil de turista
- `README_resenas_y_perfil_turista.md` - Sistema de reseñas
- `README_videos_modal.md` - Sistema de videos
- Scripts SQL documentados (50+ archivos)

---

## 🏆 Ventajas Competitivas

1. **Asistente IA Conversacional**: Santi proporciona experiencia única y personalizada
2. **Datos Turísticos Completos**: Análisis profundo del comportamiento turístico
3. **Integración Total**: Turistas y negocios en una sola plataforma
4. **Multimedia Rico**: Audio, video, imágenes, mapas
5. **Email Marketing Integrado**: Comunicación directa con turistas
6. **Generación de Contenido con IA**: Automatización inteligente
7. **Experiencia Móvil Nativa**: Apps iOS y Android
8. **Ubicación en Tiempo Real**: Recomendaciones contextuales
9. **Sistema de Reseñas Social**: Feedback de la comunidad
10. **Análítica Avanzada**: Insights para mejorar turismo provincial

---

## 📅 Historial de Desarrollo

- **2024**: Inicio del proyecto
- **2025**: Implementación de características principales
  - Sistema de autenticación tradicional
  - Perfil turista completo
  - Mensajes promocionales con IA
  - Sistema de videos
  - Email marketing
  - Sincronización automática
  - Ubicación con IA

---

## 👥 Roles de Usuario

### Tourist (Turista)
- Explorar lugares
- Dejar reseñas
- Grabar historias
- Completar perfil
- Recibir recomendaciones

### Business (Negocio)
- Gestionar perfil de negocio
- Ver reseñas recibidas
- Actualizar información
- Promocionarse

### Admin (Administrador)
- Acceso total a panel admin
- Gestión de contenido
- Email marketing
- Analítica
- Configuración del sistema

---

## 🎯 Objetivos del Proyecto

1. **Promover el Turismo**: Atraer más visitantes a Santiago del Estero
2. **Facilitar la Experiencia**: Hacer el viaje más fácil y agradable
3. **Conectar Negocios**: Vincular turistas con comercios locales
4. **Recopilar Datos**: Análisis para mejorar la oferta turística
5. **Preservar Cultura**: Documentar historias y experiencias
6. **Impulsar Economía**: Beneficiar a negocios locales

---

## 🌟 Valor Agregado

**SantiGuía** no es solo una app de mapas o guía turística tradicional. Es una plataforma integral que:

- Combina **IA conversacional** con información turística real
- Recopila **datos valiosos** sobre el comportamiento turístico
- Conecta **turistas con negocios** de forma inteligente
- Proporciona **experiencia personalizada** según intereses
- Genera **contenido automático** con inteligencia artificial
- Ofrece **análisis profundo** para mejorar la oferta turística provincial

---

## 📧 Contacto

**Proyecto**: SantiGuía - Asistente Turístico de Santiago del Estero  
**Plataforma**: Web y Móvil (iOS/Android)  
**Tecnología**: Next.js + Supabase + OpenAI + Mapbox  

---

*Documentación generada el 9 de febrero de 2026*
