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
    const gender = url.searchParams.get('gender') || 'MALE'; // Filtro por género (predeterminado: masculino para Santi)
    const lang = url.searchParams.get('lang') || ''; // Filtro opcional por idioma

    if (provider === 'openai') {
      // Static list (OpenAI doesn't currently expose a voices list endpoint publicly in all SDKs)
      const voices = [
        { name: 'alloy', languageCodes: ['es-AR', 'es-419'], description: 'Alloy (default) - neutral, friendly', ssmlGender: 'MALE' },
        { name: 'fable', languageCodes: ['es-ES', 'es-419'], description: 'Fable - natural storytelling voice', ssmlGender: 'MALE' },
        { name: 'echo', languageCodes: ['es-AR', 'es-419'], description: 'Echo - clear, brief voice', ssmlGender: 'MALE' }
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
        finalKeyLength: apiKey?.length,
        gender,
        lang
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

      // Define supported language codes based on language parameter
      const getLanguageCodes = () => {
        const allCodes = {
          es: [
            'es-ES', 'es-419', 'es-MX', 'es-AR', 'es-CO', 'es-CL', 'es-PE', 'es-VE', 
            'es-EC', 'es-BO', 'es-PY', 'es-UY', 'es-CR', 'es-GT', 'es-HN', 'es-SV', 
            'es-NI', 'es-PA', 'es-DO', 'es-PR', 'es-CU', 'es-US'
          ],
          en: ['en-US', 'en-GB', 'en-AU', 'en-IN', 'en-CA'],
          pt: ['pt-BR', 'pt-PT'],
          fr: ['fr-FR', 'fr-CA']
        };
        
        if (lang && lang in allCodes) {
          return (allCodes as any)[lang];
        }
        // Si no se especifica idioma, retornar todos (compatible con comportamiento anterior)
        return Object.values(allCodes).flat();
      };

      const supportedCodes = getLanguageCodes();
      console.log('Supported language codes for', lang || 'all', ':', supportedCodes);

      // Filter voices by language codes and gender
      const allVoices = Array.isArray(data.voices) ? data.voices : [];
      console.log('Total voices from API:', allVoices.length);
      
      const filteredVoices = allVoices.filter((v: GoogleVoice) => {
        const hasValidStructure = v && typeof v === 'object' && Array.isArray(v.languageCodes);
        if (!hasValidStructure) return false;
        
        const hasLanguage = v.languageCodes.some((langCode: string) => supportedCodes.includes(langCode));
        const hasGender = !gender || v.ssmlGender === gender;
        
        // Log para Spanish específicamente para debugging
        if (lang === 'es' && hasLanguage && !hasGender) {
          console.log(`Voice "${v.name}" has Spanish but gender ${v.ssmlGender} (looking for ${gender})`);
        }
        
        return hasLanguage && hasGender;
      });

      console.log(`Filtered voices: ${filteredVoices.length} (lang=${lang}, gender=${gender})`);
      if (filteredVoices.length === 0 && lang === 'es') {
        console.log('Debug: Spanish voices found without gender filter:', 
          allVoices.filter((v: GoogleVoice) => 
            v?.languageCodes?.some((langCode: string) => supportedCodes.includes(langCode))
          ).map((v: GoogleVoice) => `${v.name}(${v.ssmlGender})`).slice(0, 10)
        );
      }

      // Limit results for better UX (first 100 voices)
      const limitedVoices = filteredVoices.slice(0, 100);

      console.log('Filtered to', filteredVoices.length, 'voices matching gender:', gender, 'out of', allVoices.length, 'total. Showing first', limitedVoices.length);

      // Normalize voices
      const voices = limitedVoices.map((v: GoogleVoice) => ({
        name: v && typeof v === 'object' && v.name ? v.name : 'Unknown',
        languageCodes: v && typeof v === 'object' && Array.isArray(v.languageCodes) ? v.languageCodes : [],
        ssmlGender: v && typeof v === 'object' && v.ssmlGender ? v.ssmlGender : 'UNKNOWN',
        naturalSampleRateHertz: v && typeof v === 'object' && typeof v.naturalSampleRateHertz === 'number' ? v.naturalSampleRateHertz : 0
      }));

      console.log('Returning', voices.length, 'processed voices with gender:', gender);

      return NextResponse.json({
        provider: 'google',
        voices,
        filterApplied: { gender, lang },
        totalAvailable: allVoices.length,
        filteredAvailable: filteredVoices.length
      });
    }

    return NextResponse.json({ provider, voices: [], error: 'Unsupported provider' }, { status: 400 });
  } catch (err) {
    console.error('/api/admin/tts/voices error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
