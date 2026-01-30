import { NextResponse } from 'next/server';

// Curated list of common open-source models (free to use / self-host or use HF inference)
const curated = [
  { name: 'microsoft/DialoGPT-medium', displayName: 'DialoGPT Medium', description: 'Modelo conversacional de Microsoft, ideal para chatbots', provider: 'huggingface', is_free: true },
  { name: 'facebook/blenderbot-400M-distill', displayName: 'BlenderBot 400M', description: 'Chatbot conversacional de Facebook/Meta', provider: 'huggingface', is_free: true },
  { name: 'microsoft/DialoGPT-small', displayName: 'DialoGPT Small', description: 'Versión pequeña y rápida para conversaciones', provider: 'huggingface', is_free: true },
  { name: 'google/flan-t5-base', displayName: 'Flan-T5 Base', description: 'Modelo de Google optimizado para instrucciones', provider: 'huggingface', is_free: true },
  { name: 'meta-llama/Llama-2-7b-chat-hf', displayName: 'Llama 2 Chat 7B', description: 'Meta Llama 2 optimizado para conversación', provider: 'huggingface', is_free: true },
  { name: 'mistralai/Mistral-7B-Instruct-v0.1', displayName: 'Mistral 7B Instruct', description: 'Modelo eficiente y potente de Mistral AI', provider: 'huggingface', is_free: true },
  { name: 'google/flan-t5-large', displayName: 'Flan-T5 Large', description: 'Versión más grande de Flan-T5 para mejor rendimiento', provider: 'huggingface', is_free: true },
  { name: 'stabilityai/stablelm-tuned-alpha-7b', displayName: 'StableLM 7B', description: 'Modelo estable de Stability AI para uso general', provider: 'huggingface', is_free: true }
];

export async function GET() {
  try {
    // Return curated list and explanation that these are free/open-source and usually self-hosted
    return NextResponse.json({ provider: 'huggingface', models: curated });
  } catch (err) {
    console.error('/api/admin/huggingface/models error', err);
    return NextResponse.json({ error: 'Error fetching HuggingFace models' }, { status: 500 });
  }
}
