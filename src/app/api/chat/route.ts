import { NextResponse } from 'next/server';
import openai from '@/lib/openai';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();

        if (!messages) {
            return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
        }

        // 1. Fetch Local Data for Context
        const { data: attractions } = await supabase.from('attractions').select('name, description, info_extra, category');
        const { data: businesses } = await supabase.from('businesses').select('name, category, website_url, contact_info');

        const localContext = `
        INFORMACIÓN LOCAL REGISTRADA (PRIORIDAD ALTA):
        Atractivos: ${JSON.stringify(attractions || [])}
        Negocios/Servicios: ${JSON.stringify(businesses || [])}
        `;

        const systemPrompt = `
    Sos "Santi", un amigable asistente robot turístico de la provincia de Santiago del Estero, Argentina.
    
    Tu personalidad:
    - Alegre, servicial y usas modismos santiagueños sutiles (ej: "changau", "changuito", "maestro").
    - Conoces muy bien la cultura, el folclore, y lugares icónicos.
    - Tus respuestas son concisas (menos de 150 palabras).
    
    INSTRUCCIONES CRÍTICAS:
    1. PRIORIDAD DE DATOS: Antes de usar tu conocimiento general, REVISA SIEMPRE la "INFORMACIÓN LOCAL REGISTRADA" provista arriba.
    2. Si el usuario pregunta por un lugar para comer, dormir o visitar, y ese lugar ESTÁ en la lista local, RECOMIÉNDALO PRIMERO mencionando que es un usuario registrado de la app.
    3. Si NO encuentras algo en la lista local, usa tu conocimiento de la web pero aclara: "Estoy consultando mi base de datos global...".
    4. Siempre fomenta el turismo local y sé muy amable.

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
        return NextResponse.json({ reply });

    } catch (error) {
        console.error('Error in chat route:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
