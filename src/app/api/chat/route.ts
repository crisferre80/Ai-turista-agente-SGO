import { NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/gemini';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Rate limiting: almacenar timestamps de últimas llamadas por usuario
const requestTimestamps = new Map<string, number[]>();
const MAX_REQUESTS_PER_MINUTE = 10;
const TIME_WINDOW_MS = 60000; // 1 minuto

function checkRateLimit(userId: string): { allowed: boolean; remainingRequests: number } {
    const now = Date.now();
    const userRequests = requestTimestamps.get(userId) || [];
    
    // Filtrar requests dentro de la ventana de tiempo
    const recentRequests = userRequests.filter(timestamp => now - timestamp < TIME_WINDOW_MS);
    
    if (recentRequests.length >= MAX_REQUESTS_PER_MINUTE) {
        return { allowed: false, remainingRequests: 0 };
    }
    
    // Agregar nueva request y actualizar
    recentRequests.push(now);
    requestTimestamps.set(userId, recentRequests);
    
    return { allowed: true, remainingRequests: MAX_REQUESTS_PER_MINUTE - recentRequests.length };
}

export async function POST(req: Request) {
    try {
        const { messages, userLocation } = await req.json();

        if (!messages) {
            return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
        }

        // Obtener datos del usuario autenticado
        const authHeader = req.headers.get('Authorization');
        let userProfile = null;
        let userId: string | null = null;

        if (authHeader) {
            try {
                const token = authHeader.replace('Bearer ', '');
                const { data: { user }, error: authError } = await supabase.auth.getUser(token);
                
                if (user && !authError) {
                    userId = user.id;
                    // Obtener perfil del usuario
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('name, bio, preferences, created_at')
                        .eq('id', user.id)
                        .single();
                    
                    if (profile) {
                        userProfile = profile;
                        console.log('👤 Usuario autenticado:', profile.name || user.email);
                    }
                }
            } catch (authErr) {
                console.log('No hay usuario autenticado o token inválido');
            }
        }

        // Rate limiting check - usar userId si existe, sino IP
        const forwardedFor = req.headers.get('x-forwarded-for');
        const userIp = forwardedFor ? forwardedFor.split(',')[0] : 'unknown';
        const rateLimitKey = userId || userIp;
        const rateLimit = checkRateLimit(rateLimitKey);
        
        if (!rateLimit.allowed) {
            return NextResponse.json({ 
                error: 'Demasiadas peticiones. Por favor, espera un momento antes de continuar.',
                reply: '¡Ey, despacio! Estás preguntando muy rápido. Dame un segundito para recuperar el aliento y seguimos charlando.',
                rateLimitExceeded: true
            }, { status: 429 });
        }

        // Detectar consultas de RUTA/DIRECCIONES (prioridad 1)
        const lastMessage = messages[messages.length - 1];
        const routeKeywords = [
            'cómo llegar', 'como llegar', 'cómo llego', 'como llego',
            'cómo voy', 'como voy', 'cómo ir', 'como ir',
            'direcciones a', 'direcciones para', 'ruta a', 'ruta para',
            'camino a', 'camino para', 'indicame como', 'indícame cómo',
            'llévame a', 'llevame a', 'muéstrame la ruta', 'muestrame la ruta',
            'cómo puedo llegar', 'como puedo llegar', 'quiero ir a',
            'navegar a', 'navega a', 'ruta hasta', 'direcciones hasta'
        ];
        
        // Detectar consultas de INFORMACIÓN de lugares (NO rutas)
        const infoKeywords = [
            'dónde puedo', 'donde puedo', 'qué hay', 'que hay',
            'qué me recomiendas', 'que me recomiendas', 'recomendaciones',
            'dónde está', 'donde esta', 'qué lugares', 'que lugares',
            'lugares para', 'sitios para', 'opciones para',
            'información sobre', 'informacion sobre', 'háblame de', 'hablame de',
            'cuéntame sobre', 'cuentame sobre', 'describen', 'describe',
            'conoces algún', 'conoces algun', 'me sugieres', 'sugerencias'
        ];
        
        const isInfoQuery = lastMessage && 
            typeof lastMessage.content === 'string' &&
            infoKeywords.some(keyword => 
                lastMessage.content.toLowerCase().includes(keyword)
            );
        
        const isRouteQuery = lastMessage && 
            typeof lastMessage.content === 'string' &&
            !isInfoQuery && // NO es consulta de información
            routeKeywords.some(keyword => 
                lastMessage.content.toLowerCase().includes(keyword)
            );
        
        // Detectar si el usuario pregunta sobre su ubicación actual
        const locationKeywords = [
            'dónde estoy', 'donde estoy', 'mi ubicación', 'mi ubicacion',
            'ubicación actual', 'ubicacion actual', 'estoy en', 
            'qué lugar es', 'que lugar es', 'qué es este lugar', 'que es este lugar',
            'describe este lugar', 'háblame de donde estoy', 'hablame de donde estoy',
            'información de aquí', 'informacion de aqui', 'sobre esta zona',
            'dónde me encuentro', 'donde me encuentro', 'en qué parte', 'en que parte'
        ];

        const isAskingAboutLocation = lastMessage && 
            typeof lastMessage.content === 'string' &&
            !isRouteQuery && // NO es consulta de ruta
            locationKeywords.some(keyword => 
                lastMessage.content.toLowerCase().includes(keyword)
            );

        // Si pregunta sobre ubicación Y tenemos coordenadas, consultar contexto de ubicación
        if (isAskingAboutLocation && userLocation && userLocation.latitude && userLocation.longitude) {
            try {
                // Llamar al endpoint de contexto de ubicación
                const locationContextUrl = new URL('/api/location-context', req.url);
                const locationResponse = await fetch(locationContextUrl.toString(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        latitude: userLocation.latitude,
                        longitude: userLocation.longitude
                    })
                });

                if (locationResponse.ok) {
                    const locationData = await locationResponse.json();
                    const locationDescription = locationData.description || '';

                    // Retornar directamente la descripción del lugar con datos de OpenAI
                    return NextResponse.json({ 
                        reply: locationDescription,
                        placeId: null,
                        placeName: locationData.locationName || null
                    });
                }
            } catch (locationError) {
                console.error('Error fetching location context:', locationError);
                // Si falla, continuar con el flujo normal
            }
        }

        // 1. Fetch Local Data for Context
        const { data: attractions } = await supabase.from('attractions').select('id, name, description, info_extra, category, lat, lng');
        const { data: businesses } = await supabase.from('businesses').select('id, name, category, website_url, contact_info, lat, lng');
        const { data: videos } = await supabase.from('app_videos').select('id, title, video_url');

        const localContext = `
        INFORMACIÓN LOCAL REGISTRADA (PRIORIDAD ALTA):
        Atractivos: ${JSON.stringify(attractions || [])}
        Negocios/Servicios: ${JSON.stringify(businesses || [])}
        `;

        // Construir información del usuario si está autenticado
        let userContext = '';
        if (userProfile) {
            const userName = userProfile.name || 'turista';
            const userBio = userProfile.bio || '';
            const userPreferences = userProfile.preferences || '';
            const visitNumber = userProfile.created_at ? 
                `Usuario registrado desde ${new Date(userProfile.created_at).toLocaleDateString('es-AR')}` : 
                'Usuario nuevo';
            
            userContext = `
        
        INFORMACIÓN DEL USUARIO (PERSONALIZACIÓN):
        - Nombre: ${userName}
        - ${visitNumber}
        ${userBio ? `- Bio: ${userBio}` : ''}
        ${userPreferences ? `- Preferencias/Intereses: ${userPreferences}` : ''}
        
        IMPORTANTE: Este usuario ya está registrado. Dirígete a él por su nombre (${userName}) de manera natural y amigable.
        NO le preguntes su nombre ni información personal que ya tenés. 
        Usa sus preferencias e intereses para personalizar tus recomendaciones y hacer sugerencias más relevantes.
        Si no tiene preferencias registradas, podés preguntarle sutilmente sobre sus gustos para mejorar las recomendaciones.
        `;
        }

        const systemPrompt = `
    Sos "Santi", un amigable asistente robot turístico de la provincia de Santiago del Estero, Argentina.
    
    Tu personalidad:
    - Alegre, servicial y usas modismos santiagueños sutiles (ej: "chango", "changuito", "changuita").
    - Conoces muy bien la cultura, el folclore, y lugares icónicos.
    ${userProfile ? `- Conoces al usuario: ${userProfile.name || 'turista'}, tratalo con familiaridad y personaliza tus respuestas según sus intereses.` : '- Sos amigable con los visitantes y te gusta conocerlos.'}
    
    INSTRUCCIONES CRÍTICAS:
    1. PRIORIDAD DE DATOS: Antes de usar tu conocimiento general, REVISA SIEMPRE la "INFORMACIÓN LOCAL REGISTRADA" provista arriba.
    2. Si el usuario pregunta por un lugar para comer, dormir o visitar, y ese lugar ESTÁ en la lista local, RECOMIÉNDALO PRIMERO mencionando que es un usuario registrado de la app.
    3. Si NO encuentras algo en la lista local, usa tu conocimiento de la web pero aclara: "Estoy consultando mi base de datos global...".
    4. Siempre fomenta el turismo local y sé muy amable.
    5. Cuando recomiendes un lugar específico de la "INFORMACIÓN LOCAL REGISTRADA", asegúrate de escribir su nombre EXACTAMENTE como figura en la lista para que el sistema pueda encontrarlo y mostrar su ubicación o ruta en el mapa automáticamente.
    6. CRÍTICO - CONSULTAS DE RUTA: Cuando el usuario pregunte "cómo llegar", "direcciones", "cómo voy" a un lugar:
       - Menciona el nombre EXACTO del lugar en tu respuesta una sola vez
       - Di algo breve como: "¡Dale! Te muestro la ruta a [NOMBRE DEL LUGAR] en el mapa."
       - NO describas el lugar, NO des detalles extras, SOLO la confirmación de la ruta
       - El sistema mostrará automáticamente la ruta en el mapa
       - NO menciones coordenadas ni ubicaciones específicas en estos casos
    7. Diferencia entre consultas de INFORMACIÓN (mostrar detalles del lugar) y consultas de RUTA (solo trazar camino)
    8. Sé conversacional pero conciso en consultas de ruta.
    ${userProfile ? `9. PERSONALIZACIÓN: El usuario ya está registrado. Usá su nombre (${userProfile.name}) naturalmente y NO le preguntes información que ya tenés (nombre, edad, origen). Personalizá tus recomendaciones según sus preferencias.` : '9. Si el usuario no está registrado, podés preguntarle su nombre y conocerlo mejor.'}

    Contexto actual de la app:
    ${localContext}
    ${userContext}
    `;

                // Decide provider based on app settings
        const { getAppSettings } = await import('@/lib/getSettings');
        const settings = await getAppSettings();
        const iaProvider = settings?.ia_provider || (process.env.GEMINI_API_KEY ? 'gemini' : 'openai');
        const iaModel = settings?.ia_model || undefined;

        let reply: string;

        if (iaProvider === 'openai') {
            const openai = (await import('@/lib/openai')).default;
            const oaModel = iaModel || process.env.OPENAI_MODEL || 'gpt-4o';

            const response = await openai.chat.completions.create({
                model: oaModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...messages
                ],
                temperature: 0.7
            });

            reply = response.choices[0].message.content || 'Lo siento, no pude generar una respuesta. ¿Podrías intentar de nuevo?';
        } else {
            // Gemini
            try {
                const model = getGeminiModel(iaModel);
                let chatHistory = messages.slice(0, -1).map((msg: { role: string; content: string }) => ({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: msg.content }]
                }));
                
                // Gemini requires chat history to start with a 'user' message
                // If the first message is from 'model', remove it or adjust the history
                if (chatHistory.length > 0 && chatHistory[0].role === 'model') {
                    console.log('Gemini: Removing leading model message to fix history format');
                    chatHistory = chatHistory.slice(1);
                }
                
                // If history is empty or starts with model, ensure we have a valid structure
                const lastUserMessage = messages[messages.length - 1].content;
                const chat = model.startChat({ history: chatHistory, generationConfig: { temperature: 0.7, maxOutputTokens: 1024 } });
                const result = await chat.sendMessage(systemPrompt + '\n\nUsuario: ' + lastUserMessage);
                reply = result.response.text();
            } catch (err) {
                console.error('Gemini error:', err);
                
                // Extract last user message for fallback use
                const lastUserMessage = messages[messages.length - 1].content;
                
                // If it's a model not found error, attempt fallback to a working model
                if ((err as any).message?.includes('not found') || (err as any).message?.includes('404')) {
                    console.log('Model not found, attempting fallback to gemini-1.5-flash');
                    try {
                        const fallbackModel = getGeminiModel('gemini-1.5-flash');
                        // Recreate chatHistory for fallback to ensure it's valid
                        let fallbackChatHistory = messages.slice(0, -1).map((msg: { role: string; content: string }) => ({
                            role: msg.role === 'assistant' ? 'model' : 'user',
                            parts: [{ text: msg.content }]
                        }));
                        
                        // Ensure fallback history also starts with 'user'
                        if (fallbackChatHistory.length > 0 && fallbackChatHistory[0].role === 'model') {
                            console.log('Gemini fallback: Removing leading model message to fix history format');
                            fallbackChatHistory = fallbackChatHistory.slice(1);
                        }
                        
                        const chat = fallbackModel.startChat({ 
                            history: fallbackChatHistory, 
                            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 } 
                        });
                        const result = await chat.sendMessage(systemPrompt + '\n\nUsuario: ' + lastUserMessage);
                        reply = result.response.text();
                        console.log('Fallback model successful, consider updating admin settings');
                    } catch (fallbackErr) {
                        console.error('Fallback model also failed:', fallbackErr);
                        throw new Error(`El modelo de IA configurado no está disponible. Por favor, actualiza la configuración en el panel de administración. Modelos recomendados: gemini-1.5-flash, gemini-1.5-pro`);
                    }
                } else {
                    // For other errors, attempt to suggest available models to the admin
                    try {
                        const genAI = (await import('@/lib/gemini')).default as any;
                        let models: any[] = [];
                        if (typeof genAI.listModels === 'function') {
                            const lm = await genAI.listModels();
                            models = lm?.models || [];
                        } else {
                            const apiKey = process.env.GEMINI_API_KEY;
                            if (apiKey) {
                                const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models', { headers: { Authorization: `Bearer ${apiKey}` } });
                                if (r.ok) {
                                    const data = await r.json();
                                    models = data?.models || [];
                                }
                            }
                        }
                        const modelNames = models.map(m => m.name).slice(0, 50);
                        throw new Error(`[GoogleGenerativeAI Error]: ${(err as Error).message}. Available models: ${modelNames.join(', ')}`);
                    } catch (innerErr) {
                        throw err;
                    }
                }
            }
        }
        
        // Detect if a specific place is mentioned in the reply
        let placeId: string | null = null;
        let placeName = null;
        let placeDescription = null;
        let isRouteOnly = false; // Flag para indicar que solo se debe mostrar ruta
        
        // Debug: Log what type of query was detected
        if (isInfoQuery) {
            console.log('ℹ️  INFO query detected:', lastMessage.content);
        }
        
        // Si es consulta de ruta, marcar como tal pero SÍ extraer placeName para trazar ruta
        if (isRouteQuery) {
            isRouteOnly = true;
            console.log('🗺️  ROUTE query detected:', lastMessage.content);
            console.log('Route query detected, extracting placeName but not setting placeId');
            
            // Buscar el nombre del lugar en la respuesta de la IA
            if (reply) {
                // Check attractions first
                for (const attraction of (attractions || [])) {
                    const name = attraction.name as string;
                    // Case-insensitive partial match
                    if (reply.toLowerCase().includes(name.toLowerCase())) {
                        placeName = name;
                        console.log('Place found for route:', placeName);
                        break;
                    }
                }
                
                // If not found in attractions, check businesses
                if (!placeName) {
                    for (const business of (businesses || [])) {
                        const name = business.name as string;
                        if (reply.toLowerCase().includes(name.toLowerCase())) {
                            placeName = name;
                            console.log('Business found for route:', placeName);
                            break;
                        }
                    }
                }
            }
        } else if (reply) {
            // Solo buscar placeId si NO es consulta de ruta
            // Check attractions first
            for (const attraction of (attractions || [])) {
                const name = attraction.name as string;
                // Case-insensitive partial match
                if (reply.toLowerCase().includes(name.toLowerCase())) {
                    placeId = attraction.id;
                    placeName = name;
                    break;
                }
            }
            
            // If not found in attractions, check businesses
            if (!placeId) {
                for (const business of (businesses || [])) {
                    const name = business.name as string;
                    if (reply.toLowerCase().includes(name.toLowerCase())) {
                        placeId = business.id;
                        placeName = name;
                        break;
                    }
                }
            }
            
            // Get description if place found
            if (placeId) {
                const attraction = attractions?.find(a => a.id === placeId);
                if (attraction) {
                    placeDescription = attraction.description || `Descubre ${attraction.name}, un atractivo en la categoría ${attraction.category}.`;
                } else {
                    const business = businesses?.find(b => b.id === placeId);
                    if (business) {
                        placeDescription = `Conoce ${business.name}, un negocio en la categoría ${business.category}.`;
                    }
                }
            }
        }
        
        // Buscar video relevante basado en el contenido del mensaje del usuario y la respuesta
        let relevantVideo = null;
        if (!isRouteOnly) {
            const searchText = (lastMessage?.content + ' ' + reply).toLowerCase();
            
            // Normalizar texto para búsqueda (remover acentos y caracteres especiales)
            const normalizeText = (text: string) => {
                return text
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .toLowerCase()
                    .replace(/[^a-z0-9\s]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
            };
            
            const normalizedSearch = normalizeText(searchText);
            
            // Palabras comunes que no deben contar como coincidencias significativas
            const commonWords = new Set(['de', 'del', 'la', 'el', 'en', 'los', 'las', 'un', 'una', 'con', 'por', 'para', 'santiago', 'estero']);
            
            let bestMatch: { video: typeof videos[0], score: number } | null = null;
            
            // Buscar coincidencias en títulos de videos locales
            if (videos && videos.length > 0) {
                for (const video of videos) {
                    const normalizedTitle = normalizeText(video.title);
                    const titleWords = normalizedTitle.split(/\s+/).filter(w => w.length > 2 && !commonWords.has(w));
                    const searchWords = normalizedSearch.split(/\s+/).filter(w => w.length > 2 && !commonWords.has(w));
                    
                    // Contar palabras coincidentes exactas y parciales
                    let exactMatches = 0;
                    let partialMatches = 0;
                    
                    for (const titleWord of titleWords) {
                        for (const searchWord of searchWords) {
                            if (titleWord === searchWord) {
                                exactMatches++;
                            } else if (titleWord.length > 4 && searchWord.length > 4) {
                                // Para palabras largas, permitir coincidencias parciales
                                if (titleWord.includes(searchWord) || searchWord.includes(titleWord)) {
                                    partialMatches++;
                                }
                            }
                        }
                    }
                    
                    // Calcular score: exactas valen más que parciales
                    const score = (exactMatches * 2) + partialMatches;
                    
                    // Guardar mejor match
                    if (score >= 3 && (!bestMatch || score > bestMatch.score)) {
                        bestMatch = { video, score };
                    }
                }
            }
            
            // Si encontramos video local, usarlo
            if (bestMatch) {
                relevantVideo = {
                    id: bestMatch.video.id,
                    title: bestMatch.video.title,
                    url: bestMatch.video.video_url
                };
                console.log(`📹 Video local encontrado: "${bestMatch.video.title}" (score: ${bestMatch.score})`);
            } else {
                // Si no hay video local, detectar si la consulta es sobre un evento/tema que podría tener video
                const videoKeywords = [
                    'video', 'ver', 'muestra', 'muéstrame', 'mostrame', 'mira',
                    'marcha', 'festival', 'evento', 'fiesta', 'celebración', 'celebracion',
                    'baile', 'danza', 'música', 'musica', 'folklore', 'folclore',
                    'bombos', 'chacarera', 'carnaval', 'procesión', 'procesion'
                ];
                
                const hasVideoIntent = videoKeywords.some(keyword => 
                    normalizedSearch.includes(keyword)
                );
                
                // Si la consulta sugiere búsqueda de video, buscar en YouTube usando la API
                if (hasVideoIntent) {
                    try {
                        // Extraer términos relevantes para la búsqueda
                        const searchWords = normalizedSearch
                            .split(/\s+/)
                            .filter(w => w.length > 3 && !commonWords.has(w))
                            .slice(0, 5); // Tomar máximo 5 palabras relevantes
                        
                        const youtubeSearchQuery = `${searchWords.join(' ')} Santiago del Estero`;
                        console.log(`🔍 Buscando en YouTube: "${youtubeSearchQuery}"`);
                        
                        // Usar YouTube Data API v3 para buscar videos
                        const youtubeApiKey = process.env.GOOGLE_TTS_API_KEY || process.env.GEMINI_API_KEY;
                        if (!youtubeApiKey) {
                            console.warn('No YouTube API key available');
                        } else {
                            const youtubeResponse = await fetch(
                                `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(youtubeSearchQuery)}&type=video&key=${youtubeApiKey}`,
                                { method: 'GET' }
                            );
                            
                            if (youtubeResponse.ok) {
                                const youtubeData = await youtubeResponse.json();
                                console.log('YouTube API response:', youtubeData);
                                
                                if (youtubeData.items && youtubeData.items.length > 0) {
                                    const firstVideo = youtubeData.items[0];
                                    const videoId = firstVideo.id.videoId;
                                    const videoTitle = firstVideo.snippet.title;
                                    const embedUrl = `https://www.youtube.com/embed/${videoId}`;
                                    
                                    relevantVideo = {
                                        id: videoId,
                                        title: videoTitle,
                                        url: embedUrl,
                                        isYouTube: true
                                    };
                                    console.log(`📹 Video de YouTube encontrado: "${videoTitle}" (${videoId})`);
                                }
                            } else {
                                console.warn('YouTube API error:', youtubeResponse.status, await youtubeResponse.text());
                            }
                        }
                    } catch (youtubeError) {
                        console.error('Error buscando en YouTube:', youtubeError);
                    }
                }
            }
        }
        
        return NextResponse.json({ 
            reply, 
            placeId, 
            placeName, 
            placeDescription,
            isRouteOnly,
            relevantVideo,
            remainingRequests: rateLimit.remainingRequests
        });

    } catch (error) {
        console.error('Error in chat route:', error);
        const message = error instanceof Error ? error.message : String(error);
        const payload: any = { error: true, message };
        if (process.env.NODE_ENV !== 'production' && error instanceof Error) payload.stack = error.stack;
        return NextResponse.json(payload, { status: 500 });
    }
}
