import { NextResponse } from 'next/server';
import openai from '@/lib/openai';

export async function POST(req: Request) {
    try {
        const { text } = await req.json();

        if (!text) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 });
        }

        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "key_not_set") {
            return NextResponse.json({ error: 'OpenAI API key is missing' }, { status: 401 });
        }

        const mp3 = await openai.audio.speech.create({
            model: "tts-1",
            voice: "alloy", // "alloy" is a good neutral/robot-like voice. Alternatives: "echo", "fable".
            input: text,
        });

        const buffer = Buffer.from(await mp3.arrayBuffer());

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': buffer.length.toString(),
            },
        });

    } catch (error) {
        console.error('Error in speech route:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
