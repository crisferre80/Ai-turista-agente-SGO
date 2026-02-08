import { supabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';

export interface EmailEventData {
  event_type: string;
  recipient_email: string;
  template_data: Record<string, string | number | boolean | null>;
}

export async function sendEventEmail(eventData: EmailEventData) {
  try {
    // Buscar la configuración de notificación para este evento
    const { data: notification, error: notificationError } = await supabase
      .from('email_notifications')
      .select(`
        *,
        email_templates (*)
      `)
      .eq('event_type', eventData.event_type)
      .eq('is_active', true)
      .single();

    if (notificationError || !notification) {
      console.log(`No active notification found for event: ${eventData.event_type}`);
      return;
    }

    const template = notification.email_templates;
    if (!template) {
      console.error('Template not found for notification');
      return;
    }

    // Reemplazar variables en el subject y contenido
    let subject = template.subject;
    let htmlContent = template.html_content;

    Object.entries(eventData.template_data).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, String(value));
      htmlContent = htmlContent.replace(regex, String(value));
    });

    // Enviar el email
    await sendEmail({
      to: eventData.recipient_email,
      subject,
      html: htmlContent
    });

    console.log(`Email sent for event: ${eventData.event_type}`);
  } catch (error) {
    console.error('Error sending event email:', error);
    throw error;
  }
}

// Funciones específicas para cada evento
export async function sendWelcomeEmail(userEmail: string, userName: string) {
  await sendEventEmail({
    event_type: 'user_registered',
    recipient_email: userEmail,
    template_data: {
      user_name: userName,
      app_url: process.env.NEXT_PUBLIC_APP_URL || 'https://app.santiagodelestero.turismo',
      current_year: new Date().getFullYear()
    }
  });
}

export async function sendBusinessRegistrationNotification(businessData: {
  name: string;
  email: string;
  category: string;
  phone: string;
}) {
  // Enviar notificación al admin
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@santiagodelestero.turismo';

  await sendEventEmail({
    event_type: 'business_registered',
    recipient_email: adminEmail,
    template_data: {
      business_name: businessData.name,
      business_email: businessData.email,
      business_category: businessData.category,
      business_phone: businessData.phone,
      admin_url: `${process.env.NEXT_PUBLIC_APP_URL}/admin`,
      current_year: new Date().getFullYear()
    }
  });
}

export async function sendPaymentConfirmationEmail(
  userEmail: string,
  userName: string,
  paymentData: {
    orderId: string;
    amount: number;
    paymentMethod: string;
  }
) {
  await sendEventEmail({
    event_type: 'payment_completed',
    recipient_email: userEmail,
    template_data: {
      user_name: userName,
      order_id: paymentData.orderId,
      amount: paymentData.amount,
      payment_date: new Date().toLocaleDateString('es-ES'),
      payment_method: paymentData.paymentMethod,
      app_url: process.env.NEXT_PUBLIC_APP_URL || 'https://app.santiagodelestero.turismo',
      current_year: new Date().getFullYear()
    }
  });
}

export async function sendBusinessApprovalEmail(
  businessEmail: string,
  businessOwner: string,
  businessName: string
) {
  await sendEventEmail({
    event_type: 'business_approved',
    recipient_email: businessEmail,
    template_data: {
      business_owner: businessOwner,
      business_name: businessName,
      business_dashboard_url: `${process.env.NEXT_PUBLIC_APP_URL}/business/dashboard`,
      current_year: new Date().getFullYear()
    }
  });
}