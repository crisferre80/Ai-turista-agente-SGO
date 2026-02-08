/**
 * Helper functions para disparar notificaciones de email automáticas
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

type NotificationPayload = Record<string, string>;

interface NotificationData {
    type: 'welcome' | 'new_business' | 'new_feature' | 'new_story' | 'reminder';
    data: NotificationPayload;
    recipientEmail?: string;
}

/**
 * Envía una notificación de email
 */
async function sendNotification(notification: NotificationData): Promise<boolean> {
    try {
        const response = await fetch(`${APP_URL}/api/email/notify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(notification)
        });

        const result = await response.json();
        return result.success;
    } catch (error) {
        console.error('Error enviando notificación:', error);
        return false;
    }
}

/**
 * Email de bienvenida cuando un usuario se registra
 */
export async function sendWelcomeEmail(userEmail: string, userName: string) {
    return sendNotification({
        type: 'welcome',
        data: {
            name: userName,
            email: userEmail
        },
        recipientEmail: userEmail
    });
}

/**
 * Notificación cuando se registra un nuevo negocio
 */
export async function notifyNewBusiness(business: {
    id: string;
    name: string;
    category: string;
    description?: string;
    location?: string;
}) {
    return sendNotification({
        type: 'new_business',
        data: {
            id: business.id,
            name: business.name,
            category: business.category,
            description: business.description || '',
            location: business.location || 'Santiago del Estero'
        }
    });
}

/**
 * Notificación cuando se agrega una nueva función a la app
 */
export async function notifyNewFeature(feature: {
    name: string;
    description: string;
    url?: string;
}) {
    return sendNotification({
        type: 'new_feature',
        data: {
            name: feature.name,
            description: feature.description,
            url: feature.url || APP_URL
        }
    });
}

/**
 * Notificación cuando se crea un nuevo relato
 */
export async function notifyNewStory(story: {
    id: string;
    title: string;
    excerpt?: string;
}) {
    return sendNotification({
        type: 'new_story',
        data: {
            id: story.id,
            title: story.title,
            excerpt: story.excerpt || ''
        }
    });
}

/**
 * Enviar recordatorio personalizado
 */
export async function sendReminder(data: {
    message: string;
    actionUrl?: string;
    recipientEmail?: string;
}) {
    return sendNotification({
        type: 'reminder',
        data: {
            message: data.message,
            action_url: data.actionUrl || APP_URL
        },
        recipientEmail: data.recipientEmail
    });
}

// Exportar todas las funciones
export const emailNotifications = {
    sendWelcomeEmail,
    notifyNewBusiness,
    notifyNewFeature,
    notifyNewStory,
    sendReminder
};

export default emailNotifications;
