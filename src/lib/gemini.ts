import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) {
    console.warn("Missing GEMINI_API_KEY in environment variables.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "key_not_set");

export const getGeminiModel = (modelName: string = 'gemini-2.0-flash-exp') => {
    return genAI.getGenerativeModel({ model: modelName });
};

export default genAI;
