import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupEmailNotifications() {
  try {
    console.log('🚀 Configurando sistema de notificaciones por email...');

    // Insertar plantillas directamente
    const templates = [
      {
        name: 'Bienvenida Turista',
        subject: '¡Bienvenido/a a Santiago del Estero!',
        html_content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1A3A6C 0%, #2C5AA0 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; background: #F1C40F; color: #1A3A6C; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>¡Bienvenido/a a Santiago del Estero!</h1>
    </div>
    <div class="content">
      <h2>Hola {{user_name}},</h2>
      <p>¡Qué alegría tenerte con nosotros! Gracias por unirte a nuestra comunidad de exploradores de Santiago del Estero.</p>
      <p>Con nuestra aplicación podrás:</p>
      <ul>
        <li>🗺️ Descubrir lugares increíbles de la provincia</li>
        <li>🎙️ Grabar tus historias y experiencias</li>
        <li>⭐ Dejar reseñas de los lugares que visites</li>
        <li>🤖 Chatear con Santi, tu guía turístico virtual</li>
      </ul>
      <p style="text-align: center;">
        <a href="{{app_url}}" class="button">Comenzar a Explorar</a>
      </p>
      <p>¡Que disfrutes tu aventura en Santiago del Estero!</p>
    </div>
    <div class="footer">
      <p>Este es un correo automático. Por favor no responder a este mensaje.</p>
      <p>&copy; {{current_year}} Santiago del Estero Turismo</p>
    </div>
  </div>
</body>
</html>`,
        variables: ['user_name', 'app_url', 'current_year']
      },
      {
        name: 'Registro Negocio',
        subject: 'Nuevo negocio registrado - {{business_name}}',
        html_content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1A3A6C 0%, #2C5AA0 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; background: #F1C40F; color: #1A3A6C; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Nuevo Negocio Registrado</h1>
    </div>
    <div class="content">
      <h2>Administrador,</h2>
      <p>Un nuevo negocio se ha registrado en la plataforma:</p>
      <ul>
        <li><strong>Nombre:</strong> {{business_name}}</li>
        <li><strong>Email:</strong> {{business_email}}</li>
        <li><strong>Categoría:</strong> {{business_category}}</li>
        <li><strong>Teléfono:</strong> {{business_phone}}</li>
      </ul>
      <p style="text-align: center;">
        <a href="{{admin_url}}" class="button">Revisar en Panel Admin</a>
      </p>
    </div>
    <div class="footer">
      <p>&copy; {{current_year}} Santiago del Estero Turismo</p>
    </div>
  </div>
</body>
</html>`,
        variables: ['business_name', 'business_email', 'business_category', 'business_phone', 'admin_url', 'current_year']
      },
      {
        name: 'Pago Completado',
        subject: 'Confirmación de pago - {{order_id}}',
        html_content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1A3A6C 0%, #2C5AA0 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; background: #F1C40F; color: #1A3A6C; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>¡Pago Confirmado!</h1>
    </div>
    <div class="content">
      <h2>Hola {{user_name}},</h2>
      <p>Tu pago ha sido procesado exitosamente.</p>
      <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3>Detalles del pago:</h3>
        <p><strong>ID de orden:</strong> {{order_id}}</p>
        <p><strong>Monto:</strong> {{amount}}</p>
        <p><strong>Fecha:</strong> {{payment_date}}</p>
        <p><strong>Método:</strong> {{payment_method}}</p>
      </div>
      <p>Gracias por tu compra. ¡Disfruta tu experiencia en Santiago del Estero!</p>
      <p style="text-align: center;">
        <a href="{{app_url}}" class="button">Ir a la App</a>
      </p>
    </div>
    <div class="footer">
      <p>&copy; {{current_year}} Santiago del Estero Turismo</p>
    </div>
  </div>
</body>
</html>`,
        variables: ['user_name', 'order_id', 'amount', 'payment_date', 'payment_method', 'app_url', 'current_year']
      },
      {
        name: 'Negocio Aprobado',
        subject: '¡Tu negocio ha sido aprobado!',
        html_content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1A3A6C 0%, #2C5AA0 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; background: #F1C40F; color: #1A3A6C; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>¡Felicitaciones!</h1>
    </div>
    <div class="content">
      <h2>Hola {{business_owner}},</h2>
      <p>¡Excelente noticia! Tu negocio <strong>{{business_name}}</strong> ha sido aprobado y ya está visible en la plataforma.</p>
      <p>Ahora puedes:</p>
      <ul>
        <li>📝 Gestionar tu perfil de negocio</li>
        <li>📸 Subir fotos y actualizar información</li>
        <li>💬 Recibir consultas de turistas</li>
        <li>📊 Ver estadísticas de visitas</li>
      </ul>
      <p style="text-align: center;">
        <a href="{{business_dashboard_url}}" class="button">Ir a Mi Panel</a>
      </p>
      <p>¡Bienvenido a la comunidad de Santiago del Estero!</p>
    </div>
    <div class="footer">
      <p>&copy; {{current_year}} Santiago del Estero Turismo</p>
    </div>
  </div>
</body>
</html>`,
        variables: ['business_owner', 'business_name', 'business_dashboard_url', 'current_year']
      }
    ];

    for (const template of templates) {
      const { error } = await supabase
        .from('email_templates')
        .upsert(template, { onConflict: 'name' });

      if (error) {
        console.error(`Error insertando plantilla ${template.name}:`, error);
      } else {
        console.log(`✅ Plantilla ${template.name} insertada`);
      }
    }

    // Insertar configuraciones de notificaciones
    const notifications = [
      { event_type: 'user_registered', template_name: 'Bienvenida Turista', recipient_type: 'user' },
      { event_type: 'business_registered', template_name: 'Registro Negocio', recipient_type: 'admin' },
      { event_type: 'payment_completed', template_name: 'Pago Completado', recipient_type: 'user' },
      { event_type: 'business_approved', template_name: 'Negocio Aprobado', recipient_type: 'business' }
    ];

    for (const notification of notifications) {
      // Obtener el ID de la plantilla
      const { data: template } = await supabase
        .from('email_templates')
        .select('id')
        .eq('name', notification.template_name)
        .single();

      if (template) {
        const { error } = await supabase
          .from('email_notifications')
          .upsert({
            event_type: notification.event_type,
            template_id: template.id,
            recipient_type: notification.recipient_type,
            is_active: true
          }, { onConflict: 'event_type' });

        if (error) {
          console.error(`Error insertando notificación ${notification.event_type}:`, error);
        } else {
          console.log(`✅ Notificación ${notification.event_type} configurada`);
        }
      }
    }

    console.log('🎉 Sistema de notificaciones por email configurado exitosamente!');

  } catch (error) {
    console.error('Error configurando notificaciones:', error);
  }
}

setupEmailNotifications();