import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 400 });

    const r = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` }
    });

    if (!r.ok) {
      const txt = await r.text();
      return NextResponse.json({ error: txt }, { status: r.status });
    }

    const data = await r.json();
    const models = (data?.data || []).map((m: any) => {
      const id = m.id || m.model || '';
      // Heuristic classification: OpenAI hosted models are generally paid
      let pricing: 'paid' | 'unknown' = 'paid';
      let tier: 'low' | 'medium' | 'high' = 'medium';
      let description = '';
      
      if (id.includes('gpt-4')) {
        tier = 'high';
        description = 'Modelo más avanzado de OpenAI, ideal para tareas complejas';
      } else if (id.includes('gpt-3.5')) {
        tier = 'low';
        description = 'Modelo eficiente y económico, buena relación calidad-precio';
      } else if (id.includes('text-davinci') || id.includes('davinci')) {
        tier = 'high';
        description = 'Modelo potente de la serie Davinci';
      } else if (id.includes('text-curie') || id.includes('curie')) {
        tier = 'medium';
        description = 'Modelo balanceado para uso general';
      } else if (id.includes('text-babbage') || id.includes('babbage')) {
        tier = 'low';
        description = 'Modelo rápido para tareas simples';
      } else if (id.includes('text-ada') || id.includes('ada')) {
        tier = 'low';
        description = 'Modelo más rápido y económico';
      } else {
        description = m.description || 'Modelo de OpenAI';
      }
      
      return {
        name: id,
        displayName: id,
        description,
        provider: 'openai',
        pricing,
        tier,
        is_free: false
      };
    });

    return NextResponse.json({ provider: 'openai', models });
  } catch (err) {
    console.error('/api/admin/openai/models error', err);
    return NextResponse.json({ error: 'Error fetching OpenAI models' }, { status: 500 });
  }
}
