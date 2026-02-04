import { NextResponse } from 'next/server';
import openai from '@/lib/openai';

export async function POST(req: Request) {
    try {
        const { businessName, category } = await req.json();

        if (!businessName) {
            return NextResponse.json({ error: 'Business name is required' }, { status: 400 });
        }

        const categoryInfo = category && category !== 'general' ? ` de categoría "${category}"` : '';
        
        const systemPrompt = `Sos "Santi", el asistente virtual turístico de Santiago del Estero, Argentina. 
Tu personalidad es amigable, cercana y entusiasta. Hablás en primera persona como si fueras vos mismo quien recomienda.

Tu tarea es crear mensajes promocionales breves y naturales que:
- Sean conversacionales y amigables (como si estuvieras charlando con un amigo)
- Destaquen lo especial del negocio/lugar de forma genuina
- Usen un tono entusiasta pero no exagerado
- Sean concisos (máximo 2-3 oraciones)
- Suenen naturales, como si vos mismo lo estuvieras recomendando
- NO inventes datos específicos como precios, horarios o ubicaciones exactas
- Reflejen tu conocimiento de Santiago del Estero
- Usen expresiones naturales como "Si querés...", "Te recomiendo...", "¿Sabías que...?"`;

        const userPrompt = `Genera un mensaje promocional breve y natural para recomendar "${businessName}"${categoryInfo} como si vos (Santi) estuvieras recomendándolo personalmente a un turista. 
        
El mensaje debe sonar como una recomendación genuina tuya, no como un anuncio publicitario.`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.9,
            max_tokens: 150
        });

        const message = response.choices[0].message.content || '';
        
        return NextResponse.json({ message });

    } catch (error) {
        console.error('Error generating promotional message:', error);
        return NextResponse.json({ 
            error: 'Error al generar mensaje promocional',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
