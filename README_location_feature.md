# Funcionalidad: Descripción de Ubicación con IA

## Resumen
Se implementó una nueva funcionalidad que permite a Santi (avatar con IA de OpenAI) describir la ubicación actual del usuario cuando este pregunta sobre dónde se encuentra. El sistema utiliza:

- **Coordenadas GPS** del usuario obtenidas del mapa
- **Geocoding reverso** de Mapbox para identificar el lugar
- **OpenAI GPT-4** para generar descripciones contextuales ricas
- **Sistema TTS existente** para narrar la respuesta

## Cómo Funciona

### 1. Detección de Ubicación del Usuario
- El componente `Map.tsx` detecta la ubicación del usuario mediante:
  - Control de geolocalización de Mapbox
  - API de geolocalización nativa del navegador
- Las coordenadas se emiten al componente padre mediante el callback `onLocationChange`

### 2. Preguntas sobre Ubicación
El usuario puede preguntar sobre su ubicación actual usando frases como:
- "¿Dónde estoy?"
- "¿Cuál es mi ubicación actual?"
- "Describe este lugar"
- "¿En qué parte estoy?"
- "Háblame de donde estoy"
- Y muchas más variaciones...

### 3. Procesamiento de la Consulta

#### API de Chat (`/api/chat`)
- Detecta si la pregunta del usuario es sobre ubicación actual
- Verifica que existan coordenadas disponibles
- Llama al nuevo endpoint `/api/location-context`

#### API de Contexto de Ubicación (`/api/location-context`)
1. **Geocoding Reverso** (Mapbox):
   - Convierte coordenadas (lat, lng) → nombre de lugar
   - Extrae información detallada: barrio, ciudad, país, tipo de zona
   
2. **Consulta a OpenAI**:
   - Genera un prompt contextual con las coordenadas y el lugar identificado
   - OpenAI GPT-4o responde con una descripción amigable y conversacional
   - Incluye datos culturales, históricos o turísticos relevantes
   - Menciona atractivos cercanos si los conoce

3. **Respuesta**:
   - Retorna la descripción generada por IA
   - Se envía al sistema de narración TTS existente
   - Santi narra la respuesta al usuario

## Archivos Modificados

### Nuevos Archivos
- `src/app/api/location-context/route.ts` - Endpoint para obtener contexto de ubicación

### Archivos Modificados
- `src/app/page.tsx` - Agrega estado `userLocation` y lo pasa a componentes
- `src/components/Map.tsx` - Emite coordenadas del usuario mediante `onLocationChange`
- `src/components/ChatInterface.tsx` - Recibe y pasa `userLocation` al API
- `src/app/api/chat/route.ts` - Detecta preguntas sobre ubicación y consulta contexto

## Ejemplo de Uso

**Usuario**: Activa su ubicación en el mapa (botón de brújula)

**Sistema**: Detecta coordenadas: -27.7834, -64.2599

**Usuario**: "¿Dónde estoy?"

**Sistema**:
1. Detecta que es una pregunta sobre ubicación
2. Llama a Mapbox Geocoding: Identifica "Centro, Santiago del Estero Capital"
3. Consulta a OpenAI con contexto geográfico
4. OpenAI responde: "¡Estás en el corazón de Santiago del Estero Capital! Esta es una zona céntrica y comercial, cerca de la histórica Plaza Libertad. Por aquí encontrarás varios sitios culturales como la Catedral Basílica y el Museo de Ciencias Antropológicas..."
5. Santi narra la respuesta con voz sintética

## Ventajas

✅ **Inteligente**: Usa IA generativa para crear respuestas únicas y contextuales
✅ **Preciso**: Geocoding reverso proporciona nombres reales de lugares
✅ **Cultural**: OpenAI puede mencionar datos históricos y turísticos relevantes
✅ **Natural**: Las respuestas son conversacionales, no robóticas
✅ **Integrado**: Funciona perfectamente con el sistema de narración TTS existente
✅ **Base de datos global**: OpenAI consulta su conocimiento entrenado sobre el mundo
✅ **Flexible**: Reconoce múltiples formas de preguntar sobre ubicación

## Configuración Requerida

### Variables de Entorno
```env
NEXT_PUBLIC_MAPBOX_TOKEN=tu_token_mapbox
OPENAI_API_KEY=tu_api_key_openai
```

### APIs Utilizadas
- **Mapbox Geocoding API**: Conversión de coordenadas a nombres de lugares
- **OpenAI API**: Generación de descripciones contextuales (modelo gpt-4o)

## Notas Técnicas

- La detección de preguntas sobre ubicación es **case-insensitive**
- Soporta variaciones con y sin tildes ("ubicación" y "ubicacion")
- Si no hay coordenadas disponibles, el chat funciona normalmente sin contexto de ubicación
- Si el endpoint de ubicación falla, el sistema continúa con el flujo de chat estándar
- La temperatura de OpenAI está en 0.8 para respuestas creativas pero coherentes
- El prompt del sistema instruye a OpenAI para usar un tono amigable y mencionar datos de Santiago del Estero cuando sea relevante
