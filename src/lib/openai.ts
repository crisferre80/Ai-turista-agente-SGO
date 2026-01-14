import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
    console.warn("Missing OPENAI_API_KEY in environment variables.");
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "key_not_set", // Prevent crash during build/dev if key is missing
    dangerouslyAllowBrowser: true // Only strictly needed if used in client components, but harmless here as we use it in API routes
});

export default openai;
