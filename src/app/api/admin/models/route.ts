import { NextResponse } from 'next/server';

async function fetchProvider(provider: string) {
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const res = await fetch(`${base}/api/admin/${provider}/models`);
    if (!res.ok) {
      const txt = await res.text();
      return { provider, error: txt };
    }
    const body = await res.json();
    return { provider, models: body.models || [] };
  } catch (err) {
    console.error('fetchProvider error', provider, err);
    return { provider, error: 'network error' };
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get('provider');

    if (provider) {
      const r = await fetchProvider(provider);
      return NextResponse.json(r);
    }

    // Aggregate common providers in parallel
    const providers = ['openai', 'gemini', 'huggingface'];
    const ps = providers.map(p => fetchProvider(p));
    const results = await Promise.all(ps);
    return NextResponse.json({ providers: results });
  } catch (err) {
    console.error('/api/admin/models error', err);
    return NextResponse.json({ error: 'Error fetching models' }, { status: 500 });
  }
}
