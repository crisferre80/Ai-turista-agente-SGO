import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
    console.warn("Missing OPENAI_API_KEY in environment variables.");
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export default openai;
