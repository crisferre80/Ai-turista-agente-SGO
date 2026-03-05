import { NextResponse } from 'next/server';

// Usaremos la API gratuita de MyMemory (sin key) para traducciones ligeras.
// Endpoint de MyMemory: https://api.mymemory.translated.net/get?q=<texto>&langpair=<src>|<tgt>
// Limite ~1000 palabras/día, adecuado para uso admin casual.
const MYMEMORY_BASE = 'https://api.mymemory.translated.net/get';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(err=>{
        console.error('error parsing body in translate route', err);
        throw err;
    });
    console.log('translate body', body);
    const { text, target, source = 'es' } = body as any;
    if (!text || !target) {
      console.warn('translate route missing parameters', { text, target });
      return NextResponse.json({ error: 'missing text or target' }, { status: 400 });
    }
    // limitar longitud para evitar error de MyMemory (>500 chars)
    if (text.length > 500) {
      console.warn('translate text too long', text.length);
      return NextResponse.json({ error: 'query too long, max 500 characters' }, { status: 413 });
    }
    // usar MyMemory
    const params = new URLSearchParams({ q: text, langpair: `${source}|${target}` });
    const response = await fetch(`${MYMEMORY_BASE}?${params.toString()}`);
    if (!response.ok) {
      const err = await response.text();
      console.error('MyMemory error', err);
      return NextResponse.json({ error: err }, { status: 502 });
    }
    const data = await response.json();
    // estructura esperada: { responseData: { translatedText: "..." }, matches: [...] }
    const translated = data?.responseData?.translatedText;
    return NextResponse.json({ translatedText: translated });
  } catch (e:any) {
    console.error('translate route failed', e, e.stack);
    const msg = e?.message || 'unknown';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}