import { NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/gemini';

/**
 * API Route: /api/location-context
 * 
 * Recibe coordenadas del usuario y consulta información contextual
 * usando geocoding reverso de Mapbox y datos de Wikipedia/web
 */

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

export async function POST(req: Request) {
    try {
        const { longitude, latitude } = await req.json();

        if (!longitude || !latitude) {
            return NextResponse.json({ error: 'Coordenadas requeridas' }, { status: 400 });
        }

        // 1. Geocoding Reverso con Mapbox para obtener el nombre del lugar
        let locationName = '';
        let locationContext = '';
        let neighborhood = '';
        let city = '';
        let country = '';

        try {
            const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}&language=es`;
            const geoResponse = await fetch(geocodeUrl);
            const geoData = await geoResponse.json();

            if (geoData.features && geoData.features.length > 0) {
                // Extraer información detallada
                const features = geoData.features;
                
                // El primer feature suele ser el más específico (lugar, dirección, POI)
                locationName = features[0].place_name || features[0].text || '';
                
                // Buscar contexto por tipos de features
                for (const feature of features) {
                    const placeType = feature.place_type?.[0];
                    
                    if (placeType === 'neighborhood' || placeType === 'locality') {
                        neighborhood = feature.text || '';
                    } else if (placeType === 'place') {
                        city = feature.text || '';
                    } else if (placeType === 'country') {
                        country = feature.text || '';
                    }
                }

                locationContext = features[0].context?.map((c: { text: string }) => c.text).join(', ') || '';
            }
        } catch (geocodeError) {
            console.error('Geocoding error:', geocodeError);
            locationName = `Ubicación en ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        }

        // 2. Usar OpenAI para generar descripción contextual rica
        const prompt = `Eres "Santi", un asistente turístico de Santiago del Estero, Argentina.

El usuario está actualmente en estas coordenadas:
- Latitud: ${latitude}
- Longitud: ${longitude}
- Lugar identificado: ${locationName}
- Barrio/Zona: ${neighborhood || 'no identificado'}
- Ciudad: ${city || 'no identificado'}
- País: ${country}

TAREA: 
Describe de manera amigable y conversacional la ubicación actual del usuario. Incluye:
1. Qué tipo de zona es (residencial, comercial, histórica, etc.)
2. Si es una zona conocida, menciona algunos atractivos cercanos o características especiales
3. Si estás en Santiago del Estero, menciona datos culturales o históricos relevantes
4. Usa un tono cálido y amigable, como si estuvieras hablando con un amigo
5. Menciona si hay lugares de interés turístico cercanos que conozcas

Responde en un párrafo de 3-5 oraciones, conversacional y útil. Si no tienes información específica sobre la zona, sé honesto pero creativo describiendo lo que podrías inferir del contexto geográfico.`;

        const model = getGeminiModel();
        
        const result = await model.generateContent({
            contents: [
                {
                    role: 'user',
                    parts: [{
                        text: 'Eres un asistente turístico amigable y conocedor de Santiago del Estero, Argentina.\n\n' + prompt
                    }]
                }
            ],
            generationConfig: {
                temperature: 0.8,
                maxOutputTokens: 300,
            },
        });

        const description = result.response.text() || 'No pude obtener información sobre esta ubicación.';

        return NextResponse.json({
            success: true,
            locationName,
            locationContext,
            neighborhood,
            city,
            country,
            coordinates: { latitude, longitude },
            description
        });

    } catch (error) {
        console.error('Error in location-context route:', error);
        return NextResponse.json({ 
            error: 'Error al obtener contexto de ubicación',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
