import { NextResponse } from 'next/server';

interface GeminiApiModel {
  name: string;
  displayName?: string;
  description?: string;
}

// Fallback models when API is not available
const fallbackGeminiModels = [
  {
    name: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    description: 'Modelo rápido y eficiente de Google, ideal para la mayoría de tareas',
    provider: 'gemini',
    is_free: false,
    pricing: 'paid',
    tier: 'medium'
  },
  {
    name: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    description: 'Modelo avanzado de Google con capacidades superiores',
    provider: 'gemini',
    is_free: false,
    pricing: 'paid',
    tier: 'high'
  },
  {
    name: 'gemini-pro',
    displayName: 'Gemini Pro',
    description: 'Modelo estándar de Google para uso general',
    provider: 'gemini',
    is_free: false,
    pricing: 'paid',
    tier: 'medium'
  }
];

export async function GET() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.warn('GEMINI_API_KEY not configured, returning fallback models');
      return NextResponse.json({ 
        provider: 'gemini',
        models: fallbackGeminiModels,
        warning: 'Usando modelos predeterminados. Configura GEMINI_API_KEY para ver todos los modelos disponibles.'
      });
    }

    console.log('Attempting to fetch Gemini models with API key:', apiKey.substring(0, 8) + '...');

    // Try to fetch from Google API
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'TouristAssistant/1.0'
        }
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API error:', { 
          status: response.status, 
          statusText: response.statusText,
          error: errorText 
        });

        // Return fallback models on API errors
        return NextResponse.json({
          provider: 'gemini',
          models: fallbackGeminiModels,
          warning: `Error de API (${response.status}): Usando modelos predeterminados. ${errorText}`
        });
      }

      const data = await response.json();
      console.log('Gemini API success, models found:', data?.models?.length || 0);
      
      if (!data.models || data.models.length === 0) {
        console.warn('No models returned from API, using fallback');
        return NextResponse.json({
          provider: 'gemini',
          models: fallbackGeminiModels,
          warning: 'La API no devolvió modelos. Usando modelos predeterminados.'
        });
      }

      // Process and return API models
      const models = data.models.map((m: GeminiApiModel) => ({
        name: m.name,
        displayName: m.displayName || m.name,
        description: m.description || 'Modelo de IA avanzado de Google',
        provider: 'gemini',
        is_free: false,
        pricing: 'paid',
        tier: m.name?.includes('pro') ? 'high' : m.name?.includes('flash') ? 'medium' : 'low'
      }));

      return NextResponse.json({ 
        provider: 'gemini', 
        models,
        success: true
      });

    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error('Fetch error:', fetchError);
      
      return NextResponse.json({
        provider: 'gemini',
        models: fallbackGeminiModels,
        warning: 'Error de conexión con la API. Usando modelos predeterminados.'
      });
    }

  } catch (error) {
    console.error('Gemini models endpoint error:', error);
    return NextResponse.json({
      provider: 'gemini',
      models: fallbackGeminiModels,
      error: 'Error interno. Usando modelos predeterminados.'
    });
  }
}