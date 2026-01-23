import { NextResponse } from 'next/server';
import openai from '@/lib/openai';
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

        // Rate limiting check - usar IP o un identificador del usuario
        const forwardedFor = req.headers.get('x-forwarded-for');
        const userIp = forwardedFor ? forwardedFor.split(',')[0] : 'unknown';
        const rateLimit = checkRateLimit(userIp);
        
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
            'llévame a', 'llevame a', 'ir a', 'voy a'
        ];
        
        const isRouteQuery = lastMessage && 
            typeof lastMessage.content === 'string' &&
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

        const localContext = `
        INFORMACIÓN LOCAL REGISTRADA (PRIORIDAD ALTA):
        Atractivos: ${JSON.stringify(attractions || [])}
        Negocios/Servicios: ${JSON.stringify(businesses || [])}
        `;

        const systemPrompt = `
    Sos "Santi", un amigable asistente robot turístico de la provincia de Santiago del Estero, Argentina.
    
    Tu personalidad:
    - Alegre, servicial y usas modismos santiagueños sutiles (ej: "chango", "changuito", "changuita").
    - Conoces muy bien la cultura, el folclore, y lugares icónicos.
    
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

    Contexto actual de la app:
    ${localContext}
    `;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages
            ],
            temperature: 0.7,
        });

        const reply = response.choices[0].message.content;
        
        // Detect if a specific place is mentioned in the reply
        let placeId = null;
        let placeName = null;
        let isRouteOnly = false; // Flag para indicar que solo se debe mostrar ruta
        
        // Si es consulta de ruta, marcar como tal pero SÍ extraer placeName para trazar ruta
        if (isRouteQuery) {
            isRouteOnly = true;
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
        }
        
        return NextResponse.json({ 
            reply, 
            placeId, 
            placeName, 
            isRouteOnly,
            remainingRequests: rateLimit.remainingRequests
        });

    } catch (error) {
        console.error('Error in chat route:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
