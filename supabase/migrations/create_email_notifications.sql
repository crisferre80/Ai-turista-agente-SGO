-- Crear tabla para plantillas de email
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    subject VARCHAR(255) NOT NULL,
    html_content TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb, -- Array de variables disponibles
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla para configuraciones de notificaciones
CREATE TABLE IF NOT EXISTS email_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL UNIQUE,
    template_id UUID REFERENCES email_templates(id),
    recipient_type VARCHAR(20) NOT NULL, -- 'user', 'business', 'admin'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar plantillas por defecto
INSERT INTO email_templates (name, subject, html_content, variables) VALUES
('Bienvenida Turista', '¡Bienvenido/a a Santiago del Estero!',
 '<!DOCTYPE html>
 <html>
 <head>
   <meta charset="utf-8">
   <style>
     body { font-family: ''Segoe UI'', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
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
 </html>', '["user_name", "app_url", "current_year"]'),

('Registro Negocio', 'Nuevo negocio registrado - {{business_name}}',
 '<!DOCTYPE html>
 <html>
 <head>
   <meta charset="utf-8">
   <style>
     body { font-family: ''Segoe UI'', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
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
 </html>', '["business_name", "business_email", "business_category", "business_phone", "admin_url", "current_year"]'),

('Pago Completado', 'Confirmación de pago - {{order_id}}',
 '<!DOCTYPE html>
 <html>
 <head>
   <meta charset="utf-8">
   <style>
     body { font-family: ''Segoe UI'', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
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
         <p><strong>Monto:</strong> ${{amount}}</p>
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
 </html>', '["user_name", "order_id", "amount", "payment_date", "payment_method", "app_url", "current_year"]'),

('Negocio Aprobado', '¡Tu negocio ha sido aprobado!',
 '<!DOCTYPE html>
 <html>
 <head>
   <meta charset="utf-8">
   <style>
     body { font-family: ''Segoe UI'', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
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
 </html>', '["business_owner", "business_name", "business_dashboard_url", "current_year"]');

-- Insertar configuraciones de notificaciones
INSERT INTO email_notifications (event_type, template_id, recipient_type, is_active) VALUES
('user_registered', (SELECT id FROM email_templates WHERE name = 'Bienvenida Turista'), 'user', true),
('business_registered', (SELECT id FROM email_templates WHERE name = 'Registro Negocio'), 'admin', true),
('payment_completed', (SELECT id FROM email_templates WHERE name = 'Pago Completado'), 'user', true),
('business_approved', (SELECT id FROM email_templates WHERE name = 'Negocio Aprobado'), 'business', true);