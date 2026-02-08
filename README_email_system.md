# 📧 Sistema de Email Marketing y Notificaciones

## Descripción
Sistema completo de email marketing integrado en el panel de administración de SantiGuía. Permite crear plantillas personalizadas, gestionar contactos, enviar campañas masivas y configurar notificaciones automáticas.

## Características

### ✨ Funcionalidades Principales

1. **Gestión de Plantillas**
   - Editor de plantillas HTML con variables dinámicas
   - Categorías: Marketing, Transaccional, Notificación
   - Variables soportadas: `{{nombre}}`, `{{email}}`, `{{app_url}}`, etc.
   - Vista previa y edición en tiempo real

2. **Base de Contactos**
   - Importación y gestión de contactos
   - Segmentación por tags (turista, negocio, VIP, local, etc.)
   - Estado de suscripción
   - Metadata personalizada

3. **Campañas de Email**
   - Envío masivo a contactos segmentados
   - Estadísticas en tiempo real (enviados, fallidos, abiertos)
   - Programación de envíos
   - Historial de campañas

4. **Notificaciones Automáticas**
   - Email de bienvenida al registrarse
   - Notificación de nuevos negocios
   - Anuncios de nuevas funciones
   - Alertas de nuevos relatos
   - Recordatorios personalizados

## 📋 Configuración

### 1. Base de Datos

Ejecutar el script SQL para crear las tablas necesarias:

```bash
psql -h <supabase-host> -U postgres -d postgres -f db/email_system_schema.sql
```

O ejecutarlo directamente desde el SQL Editor de Supabase.

### 2. Variables de Entorno

Asegurarse de tener configuradas las credenciales de Gmail:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=santiguia@santiguia-mail.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
GMAIL_FROM_EMAIL=santiguia@santiguia-mail.iam.gserviceaccount.com
NEXT_PUBLIC_APP_URL=https://tu-dominio.com
```

### 3. Permisos de Gmail API

La cuenta de servicio debe tener habilitado Gmail API en Google Cloud Console:
- Gmail API > Gmail Send Scope

## 🎯 Uso

### Panel de Administración

Acceder a: `/admin` → Tab "📧 Emails"

#### 1. Crear Plantilla

1. Click en "+ Nueva Plantilla"
2. Completar:
   - Nombre: Identificador interno
   - Asunto: Asunto del email
   - Categoría: marketing/transactional/notification
   - Contenido HTML: Código HTML del email
3. Usar variables: `{{nombre}}`, `{{email}}`, `{{app_url}}`
4. Guardar

**Ejemplo de Plantilla:**

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1A3A6C; padding: 40px; text-align: center;">
        <h1 style="color: white;">¡Hola {{nombre}}!</h1>
    </div>
    <div style="padding: 30px;">
        <p>Contenido del mensaje...</p>
        <a href="{{app_url}}" style="background: #9E1B1B; color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px;">
            Ver más
        </a>
    </div>
</body>
</html>
```

#### 2. Agregar Contactos

1. Click en "+ Agregar Contacto"
2. Ingresar email (requerido)
3. Opcional: nombre, tags para segmentación
4. Guardar

**Tags sugeridos:**
- `turista`: Visitantes
- `negocio`: Dueños de negocios
- `vip`: Usuarios premium
- `local`: Residentes locales

#### 3. Enviar Campaña

1. Click en "+ Nueva Campaña"
2. Seleccionar plantilla
3. Elegir destinatarios:
   - Todos los suscritos
   - Por tags específicos
4. Confirmar envío

El sistema enviará los emails en batches de 10 para evitar límites de rate.

#### 4. Configurar Notificaciones Automáticas

1. Tab "🔔 Notificaciones"
2. Activar/desactivar eventos
3. Asignar plantilla a cada evento
4. Configurar destinatarios

## 🔧 API de Notificaciones

### Enviar Notificación Programática

Usar el helper `emailNotifications`:

```typescript
import { sendWelcomeEmail, notifyNewBusiness } from '@/lib/emailNotifications';

// Email de bienvenida
await sendWelcomeEmail('usuario@email.com', 'Juan Pérez');

// Notificar nuevo negocio
await notifyNewBusiness({
    id: 'abc-123',
    name: 'Restaurant El Buen Sabor',
    category: 'Gastronomía',
    description: 'Comida típica santiagueña',
    location: 'Centro, Santiago del Estero'
});
```

### Ejemplo: Integración en Registro de Usuario

```typescript
// En tu componente de registro
const handleRegister = async (formData) => {
    // ... crear usuario en Supabase
    
    // Agregar a contactos de email
    await supabase.from('email_contacts').insert([{
        email: formData.email,
        name: formData.name,
        tags: ['turista'],
        subscribed: true
    }]);
    
    // Enviar email de bienvenida
    await sendWelcomeEmail(formData.email, formData.name);
};
```

### Ejemplo: Notificar al Registrar Negocio

```typescript
// En el panel admin al crear negocio
const handleCreateBusiness = async (businessData) => {
    // Crear negocio en DB
    const { data } = await supabase
        .from('business_profiles')
        .insert([businessData])
        .select()
        .single();
    
    // Notificar a todos los suscritos
    await notifyNewBusiness({
        id: data.id,
        name: data.name,
        category: data.category,
        description: data.description
    });
};
```

## 📊 Estadísticas y Logs

Todas las campañas registran:
- Total de destinatarios
- Emails enviados exitosamente
- Emails fallidos
- Fecha de envío
- Errores específicos

Ver en: Tab "📨 Campañas"

## 🔒 Seguridad

- **RLS (Row Level Security)**: Solo admins pueden gestionar emails
- **Rate Limiting**: Envíos en batches para evitar bloqueos
- **Validación de emails**: Formato válido requerido
- **Unsubscribe**: Sistema de desuscripción respetado automáticamente

## 📝 Variables Disponibles

Variables que se pueden usar en plantillas:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `{{nombre}}` | Nombre del contacto | Juan Pérez |
| `{{email}}` | Email del contacto | juan@email.com |
| `{{app_url}}` | URL de la aplicación | https://santiguia.com |
| `{{business_name}}` | Nombre del negocio (new_business) | Restaurant El Buen Sabor |
| `{{category}}` | Categoría | Gastronomía |
| `{{location}}` | Ubicación | Centro, Santiago del Estero |
| `{{description}}` | Descripción | Comida típica... |
| `{{business_url}}` | URL del negocio | https://santiguia.com/business/123 |
| `{{feature_name}}` | Nombre de feature (new_feature) | Sistema de Reservas |
| `{{feature_description}}` | Descripción de feature | Ahora podés reservar... |
| `{{story_title}}` | Título del relato (new_story) | La Leyenda del Dique |
| `{{story_excerpt}}` | Extracto del relato | En 1950... |

## 🚀 Mejoras Futuras

- [ ] Editor visual drag & drop para plantillas
- [ ] A/B testing de asuntos
- [ ] Tracking de aperturas y clicks
- [ ] Integración con más proveedores (SendGrid, Mailgun)
- [ ] Plantillas prediseñadas
- [ ] Automatizaciones basadas en comportamiento
- [ ] Importación masiva de contactos (CSV)
- [ ] Filtros avanzados de segmentación

## 🐛 Troubleshooting

### Los emails no se envían

1. Verificar credenciales de Gmail en `.env.local`
2. Confirmar que Gmail API está habilitada en Google Cloud
3. Revisar logs en consola del servidor
4. Verificar que los contactos estén suscritos (`subscribed = true`)

### Error "Template not found"

- Asegurarse de que la plantilla existe en `email_templates`
- Verificar el ID de la plantilla en la configuración de notificaciones

### Error "No recipients found"

- Verificar que hay contactos suscritos en `email_contacts`
- Revisar filtros de tags si se usa segmentación

## 📞 Soporte

Para problemas o consultas:
- Revisar logs del servidor: `npm run dev`
- Consultar documentación de Gmail API
- Verificar permisos en Supabase

---

**Desarrollado para SantiGuía** 🏔️
Sistema de Email Marketing y Notificaciones v1.0
