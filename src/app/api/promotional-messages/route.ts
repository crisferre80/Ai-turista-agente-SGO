// Servidor API para obtener mensajes promocionales traducidos
// GET /api/promotional-messages?locale=es
// Retorna un array de mensajes promocionales en el idioma especificado

import { supabase } from '@/lib/supabase';

// Tipos para mensajes promocionales
interface PromotionalMessage {
  id: string;
  business_name: string;
  message_es: string;
  message_en: string | null;
  message_pt: string | null;
  message_fr: string | null;
  is_active: boolean;
  category: string;
  priority: number;
  show_probability: number;
  created_at: string;
  updated_at: string;
}

interface TranslatedMessage {
  id: string;
  business_name: string;
  message: string;
  category: string;
  priority: number;
  show_probability: number;
  language: string;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const locale = url.searchParams.get('locale') || 'es';
    
    // Validar locale
    if (!['es', 'en', 'pt', 'fr'].includes(locale)) {
      return Response.json(
        { error: 'Locale inválido. Use: es, en, pt, fr' },
        { status: 400 }
      );
    }

    // Obtener mensajes promocionales traducidos
    const { data: messages, error } = await supabase
      .from('promotional_messages_translated')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .order('updated_at', { ascending: false });

    if (error) throw error;

    if (!messages || messages.length === 0) {
      return Response.json({ messages: [] });
    }

    // Mapear mensajes al idioma correspondiente
    const translatedMessages: TranslatedMessage[] = (messages as PromotionalMessage[]).map((msg) => ({
      id: msg.id,
      business_name: msg.business_name,
      message: getMessageForLocale(msg, locale),
      category: msg.category,
      priority: msg.priority,
      show_probability: msg.show_probability,
      language: locale
    }));

    return Response.json({
      messages: translatedMessages,
      locale,
      total: translatedMessages.length,
      timestamp: new Date().toISOString()
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error obtiendo mensajes promocionales:', error);
    return Response.json(
      { error: 'Error obtiendo mensajes promocionales', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * Obtiene el mensaje en el idioma especificado con fallback a español
 */
function getMessageForLocale(msg: PromotionalMessage, locale: string): string {
  switch (locale) {
    case 'en':
      return msg.message_en || msg.message_es;
    case 'pt':
      return msg.message_pt || msg.message_es;
    case 'fr':
      return msg.message_fr || msg.message_es;
    default:
      return msg.message_es;
  }
}
