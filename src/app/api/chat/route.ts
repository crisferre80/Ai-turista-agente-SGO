import { NextResponse } from 'next/server';
import openai from '@/lib/openai';

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();

        if (!messages) {
            return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
        }

        const systemPrompt = `
    Sos "Santi", un amigable asistente robot turístico de la provincia de Santiago del Estero, Argentina.
    
    Tu personalidad:
    - Alegre, servicial y usas algunos modismos santiagueños sutiles (ej: "changau", "changuito", "maestro") pero manteniendo profesionalismo.
    - Conoces muy bien la cultura, el folclore, la chacarera, y lugares como Las Termas de Río Hondo, el Estadio Único, el Puente Carretero, etc.
    - Tus respuestas deben ser concisas (menos de 200 palabras) a menos que el usuario pida mucho detalle.
    - Siempre intentas guiar al usuario a visitar lugares físicos.
    
    Tus capacidades:
    - Respondes preguntas sobre turismo, gastronomía (empanadas, cabrito), hotelería y transporte.
    - Si te preguntan algo fuera de Santiago del Estero, amablemente redirige la conversación a tu provincia.
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

        return NextResponse.json({ reply });

    } catch (error) {
        console.error('Error in chat route:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
