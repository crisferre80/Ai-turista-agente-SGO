import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ error: 'Latitude and longitude are required' }, { status: 400 });
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENWEATHER_API_KEY no está configurada en .env.local');
    return NextResponse.json({ error: 'Weather API key is not configured' }, { status: 500 });
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=es`;
  console.log('🌤️ Solicitando clima para:', { lat, lon });

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ OpenWeatherMap API Error:', errorData);
      console.error('📍 URL solicitada:', url.replace(apiKey, 'API_KEY_OCULTA'));
      console.error('🔑 Status:', response.status, response.statusText);
      return NextResponse.json({ error: `Failed to fetch weather data: ${errorData.message || response.statusText}` }, { status: response.status });
    }
    const data = await response.json();
    console.log('✅ Clima obtenido correctamente:', data.name, data.main.temp + '°C');
    
    // Devolvemos solo los datos que necesitamos para el widget
    const weatherInfo = {
      temp: data.main.temp,
      feels_like: data.main.feels_like,
      description: data.weather[0].description,
      icon: data.weather[0].icon,
      city: data.name,
    };

    return NextResponse.json(weatherInfo);
  } catch (error) {
    console.error('Error fetching weather data:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
