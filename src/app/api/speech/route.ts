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
        const ttsEngine = voice || settings?.tts_engine || 'alloy';

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

            // Use provided language code or extract from voice name
            let finalLanguageCode = languageCode; // Use if provided from client
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
                    // For voices that contain country codes, extract the pattern
                    const match = ttsEngine.match(/es-([A-Z]{2})/i);
                    if (match) {
                        finalLanguageCode = `es-${match[1].toUpperCase()}`;
                    } else {
                        finalLanguageCode = 'es-419'; // fallback
                    }
                }
            }
            if (!finalLanguageCode) finalLanguageCode = 'es-419';

            console.log('Using language code:', finalLanguageCode, 'for voice:', ttsEngine);

            const requestBody = {
                input: { text },
                voice: {
                    name: ttsEngine,
                    languageCode: finalLanguageCode
                },
                audioConfig: {
                    audioEncoding: 'MP3',
                    sampleRateHertz: 24000
                }
            };

            const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            console.log('Google TTS response status:', response.status);

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
        const apiError = (error as any);
        if (apiError && typeof apiError === 'object' && 'status' in apiError) {
            if (apiError.status === 429) return NextResponse.json({ error: 'Quota exceeded', fallback: true }, { status: 429 });
            if (apiError.status === 401) return NextResponse.json({ error: 'Auth failed', fallback: true }, { status: 401 });
        }
        return NextResponse.json({ error: 'Internal Server Error', fallback: true }, { status: 500 });
    }
}
