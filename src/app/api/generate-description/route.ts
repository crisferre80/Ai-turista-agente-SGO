import { NextResponse } from 'next/server';
import openai from '@/lib/openai';

export async function POST(req: Request) {
    try {
        const { name, category, type } = await req.json();

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        const typeLabel = type === 'business' ? 'negocio/comercio' : 'atractivo turístico';
        const categoryInfo = category ? ` de categoría "${category}"` : '';
        
        const systemPrompt = `Sos un experto redactor turístico de Santiago del Estero, Argentina. 
Tu tarea es crear descripciones atractivas, informativas y breves para ${typeLabel}s${categoryInfo} de la provincia.
Las descripciones deben:
- Ser concisas (máximo 3-4 oraciones)
- Resaltar lo más importante y distintivo del lugar
- Usar un tono amigable y cercano
- Mencionar aspectos culturales o históricos relevantes cuando aplique
- Ser específicas de Santiago del Estero cuando sea posible
- NO inventar datos específicos como horarios, precios o direcciones exactas`;

        const userPrompt = type === 'business' 
            ? `Genera una descripción breve y atractiva para el negocio/comercio llamado "${name}"${categoryInfo} ubicado en Santiago del Estero.`
            : `Genera una descripción breve y atractiva para el atractivo turístico llamado "${name}"${categoryInfo} en Santiago del Estero, Argentina.`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.8,
            max_tokens: 200
        });

        const description = response.choices[0].message.content || '';
        
        return NextResponse.json({ description });

    } catch (error) {
        console.error('Error generating description:', error);
        return NextResponse.json({ 
            error: 'Error al generar descripción',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
