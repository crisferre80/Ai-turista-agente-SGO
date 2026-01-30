import { NextResponse } from 'next/server';

type GoogleVoice = {
  name: string;
  languageCodes: string[];
  ssmlGender?: string;
  naturalSampleRateHertz?: number;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get('provider') || 'openai';

    if (provider === 'openai') {
      // Static list (OpenAI doesn't currently expose a voices list endpoint publicly in all SDKs)
      const voices = [
        { name: 'alloy', languageCodes: ['es-AR', 'es-419'], description: 'Alloy (default) - neutral, friendly' },
        { name: 'fable', languageCodes: ['es-ES', 'es-419'], description: 'Fable - natural storytelling voice' },
        { name: 'echo', languageCodes: ['es-AR', 'es-419'], description: 'Echo - clear, brief voice' }
      ];
      return NextResponse.json({ provider: 'openai', voices });
    }

    if (provider === 'google') {
      // Prefer header preview -> env -> saved app settings
      const headerKey = req.headers.get('x-google-tts-api-key') || undefined;
      const apiKey = headerKey || process.env.GOOGLE_TTS_API_KEY || undefined;

      console.log('Google TTS voices request:', {
        hasHeaderKey: !!headerKey,
        hasEnvKey: !!process.env.GOOGLE_TTS_API_KEY,
        finalKeyLength: apiKey?.length
      });

      if (!apiKey) {
        return NextResponse.json({
          provider: 'google',
          voices: [],
          error: 'Missing GOOGLE_TTS_API_KEY. Configure it in .env.local or provide via header.'
        }, { status: 400 });
      }

      const apiUrl = `https://texttospeech.googleapis.com/v1/voices?key=${encodeURIComponent(apiKey)}`;
      console.log('Fetching Google TTS voices from:', apiUrl.replace(apiKey, '[REDACTED]'));

      const resp = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Tourist-Assistant/1.0'
        }
      });

      console.log('Google TTS API response status:', resp.status);

      if (!resp.ok) {
        const text = await resp.text();
        console.error('Google TTS voices fetch failed:', resp.status, text.substring(0, 200));

        let errorMessage = `Google TTS API error (${resp.status}): `;
        if (resp.status === 403) {
          errorMessage += 'API key may not have Text-to-Speech API enabled or may be invalid.';
        } else {
          errorMessage += text || 'Unknown error';
        }

        return NextResponse.json({
          provider: 'google',
          voices: [],
          error: errorMessage
        }, { status: resp.status });
      }

      const data = await resp.json();
      console.log('Raw Google TTS response:', typeof data, data ? 'has data' : 'no data');

      if (!data || typeof data !== 'object') {
        return NextResponse.json({
          provider: 'google',
          voices: [],
          error: 'Invalid response format from Google TTS API'
        }, { status: 500 });
      }

      console.log('Google TTS voices response received, processing...');

      // Filter to Latin American Spanish voices only (exclude Spain)
      const allVoices = Array.isArray(data.voices) ? data.voices : [];
      const latinVoices = allVoices.filter((v: GoogleVoice) => 
        v && 
        typeof v === 'object' && 
        Array.isArray(v.languageCodes) && 
        v.languageCodes.some((lang: string) => {
          if (typeof lang !== 'string') return false;
          // Include Latin American Spanish variants but exclude Spain (es-ES)
          const latinCodes = ['es-419', 'es-MX', 'es-AR', 'es-CO', 'es-CL', 'es-PE', 'es-VE', 'es-EC', 'es-BO', 'es-PY', 'es-UY', 'es-CR', 'es-GT', 'es-HN', 'es-SV', 'es-NI', 'es-PA', 'es-DO', 'es-PR', 'es-CU'];
          return latinCodes.includes(lang) || (lang.startsWith('es-') && !lang.startsWith('es-ES'));
        })
      );

      // Limit results for better UX (first 50 Latin voices)
      const limitedVoices = latinVoices.slice(0, 50);

      console.log('Filtered to', latinVoices.length, 'Latin Spanish voices out of', allVoices.length, 'total. Showing first', limitedVoices.length);

      // Normalize voices
      const voices = limitedVoices.map((v: GoogleVoice) => ({
        name: v && typeof v === 'object' && v.name ? v.name : 'Unknown',
        languageCodes: v && typeof v === 'object' && Array.isArray(v.languageCodes) ? v.languageCodes : [],
        ssmlGender: v && typeof v === 'object' && v.ssmlGender ? v.ssmlGender : 'UNKNOWN',
        naturalSampleRateHertz: v && typeof v === 'object' && typeof v.naturalSampleRateHertz === 'number' ? v.naturalSampleRateHertz : 0
      }));

      console.log('Returning', voices.length, 'processed Spanish voices');

      return NextResponse.json({
        provider: 'google',
        voices,
        totalAvailable: allVoices.length,
        latinAvailable: latinVoices.length
      });
    }

    return NextResponse.json({ provider, voices: [], error: 'Unsupported provider' }, { status: 400 });
  } catch (err) {
    console.error('/api/admin/tts/voices error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
