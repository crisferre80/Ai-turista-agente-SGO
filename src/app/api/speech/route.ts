import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { text, voice, provider, languageCode } = body;

        console.log('TTS request received:', { text: text?.substring(0, 50), voice, provider, languageCode });

        if (!text) {
            console.error('TTS error: Text is required');
            return NextResponse.json({ error: 'Text is required' }, { status: 400 });
        }

        // Use provider from request body or fallback to settings
        const { getAppSettings } = await import('@/lib/getSettings');
        const settings = await getAppSettings();
        const ttsProvider = provider || settings?.tts_provider || 'openai';
        let ttsEngine = voice || settings?.tts_engine || 'alloy';

        console.log('TTS config:', { ttsProvider, ttsEngine });

        if (ttsProvider === 'browser') {
            // Instruct client to use browser TTS fallback
            return NextResponse.json({ fallback: true, message: 'Use browser TTS (SpeechSynthesis)' }, { status: 200 });
        }

        if (ttsProvider === 'google') {
            const apiKey = req.headers.get('x-google-tts-api-key') || process.env.GOOGLE_TTS_API_KEY || settings?.google_tts_api_key;
            
            console.log('Google TTS key available:', !!apiKey);
            
            if (!apiKey) {
                console.error('Google TTS API key is missing');
                return NextResponse.json({ error: 'Google TTS API key is missing', fallback: true }, { status: 401 });
            }

            // determine language code
            let finalLanguageCode = languageCode;
            if (!finalLanguageCode && ttsEngine) {
                if (ttsEngine.includes('es-US')) finalLanguageCode = 'es-US';
                else if (ttsEngine.includes('es-MX')) finalLanguageCode = 'es-MX';
                else if (ttsEngine.includes('es-AR')) finalLanguageCode = 'es-AR';
                else if (ttsEngine.includes('es-CO')) finalLanguageCode = 'es-CO';
                else if (ttsEngine.includes('es-CL')) finalLanguageCode = 'es-CL';
                else if (ttsEngine.includes('es-PE')) finalLanguageCode = 'es-PE';
                else if (ttsEngine.includes('es-VE')) finalLanguageCode = 'es-VE';
                else if (ttsEngine.includes('es-EC')) finalLanguageCode = 'es-EC';
                else {
                    const match = ttsEngine.match(/([a-z]{2}-[A-Z]{2})/i);
                    if (match) {
                        finalLanguageCode = match[1];
                    } else {
                        finalLanguageCode = 'es-419';
                    }
                }
            }
            if (!finalLanguageCode) finalLanguageCode = 'es-419';

            // if a voice is specified and has a country variant, compare with language code
            const engineLangMatch = ttsEngine?.match(/^([a-z]{2}-[A-Z]{2})/);
            const engineLanguageCode = engineLangMatch ? engineLangMatch[1] : null;

            if (ttsEngine && finalLanguageCode && engineLanguageCode && engineLanguageCode !== finalLanguageCode) {
                // mismatched region (es-US vs es-AR etc.) is invalid for Google TTS
                if (engineLanguageCode.slice(0,2) === finalLanguageCode.slice(0,2)) {
                    console.warn('Google TTS voice region mismatch:', ttsEngine, 'vs languageCode', finalLanguageCode, 'dropping voice to keep languageCode');
                } else {
                    console.warn('Google TTS voice and language are incompatible:', ttsEngine, 'vs', finalLanguageCode, 'dropping voice');
                }
                ttsEngine = '';
            }

            console.log('Using language code:', finalLanguageCode, 'for voice:', ttsEngine);

            type GoogleTtsRequest = {
                input: { text: string };
                voice: { languageCode: string; name?: string };
                audioConfig: { audioEncoding: 'MP3'; sampleRateHertz: number };
            };

            const requestBody: GoogleTtsRequest = {
                input: { text },
                voice: {
                    languageCode: finalLanguageCode
                },
                audioConfig: {
                    audioEncoding: 'MP3',
                    sampleRateHertz: 24000
                }
            };
            if (ttsEngine) requestBody.voice.name = ttsEngine;

            // actually call Google TTS API
            const apiUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`;
            console.log('Google TTS request to', apiUrl, 'body', requestBody);
            
            // Create abort controller with 10 second timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            }).finally(() => clearTimeout(timeoutId));

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Google TTS error:', response.status, errorText);
                return NextResponse.json({ 
                    error: `Google TTS error: ${response.status} - ${errorText}`, 
                    fallback: true 
                }, { status: response.status });
            }

            const data = await response.json();
            
            if (!data.audioContent) {
                console.error('No audio content received from Google TTS');
                return NextResponse.json({ error: 'No audio content received from Google TTS', fallback: true }, { status: 500 });
            }

            console.log('Google TTS success, audio size:', data.audioContent.length);

            // Convert base64 to buffer
            const audioBuffer = Buffer.from(data.audioContent, 'base64');

            return new NextResponse(audioBuffer, {
                headers: {
                    'Content-Type': 'audio/mpeg',
                    'Content-Length': audioBuffer.length.toString(),
                },
            });
        }

        if (ttsProvider === 'openai') {
            // if user requested a language other than Spanish we can't guarantee the
            // Spanish-only voices will speak it correctly, so let the client fallback
            // to browser/Google TTS which handles multiple languages.
            if (languageCode && !languageCode.startsWith('es')) {
                console.log('OpenAI provider: non-Spanish language requested, advising browser fallback');
                return NextResponse.json({ fallback: true, message: 'Use browser TTS for language ' + languageCode }, { status: 200 });
            }

            const openai = (await import('@/lib/openai')).default;
            if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "key_not_set") {
                return NextResponse.json({ error: 'OpenAI API key is missing', fallback: true }, { status: 401 });
            }

            const mp3 = await openai.audio.speech.create({
                model: "tts-1",
                voice: ttsEngine || "alloy",
                input: text,
            });

            const buffer = Buffer.from(await mp3.arrayBuffer());

            return new NextResponse(buffer, {
                headers: {
                    'Content-Type': 'audio/mpeg',
                    'Content-Length': buffer.length.toString(),
                },
            });
        }

        // Not implemented providers (Google/Coqui/etc.) respond with fallback
        return NextResponse.json({ fallback: true, message: `TTS provider ${ttsProvider} not implemented on server` }, { status: 501 });

    } catch (error) {
        console.error('Error in speech route:', error);
        
        // Handle timeout/abort errors
        if (error instanceof Error && error.name === 'AbortError') {
            console.error('🕐 TTS request timeout (10s)');
            return NextResponse.json({ 
                error: 'Request timed out. Service may be overloaded.',
                fallback: true 
            }, { status: 504 });
        }
        
        const apiError = error as { status?: number; message?: string } | undefined;
        if (apiError && typeof apiError === 'object' && 'status' in apiError) {
            if (apiError.status === 429) return NextResponse.json({ error: 'Quota exceeded', fallback: true }, { status: 429 });
            if (apiError.status === 401) return NextResponse.json({ error: 'Auth failed', fallback: true }, { status: 401 });
        }
        // include actual message for debugging
        const message = apiError && apiError.message ? String(apiError.message) : 'Internal Server Error';
        return NextResponse.json({ error: message, fallback: true }, { status: 500 });
    }
}
