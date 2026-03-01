/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/gemini';
import { createClient } from '@supabase/supabase-js';

// helper to pick localized description from DB objects
const getLocaleDesc = (obj: any, locale: string) => {
    if (!obj) return '';
    console.log('🌍 getLocaleDesc called:', { 
        locale, 
        name: obj.name,
        hasDescriptionEn: !!obj.description_en,
        hasDescriptionPt: !!obj.description_pt,
        hasDescriptionFr: !!obj.description_fr,
        hasDescription: !!obj.description
    });
    
    if (locale === 'en' && obj.description_en) {
        console.log('✅ Returning EN description for:', obj.name);
        return obj.description_en;
    }
    if (locale === 'pt' && obj.description_pt) {
        console.log('✅ Returning PT description for:', obj.name);
        return obj.description_pt;
    }
    if (locale === 'fr' && obj.description_fr) {
        console.log('✅ Returning FR description for:', obj.name);
        return obj.description_fr;
    }
    console.log('⚠️ Using default ES description for:', obj.name);
    return obj.description || '';
};

// Helper to localize fallback messages
const getLocalizedFallback = (type: 'attraction' | 'business', name: string, category: string, locale: string) => {
    const messages = {
        attraction: {
            es: `Descubre ${name}, un atractivo en la categoría ${category}.`,
            en: `Discover ${name}, an attraction in the ${category} category.`,
            pt: `Descubra ${name}, uma atração na categoria ${category}.`,
            fr: `Découvrez ${name}, une attraction dans la catégorie ${category}.`
        },
        business: {
            es: `Conoce ${name}, un negocio en la categoría ${category}.`,
            en: `Meet ${name}, a business in the ${category} category.`,
            pt: `Conheça ${name}, um negócio na categoria ${category}.`,
            fr: `Découvrez ${name}, une entreprise dans la catégorie ${category}.`
        }
    };
    return messages[type][locale as keyof typeof messages.attraction] || messages[type].es;
};

// Helper to localize greetings
const getLocalizedGreeting = (name: string, locale: string) => {
    const greetings = {
        es: `¡Hola, chango! Te cuento sobre **${name}**.`,
        en: `Hello! Let me tell you about **${name}**.`,
        pt: `Olá! Deixe-me falar sobre **${name}**.`,
        fr: `Bonjour! Laissez-moi vous parler de **${name}**.`
    };
    return greetings[locale as keyof typeof greetings] || greetings.es;
};

// Helper to localize recommendation
const getLocalizedRecommendation = (name: string, category: string, locale: string) => {
    const recommendations = {
        es: `¡Hola! Te recomiendo **${name}**, un lugar en la categoría ${category}.`,
        en: `Hello! I recommend **${name}**, a place in the ${category} category.`,
        pt: `Olá! Recomendo **${name}**, um lugar na categoria ${category}.`,
        fr: `Bonjour! Je recommande **${name}**, un lieu dans la catégorie ${category}.`
    };
    return recommendations[locale as keyof typeof recommendations] || recommendations.es;
};

// Helper to localize contact label
const getLocalizedContact = (locale: string) => {
    const labels = {
        es: 'Contacto:',
        en: 'Contact:',
        pt: 'Contato:',
        fr: 'Contact :'
    };
    return labels[locale as keyof typeof labels] || labels.es;
};

const supabaseBase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
);

const getRequestSupabase = (jwt?: string) => {
    if (!jwt) return supabaseBase;
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            auth: { persistSession: false },
            global: {
                headers: {
                    Authorization: `Bearer ${jwt}`,
                },
            },
        }
    );
};

// Rate limiting: almacenar timestamps de últimas llamadas por usuario
const requestTimestamps = new Map<string, number[]>();
const MAX_REQUESTS_PER_MINUTE = 20; // Aumentado de 10 a 20
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
        const { messages, userLocation, locale: reqLocale } = await req.json();
        const locale = reqLocale || 'es'; // default to spanish if missing
        
        console.log('🌐 Chat API received request with locale:', locale, 'reqLocale:', reqLocale);

        if (!messages) {
            return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
        }

        // Obtener datos del usuario autenticado
        const authHeader = req.headers.get('Authorization');
        let userProfile = null;
        let userId: string | null = null;

        const requestJwt = authHeader ? authHeader.replace('Bearer ', '') : undefined;
        const supabase = getRequestSupabase(requestJwt);

        if (requestJwt) {
            try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
                
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
            } catch {
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
        
        let isInfoQuery = lastMessage && 
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
        console.log('🔍 Fetching data from Supabase...');
        const { data: attractions, error: attractionsError } = await supabase.from('attractions').select('id, name, description, info_extra, category, lat, lng, video_urls');
        const { data: businesses, error: businessesError } = await supabase.from('businesses').select('id, name, category, website_url, contact_info, lat, lng');
        const { data: videos } = await supabase.from('app_videos').select('id, title, video_url');

        // Debug logging
        console.log('📊 Attractions fetched:', {
            count: attractions?.length || 0,
            error: attractionsError,
            sample: attractions?.slice(0, 2)
        });
        console.log('🏢 Businesses fetched:', {
            count: businesses?.length || 0,
            error: businessesError,
            sample: businesses?.slice(0, 2)
        });

        // ============================================================
        // PASO 1: BUSCAR DIRECTAMENTE EN LA BASE DE DATOS LOCAL
        // Antes de llamar a Gemini, intentar encontrar un lugar en la BD
        // ============================================================
        
        const userQuery = lastMessage?.content?.toLowerCase() || '';
        
        console.log('🔍 PASO 1: Buscando en BD local antes de usar Gemini...');
        console.log('📝 Consulta del usuario:', userQuery);
        
        // Función para normalizar texto (remover acentos y caracteres especiales)
        const normalizeText = (text: string) => {
            return text
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        };
        
        const normalizedQuery = normalizeText(userQuery);
        
        // Extraer palabras clave significativas (más de 3 letras)
        const commonWords = new Set(['donde', 'puedo', 'quiero', 'como', 'cual', 'para', 'con', 'sin', 'sobre', 'desde', 'hasta', 'entre', 'hay', 'esta', 'son', 'tiene', 'hacer', 'lugar', 'lugares', 'sitio', 'sitios', 'conocer', 'ver', 'visitar', 'que', 'del', 'las', 'los', 'una', 'uno']);
        const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 3 && !commonWords.has(w));
        
        console.log('🔑 Palabras clave extraídas:', queryWords.join(', '));
        
        // Buscar coincidencias en attractions
        let foundPlace = null;
        let foundPlaceType = null;
        let bestScore = 0;
        
        if (attractions && attractions.length > 0) {
            for (const attraction of attractions) {
                const name = normalizeText(attraction.name as string);
                const description = normalizeText((attraction.description as string) || '');
                const category = normalizeText((attraction.category as string) || '');
                
                let score = 0;
                
                // Coincidencia exacta en el nombre (máxima prioridad)
                if (name === normalizedQuery) {
                    score = 100;
                } else {
                    // Contar cuántas palabras clave coinciden
                    for (const word of queryWords) {
                        if (name.includes(word)) score += 10;
                        if (description.includes(word)) score += 3;
                        if (category.includes(word)) score += 5;
                    }
                }
                
                if (score > bestScore) {
                    bestScore = score;
                    foundPlace = attraction;
                    foundPlaceType = 'attraction';
                }
            }
        }
        
        // Buscar en businesses si no encontró buena coincidencia en attractions
        if (bestScore < 10 && businesses && businesses.length > 0) {
            for (const business of businesses) {
                const name = normalizeText(business.name as string);
                const category = normalizeText((business.category as string) || '');
                
                let score = 0;
                
                if (name === normalizedQuery) {
                    score = 100;
                } else {
                    for (const word of queryWords) {
                        if (name.includes(word)) score += 10;
                        if (category.includes(word)) score += 5;
                    }
                }
                
                if (score > bestScore) {
                    bestScore = score;
                    foundPlace = business;
                    foundPlaceType = 'business';
                }
            }
        }
        
        console.log(`🎯 Mejor coincidencia: ${foundPlace ? (foundPlace.name as string) : 'NINGUNA'} (score: ${bestScore})`);
        
        // Si encontramos un lugar con suficiente confianza (score >= 5), responder directamente sin Gemini
        let reply: string = '';
        let placeId: string | null = null;
        let placeName: string | null = null;
        let placeDescription: string | null = null;
        let skipGemini = false;
        
        if (foundPlace && bestScore >= 5) {
            console.log('✅ Lugar encontrado en BD local:', foundPlace.name);
            placeId = foundPlace.id;
            placeName = foundPlace.name as string;
            skipGemini = true;
            
            // Generar respuesta simple sobre el lugar encontrado
            if (foundPlaceType === 'attraction') {
                const attraction = foundPlace as any;
                placeDescription = getLocaleDesc(attraction, locale) || getLocalizedFallback('attraction', placeName, attraction.category, locale);
                console.log('📝 Generated placeDescription for attraction:', {
                    name: placeName,
                    locale,
                    descriptionPreview: placeDescription?.substring(0, 100) || 'N/A'
                });
                reply = `${getLocalizedGreeting(placeName, locale)}\n\n${placeDescription}`;
            } else {
                const business = foundPlace as any;
                placeDescription = getLocaleDesc(business, locale) || getLocalizedFallback('business', placeName, business.category, locale);
                console.log('📝 Generated placeDescription for business:', {
                    name: placeName,
                    locale,
                    descriptionPreview: placeDescription?.substring(0, 100) || 'N/A'
                });
                const contactInfo = business.contact_info;
                reply = getLocalizedRecommendation(placeName, business.category, locale);
                if (contactInfo) {
                    reply += `\n\n${getLocalizedContact(locale)} ${contactInfo}`;
                }
            }
            
            console.log('💬 Respuesta generada desde BD local (sin Gemini)');
        } else {
            console.log('❌ No se encontró lugar en BD local, usando Gemini para búsqueda global...');
        }
        
        // ============================================================
        // PASO 2: SI NO ENCONTRÓ EN BD LOCAL, USAR GEMINI
        // ============================================================
        
        if (!skipGemini) {

        // Format data in a more readable way for the AI
        const formatAttractions = (attractions || []).map((a: any) => 
            `- ${a.name} (${a.category}): ${a.description || 'Atractivo turístico'}${a.info_extra ? ` - ${a.info_extra}` : ''}`
        ).join('\n');
        
        const formatBusinesses = (businesses || []).map((b: any) => 
            `- ${b.name} (${b.category})${b.contact_info ? `: ${b.contact_info}` : ''}${b.website_url ? ` - Web: ${b.website_url}` : ''}`
        ).join('\n');

        const localContext = `
        INFORMACIÓN LOCAL REGISTRADA (PRIORIDAD ALTA):
        
        ATRACTIVOS TURÍSTICOS:
        ${formatAttractions || 'No hay atractivos registrados'}
        
        NEGOCIOS Y SERVICIOS:
        ${formatBusinesses || 'No hay negocios registrados'}
        
        IMPORTANTE: Cuando recomiendes cualquiera de estos lugares, usa el nombre EXACTO como aparece arriba.
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

        // Map locale to language instruction
        const languageInstructions: Record<string, string> = {
            es: 'Responde SIEMPRE en ESPAÑOL de Argentina, usando modismos locales cuando sea natural.',
            en: 'Respond ALWAYS in ENGLISH. Be friendly and clear in English, avoid Spanish words.',
            pt: 'Responda SEMPRE em PORTUGUÊS brasileiro. Seja amigável e claro em português.',
            fr: 'Répondez TOUJOURS en FRANÇAIS. Soyez amical et clair en français.'
        };
        const languageInstruction = languageInstructions[locale] || languageInstructions.es;

        // Localized fallback messages
        const fallbackMessages: Record<string, string> = {
            es: 'Lo siento, no pude generar una respuesta. ¿Podrías intentar de nuevo?',
            en: 'Sorry, I could not generate a response. Could you try again?',
            pt: 'Desculpe, não consegui gerar uma resposta. Você poderia tentar novamente?',
            fr: 'Désolé, je n\'ai pas pu générer une réponse. Pourriez-vous réessayer?'
        };
        const fallbackMessage = fallbackMessages[locale] || fallbackMessages.es;

        const systemPrompt = `
    You are "Santi", a friendly robot tourist assistant for the province of Santiago del Estero, Argentina.
    
    CRITICAL LANGUAGE INSTRUCTION:
    ${languageInstruction}
    
    Your personality:
    - Cheerful, helpful, and you use subtle Santiago expressions when speaking Spanish (e.g., "chango", "changuito", "changuita").
    - You know the culture, folklore, and iconic places very well.
    ${userProfile ? `- You know the user: ${userProfile.name || 'turista'}, treat them familiarly and personalize your answers based on their interests.` : '- You are friendly with visitors and like to get to know them.'}
    
    CRITICAL INSTRUCTIONS:
    1. PRIORITY OF DATA: Before using your general knowledge, ALWAYS CHECK the "LOCAL REGISTERED INFORMATION" provided above.
    2. PLACES FOR MATE, RELAX, NATURE: When asked about places to drink mate, relax, enjoy nature, etc., recommend ONLY TOURIST ATTRACTIONS (plazas, parks, ecological reserves, natural spaces) - NEVER businesses for these activities.
    3. If the user asks for commercial services (eating, sleeping, shopping), then recommend both attractions and businesses as appropriate.
    4. If you find places in the local list that match the query, RECOMMEND THEM FIRST mentioning they are registered in the app.
    5. If you DON'T find something in the local list, use your web knowledge but clarify: "I'm consulting my global database...".
    6. Always promote local tourism and be very friendly.
    7. When recommending a specific place from "LOCAL REGISTERED INFORMATION", make sure to write its name EXACTLY as it appears in the list so the system can find it and show its location or route on the map automatically.
    8. CRITICAL - ROUTE QUERIES: When the user asks "how to get", "directions", "how do I go" to a place:
       - Mention the EXACT name of the place in your answer only once
       - Say something brief like: "Sure! I'll show you the route to [PLACE NAME] on the map."
       - DON'T describe the place, DON'T give extra details, ONLY the route confirmation
       - The system will automatically show the route on the map
       - DON'T mention coordinates or specific locations in these cases
    9. Differentiate between INFORMATION queries (show place details) and ROUTE queries (only draw path)
    10. Be conversational but brief for route queries.
    11. VIDEO SEARCH: When the user asks to see videos, show videos, or asks about events/shows (e.g., "marcha de los bombos", "carnival", "chacarera", "MotoGP", "football", etc.):
       - ALWAYS respond that you're searching for videos on YouTube
       - Say something like: "Sure! I'm searching for videos about [TOPIC] on YouTube..."
       - DON'T say you can't show videos
       - The system will automatically search and show a list of videos for the user to choose from
       - Be enthusiastic about the results you're going to show
    ${userProfile ? `12. PERSONALIZATION: The user is already registered. Use their name (${userProfile.name}) naturally and DON'T ask for information you already have (name, age, origin). Personalize your recommendations based on their preferences.` : '12. If the user is not registered, you can ask their name and get to know them better.'}

    Current app context:
    ${localContext}
    ${userContext}
    `;

                // Decide provider based on app settings
        const { getAppSettings } = await import('@/lib/getSettings');
        const settings = await getAppSettings();
        const iaProvider = settings?.ia_provider || (process.env.GEMINI_API_KEY ? 'gemini' : 'openai');
        const iaModel = settings?.ia_model || undefined;

        // NOTE: reply ya está declarado arriba (línea 295), NO redeclarar aquí
        if (!reply) reply = ''; // Solo inicializar si aún está vacío

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

            reply = response.choices[0].message.content || fallbackMessage;
            console.log('✅ OpenAI response:', reply.substring(0, 100));
        } else {
            // Gemini
            try {
                const model = getGeminiModel(iaModel);
                
                // Filter out system messages and map to Gemini format
                let chatHistory = messages.slice(0, -1)
                    .filter((msg: { role: string; content: string }) => msg.role !== 'system')
                    .map((msg: { role: string; content: string }) => ({
                        role: msg.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: msg.content }]
                    }));
                
                // Gemini requires chat history to start with a 'user' message
                // Remove any leading 'model' messages
                while (chatHistory.length > 0 && chatHistory[0].role === 'model') {
                    console.log('Gemini: Removing leading model message to fix history format');
                    chatHistory = chatHistory.slice(1);
                }
                
                // Ensure alternating user/model pattern by removing consecutive same-role messages
                const validHistory = [];
                let lastRole = '';
                for (const msg of chatHistory) {
                    if (msg.role !== lastRole) {
                        validHistory.push(msg);
                        lastRole = msg.role;
                    }
                }
                
                // Limitar historial a los últimos 10 mensajes (5 intercambios user/model)
                // para evitar que el contexto sea muy largo y se agote maxOutputTokens
                const maxHistoryMessages = 10;
                const limitedHistory = validHistory.length > maxHistoryMessages 
                    ? validHistory.slice(-maxHistoryMessages) 
                    : validHistory;
                console.log(`📜 Historia: ${validHistory.length} mensajes totales, usando últimos ${limitedHistory.length}`);
                
                const lastUserMessage = messages[messages.length - 1].content;
                
                // Include system prompt in the first user message if history is empty
                const messageToSend = limitedHistory.length === 0 
                    ? `${systemPrompt}\n\nUsuario: ${lastUserMessage}`
                    : lastUserMessage;
                
                const chat = model.startChat({ 
                    history: limitedHistory, 
                    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
                });
                const result = await chat.sendMessage(messageToSend);
                
                // Debug: Inspeccionar el resultado completo
                console.log('🔍 Gemini result object:', {
                    hasResponse: !!result.response,
                    hasText: typeof result.response?.text === 'function',
                    candidatesLength: result.response?.candidates?.length || 0,
                    finishReason: result.response?.candidates?.[0]?.finishReason || 'unknown'
                });
                
                reply = result.response.text();
                console.log('✅ Gemini response length:', reply?.length || 0, 'Preview:', reply?.substring(0, 100));
                
                // Si la respuesta está vacía, intentar obtener el texto directamente
                if (!reply || reply.trim().length === 0) {
                    console.warn('⚠️ Gemini returned empty response, checking candidates...');
                    const candidate = result.response?.candidates?.[0];
                    if (candidate) {
                        console.log('Candidate:', {
                            finishReason: candidate.finishReason,
                            hasContent: !!candidate.content,
                            partsLength: candidate.content?.parts?.length || 0
                        });
                        // Intentar extraer texto de las partes
                        if (candidate.content?.parts && candidate.content.parts.length > 0) {
                            reply = candidate.content.parts.map((p: any) => p.text || '').join('');
                            console.log('Extracted reply from parts:', reply.substring(0, 100));
                        }
                    }
                }
            } catch (err) {
                console.error('❌ Gemini error:', err);
                
                // Extract last user message for fallback use
                const lastUserMessage = messages[messages.length - 1].content;
                
                // Check if it's a rate limit error (429) - fallback to OpenAI
                if ((err as any).message?.includes('429') || (err as any).message?.includes('Too Many Requests') || (err as any).message?.includes('Resource exhausted')) {
                    console.log('⚠️ Gemini rate limit exceeded, falling back to OpenAI');
                    try {
                        const openai = (await import('@/lib/openai')).default;
                        const oaModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';

                        const response = await openai.chat.completions.create({
                            model: oaModel,
                            messages: [
                                { role: 'system', content: systemPrompt },
                                ...messages
                            ],
                            temperature: 0.7
                        });

                        reply = response.choices[0].message.content || fallbackMessage;
                        console.log('✅ OpenAI fallback successful');
                    } catch (openaiErr) {
                        console.error('OpenAI fallback also failed:', openaiErr);
                        throw new Error('Los servicios de IA están temporalmente sobrecargados. Por favor, intenta de nuevo en unos segundos.');
                    }
                } else if ((err as any).message?.includes('not found') || (err as any).message?.includes('404')) {
                    // If it's a model not found error, attempt fallback to a working model
                    console.log('Model not found, attempting fallback to gemini-1.5-flash');
                    try {
                        const fallbackModel = getGeminiModel('gemini-1.5-flash');
                        
                        // Recreate chatHistory for fallback using same validation logic
                        let fallbackChatHistory = messages.slice(0, -1)
                            .filter((msg: { role: string; content: string }) => msg.role !== 'system')
                            .map((msg: { role: string; content: string }) => ({
                                role: msg.role === 'assistant' ? 'model' : 'user',
                                parts: [{ text: msg.content }]
                            }));
                        
                        // Remove leading 'model' messages
                        while (fallbackChatHistory.length > 0 && fallbackChatHistory[0].role === 'model') {
                            fallbackChatHistory = fallbackChatHistory.slice(1);
                        }
                        
                        // Ensure alternating pattern
                        const validFallbackHistory = [];
                        let lastRole = '';
                        for (const msg of fallbackChatHistory) {
                            if (msg.role !== lastRole) {
                                validFallbackHistory.push(msg);
                                lastRole = msg.role;
                            }
                        }
                        
                        // Limitar historial a los últimos 10 mensajes
                        const maxHistoryMessages = 10;
                        const limitedFallbackHistory = validFallbackHistory.length > maxHistoryMessages 
                            ? validFallbackHistory.slice(-maxHistoryMessages) 
                            : validFallbackHistory;
                        
                        // Include system prompt in first message if needed
                        const messageToSend = limitedFallbackHistory.length === 0 
                            ? `${systemPrompt}\n\nUsuario: ${lastUserMessage}`
                            : lastUserMessage;
                        
                        const chat = fallbackModel.startChat({ 
                            history: limitedFallbackHistory, 
                            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
                        });
                        const result = await chat.sendMessage(messageToSend);
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
                    } catch {
                        throw err;
                    }
                }
            }
        }
        } // Cierre del if (!skipGemini) - TERMINA BÚSQUEDA EN GEMINI
        
        // ============================================================
        // PASO 3: IDENTIFICAR LUGAR EN LA RESPUESTA (SOLO SI NO SE ENCONTRÓ EN BD LOCAL)
        // ============================================================
        
        // Si no encontramos lugar en BD local, intentar extraerlo de la respuesta de Gemini
        if (!placeId && reply) {
            console.log('🔍 Lugar no encontrado en BD local, intentando extraer de respuesta de Gemini...');
            
            // Buscar el nombre del lugar en la respuesta de la IA
            for (const attraction of (attractions || [])) {
                const name = attraction.name as string;
                if (reply.toLowerCase().includes(name.toLowerCase())) {
                    placeId = attraction.id;
                    placeName = name;
                    console.log(`📍 Lugar identificado en respuesta de Gemini: "${placeName}" (ID: ${placeId})`);
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
                        console.log(`🏢 Negocio identificado en respuesta de Gemini: "${placeName}" (ID: ${placeId})`);
                        break;
                    }
                }
            }
            
            // Get description if place found
            if (placeId && !placeDescription) {
                const attraction = attractions?.find(a => a.id === placeId);
                if (attraction) {
                    placeDescription = getLocaleDesc(attraction, locale) || getLocalizedFallback('attraction', attraction.name, attraction.category, locale);
                } else {
                    const business = businesses?.find(b => b.id === placeId);
                    if (business) {
                        placeDescription = getLocaleDesc(business, locale) || getLocalizedFallback('business', business.name, business.category, locale);
                    }
                }
            }
        }
        
        // Variables para control de flujo
        let isRouteOnly = false;
        
        // Detectar si el usuario pregunta explícitamente por videos/imágenes
        const userMessage = lastMessage?.content?.toLowerCase() || '';
        const isVideoRequest = /\b(video|videos|ver video|mostrame video|muestra video|quiero ver|imagen|imagenes|foto|fotos|ver fotos)\b/.test(userMessage);
        
        // Debug: Log what type of query was detected
        if (isInfoQuery) {
            console.log('ℹ️  INFO query detected:', lastMessage.content);
        }
        
        if (isVideoRequest) {
            console.log('🎥 VIDEO/IMAGEN request detected, will search YouTube');
        }
        
        // Si es consulta de ruta, marcar como tal
        if (isRouteQuery) {
            isRouteOnly = true;
            console.log('🗺️  ROUTE query detected:', lastMessage.content);
        }
        
        // IMPORTANTE: Si encontramos un lugar específico en la BD, 
        // NO es una consulta informativa genérica, debe mostrar la card
        if (placeId && isInfoQuery) {
            console.log('✅ Lugar específico encontrado, cambiando isInfoQuery de true → false para mostrar card');
            isInfoQuery = false;
        }
        
        // Buscar video relevante SOLO si el usuario explícitamente pidió videos/imágenes
        let relevantVideo = null;
        if (!isRouteOnly && isVideoRequest) {
            console.log('🎬 Usuario pidió videos, iniciando búsqueda...');
            
            // PASO 1: Si se identificó un lugar específico (placeId), verificar si tiene video_urls en la DB
            if (placeId && placeName) {
                const attraction = attractions?.find(a => a.id === placeId);
                
                // Solo attractions tienen video_urls, businesses no
                if (attraction) {
                    const videoUrls = (attraction as any)?.video_urls;
                    if (videoUrls) {
                        // Si es array, tomar el primero; si es string, usarlo directamente
                        const videoUrl = Array.isArray(videoUrls) ? videoUrls[0] : videoUrls;
                        if (videoUrl) {
                            relevantVideo = {
                                id: placeId,
                                title: placeName,
                                url: videoUrl
                            };
                            console.log(`📹 Video del atractivo encontrado: "${placeName}"`);
                        }
                    }
                }
            }
            
            // PASO 2: Si no hay video del lugar, buscar en videos locales de la app
            if (!relevantVideo) {
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
            
            let bestMatch: { video: { id: any; title: any; video_url: any }, score: number } | null = null;
            
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
                // PASO 3: Buscar en YouTube
                console.log('🎬 Buscando en YouTube...');
                try {
                        let youtubeSearchQuery = '';
                        
                        // Debug: verificar si placeName está disponible
                        console.log(`🔍 DEBUG YouTube search - placeName disponible: "${placeName || 'NO DISPONIBLE'}"`);
                        
                        // PRIORIDAD 1: Si ya identificamos un lugar específico, usar su nombre
                        if (placeName) {
                            youtubeSearchQuery = `${placeName} Santiago del Estero`;
                            console.log(`🎯 Usando nombre del lugar identificado para YouTube: "${youtubeSearchQuery}"`);
                        } else {
                            // PRIORIDAD 2: Términos compuestos que deben mantenerse juntos
                            const compoundTerms: { [key: string]: string } = {
                                'motogp': 'MotoGP',
                                'moto gp': 'MotoGP',
                                'formula 1': 'Formula 1',
                                'formula1': 'Formula 1',
                                'champions league': 'Champions League',
                                'copa america': 'Copa America',
                                'marcha bombos': 'marcha de los bombos',
                                'santiago estero': 'Santiago del Estero'
                            };
                            
                            // Buscar términos compuestos en la consulta
                            let foundCompound = false;
                            for (const [key, value] of Object.entries(compoundTerms)) {
                                if (normalizedSearch.includes(key)) {
                                    youtubeSearchQuery = value;
                                    foundCompound = true;
                                    break;
                                }
                            }
                            
                            // PRIORIDAD 3: Si no se encontró término compuesto, extraer palabras relevantes
                            if (!foundCompound) {
                                const searchWords = normalizedSearch
                                    .split(/\s+/)
                                    .filter(w => w.length > 3 && !commonWords.has(w))
                                    .slice(0, 5);
                                youtubeSearchQuery = searchWords.join(' ');
                            }
                            
                            // Detectar si es una búsqueda sobre Santiago del Estero o tema general
                            const localKeywords = [
                                'santiago', 'estero', 'termas', 'bombos', 'chacarera', 'folklore', 'folclore',
                                'carnaval', 'dique', 'frontal', 'casino', 'catedral', 'plaza', 'libertad',
                                'nodo', 'tecnologico', 'parque', 'santiagueño', 'santiagueno', 'copo',
                                'banda', 'loreto', 'atamisqui', 'salinas', 'grandes', 'patio', 'froilan'
                            ];
                            
                            const isLocalSearch = localKeywords.some(keyword => 
                                normalizedSearch.includes(keyword)
                            );
                            
                            // Construir query final: agregar "Santiago del Estero" solo si es búsqueda local
                            // y no está ya incluido
                            if (isLocalSearch && !youtubeSearchQuery.toLowerCase().includes('santiago del estero')) {
                                youtubeSearchQuery = `${youtubeSearchQuery} Santiago del Estero`;
                            }
                        }
                        
                        // Si no hay query después de todos los intentos, usar términos básicos
                        if (!youtubeSearchQuery || youtubeSearchQuery.trim().length === 0) {
                            youtubeSearchQuery = normalizedSearch.split(/\s+/).slice(0, 5).join(' ') + ' Santiago del Estero';
                        }
                        
                        console.log(`🔍 Buscando en YouTube: "${youtubeSearchQuery}"`);
                        
                        // Usar YouTube Data API v3 para buscar videos
                        const youtubeApiKey = process.env.GOOGLE_TTS_API_KEY || process.env.GEMINI_API_KEY;
                        if (!youtubeApiKey) {
                            console.warn('No YouTube API key available');
                        } else {
                            const youtubeResponse = await fetch(
                                `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=${encodeURIComponent(youtubeSearchQuery)}&type=video&relevanceLanguage=es&key=${youtubeApiKey}`,
                                { method: 'GET' }
                            );
                            
                            if (youtubeResponse.ok) {
                                const youtubeData = await youtubeResponse.json();
                                console.log('YouTube API response:', youtubeData);
                                
                                if (youtubeData.items && youtubeData.items.length > 0) {
                                    // Retornar múltiples videos para que el usuario elija
                                    const youtubeVideos = youtubeData.items.map((item: any) => ({
                                        id: item.id.videoId,
                                        title: item.snippet.title,
                                        url: `https://www.youtube.com/embed/${item.id.videoId}`,
                                        thumbnail: item.snippet.thumbnails.medium.url,
                                        channelTitle: item.snippet.channelTitle,
                                        description: item.snippet.description,
                                        isYouTube: true
                                    }));
                                    
                                    relevantVideo = {
                                        id: 'youtube-list',
                                        title: `Encontré ${youtubeVideos.length} videos sobre "${youtubeSearchQuery}"`,
                                        url: '', // No URL única
                                        isYouTubeList: true,
                                        videos: youtubeVideos
                                    };
                                    console.log(`📹 ${youtubeVideos.length} videos de YouTube encontrados`);
                                }
                            } else {
                                console.warn('YouTube API error:', youtubeResponse.status, await youtubeResponse.text());
                            }
                        }
                    } catch (youtubeError) {
                        console.error('Error buscando en YouTube:', youtubeError);
                    }
                } // Cierre del else (búsqueda YouTube)
            } // Cierre del if (!relevantVideo) - búsqueda app_videos
        } // Cierre del if (!isRouteOnly && isVideoRequest)
        
        // Si es consulta de ruta, forzar respuesta concisa y directa
        if (isRouteOnly && placeName) {
            // Respuesta corta y directa para consultas de ruta
            const routeResponses = [
                `¡Dale! Te muestro la ruta a ${placeName} en el mapa.`,
                `¡Perfecto! Vamos a ${placeName}, te marco la ruta en el mapa.`,
                `¡Listo! Ruta a ${placeName} trazada en el mapa.`,
                `¡Vamos! Te llevo a ${placeName} por el mejor camino.`,
                `¡Claro! Ruta a ${placeName} lista en el mapa.`
            ];
            
            // Elegir respuesta aleatoria para variar
            reply = routeResponses[Math.floor(Math.random() * routeResponses.length)];
            console.log('🗺️ Route query: Forced concise response:', reply);
        }

        // Debug: Log final response before returning
        console.log('📤 API Response:', {
            locale,
            replyLength: reply?.length || 0,
            replyPreview: reply?.substring(0, 100) || 'UNDEFINED',
            placeId,
            placeName,
            isRouteOnly,
            isInfoQuery,
            hasVideo: !!relevantVideo
        });

        // Construir respuesta - solo incluir relevantVideo si existe
        const response: any = { 
            reply, 
            placeId, 
            placeName, 
            placeDescription,
            isRouteOnly,
            isInfoQuery,
            remainingRequests: rateLimit.remainingRequests
        };
        
        // Solo agregar relevantVideo si tiene contenido válido
        if (relevantVideo && (relevantVideo.url || relevantVideo.videos)) {
            response.relevantVideo = relevantVideo;
            console.log('✅ Incluyendo video en respuesta:', relevantVideo.isYouTubeList ? `Lista de ${relevantVideo.videos?.length} videos` : relevantVideo.title);
        } else {
            console.log('ℹ️  No hay video para incluir en respuesta');
        }

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error in chat route:', error);
        const message = error instanceof Error ? error.message : String(error);
        const payload: any = { error: true, message };
        if (process.env.NODE_ENV !== 'production' && error instanceof Error) payload.stack = error.stack;
        return NextResponse.json(payload, { status: 500 });
    }
}
