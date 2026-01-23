import { NextResponse } from 'next/server';
import openai from '@/lib/openai';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
    try {
        const { messages, userLocation } = await req.json();

        if (!messages) {
            return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
        }

        // Detectar si el usuario pregunta sobre su ubicación actual
        const lastMessage = messages[messages.length - 1];
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
        const { data: attractions } = await supabase.from('attractions').select('id, name, description, info_extra, category');
        const { data: businesses } = await supabase.from('businesses').select('id, name, category, website_url, contact_info');

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
    6. IMPORTANTE - CÓMO LLEGAR: Cuando el usuario pregunte "cómo llegar" o solicite "direcciones" a un lugar:
       - Menciona el nombre EXACTO del lugar en tu respuesta
       - Di algo como: "¡Perfecto! Te voy a llevar a [NOMBRE DEL LUGAR]. Ya configuré la ruta en tu mapa, solo necesito que actives tu ubicación tocando el botón de la brújula arriba a la derecha."
       - El sistema detectará automáticamente el nombre del lugar en tu respuesta y trazará la ruta
       - Si no tienen la ubicación activada, recuerdales que la necesitan para mostrales el camino
    7. Sé conversacional pero siempre menciona nombres exactos de lugares cuando sea relevante.

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
        
        if (reply) {
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
        
        return NextResponse.json({ reply, placeId, placeName });

    } catch (error) {
        console.error('Error in chat route:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
