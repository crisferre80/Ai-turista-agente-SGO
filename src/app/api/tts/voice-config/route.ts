import { NextRequest, NextResponse } from 'next/server';
import { getAppSettings } from '@/lib/getSettings';

export const dynamic = 'force-dynamic';

// Map voice names to their correct language codes
const VOICE_LANGUAGE_MAP: Record<string, string> = {
  // Spanish voices
  'es-ES-Standard-A': 'es-ES',
  'es-ES-Standard-B': 'es-ES',
  'es-ES-Standard-C': 'es-ES',
  'es-ES-Standard-D': 'es-ES',
  'es-ES-Neural2-A': 'es-ES',
  'es-ES-Neural2-B': 'es-ES',
  'es-ES-Neural2-C': 'es-ES',
  'es-ES-Neural2-D': 'es-ES',
  'es-ES-Neural2-E': 'es-ES',
  'es-ES-Neural2-F': 'es-ES',
  // Spanish Spain - Wavenet voices
  'es-ES-Wavenet-B': 'es-ES',
  'es-ES-Wavenet-C': 'es-ES',
  'es-ES-Wavenet-D': 'es-ES',
  // Spanish Spain - Studio voices
  'es-ES-Studio-C': 'es-ES',
  'es-ES-Studio-F': 'es-ES',
  // Spanish Spain - Polyglot voices
  'es-ES-Polyglot-1': 'es-ES',
  'es-419-Standard-A': 'es-419',
  'es-419-Standard-B': 'es-419',
  'es-419-Standard-C': 'es-419',
  'es-419-Neural2-A': 'es-419',
  'es-419-Neural2-B': 'es-419',
  'es-419-Neural2-C': 'es-419',
  'es-MX-Standard-A': 'es-MX',
  'es-MX-Standard-B': 'es-MX',
  'es-MX-Standard-C': 'es-MX',
  'es-MX-Neural2-A': 'es-MX',
  'es-MX-Neural2-B': 'es-MX',
  'es-AR-Standard-A': 'es-AR',
  'es-AR-Standard-B': 'es-AR',
  'es-AR-Standard-C': 'es-AR',
  'es-AR-Neural2-A': 'es-AR',
  'es-AR-Neural2-B': 'es-AR',
  'es-AR-Neural2-C': 'es-AR',
  'es-AR-Neural2-D': 'es-AR',
  'es-US-Standard-A': 'es-US',
  'es-US-Standard-B': 'es-US',
  'es-US-Standard-C': 'es-US',
  'es-US-Neural2-A': 'es-US',
  'es-US-Neural2-B': 'es-US',
  'es-US-Neural2-C': 'es-US',
  // Spanish US - Wavenet voices
  'es-US-Wavenet-A': 'es-US',
  'es-US-Wavenet-B': 'es-US',
  'es-US-Wavenet-C': 'es-US',
  // Spanish US - Studio voices
  'es-US-Studio-B': 'es-US',
  // Spanish US - News voices
  'es-US-News-D': 'es-US',
  'es-US-News-E': 'es-US',
  'es-US-News-F': 'es-US',
  'es-US-News-G': 'es-US',
  // Spanish US - Polyglot voices
  'es-US-Polyglot-1': 'es-US',
  'es-CO-Standard-A': 'es-CO',
  'es-CO-Standard-B': 'es-CO',
  'es-CO-Neural2-A': 'es-CO',
  'es-CO-Neural2-B': 'es-CO',
  'es-CL-Standard-A': 'es-CL',
  'es-CL-Standard-B': 'es-CL',
  'es-CL-Neural2-A': 'es-CL',
  'es-CL-Neural2-B': 'es-CL',
  'es-PE-Standard-A': 'es-PE',
  'es-PE-Standard-B': 'es-PE',
  'es-PE-Neural2-A': 'es-PE',
  'es-PE-Neural2-B': 'es-PE',
  'es-VE-Standard-A': 'es-VE',
  'es-VE-Standard-B': 'es-VE',
  'es-VE-Neural2-A': 'es-VE',
  'es-VE-Neural2-B': 'es-VE',
  // English voices
  'en-US-Standard-A': 'en-US',
  'en-US-Standard-B': 'en-US',
  'en-US-Standard-C': 'en-US',
  'en-US-Standard-D': 'en-US',
  'en-US-Standard-E': 'en-US',
  'en-US-Standard-F': 'en-US',
  'en-US-Standard-G': 'en-US',
  'en-US-Standard-H': 'en-US',
  'en-US-Standard-I': 'en-US',
  'en-US-Standard-J': 'en-US',
  'en-US-Neural2-A': 'en-US',
  'en-US-Neural2-C': 'en-US',
  'en-US-Neural2-D': 'en-US',
  'en-US-Neural2-E': 'en-US',
  'en-US-Neural2-F': 'en-US',
  'en-US-Neural2-G': 'en-US',
  'en-US-Neural2-H': 'en-US',
  'en-US-Neural2-I': 'en-US',
  'en-US-Neural2-J': 'en-US',
  // English US - Casual voices
  'en-US-Casual-K': 'en-US',
  // English US - Journey voices
  'en-US-Journey-D': 'en-US',
  'en-US-Journey-F': 'en-US',
  'en-US-Journey-O': 'en-US',
  // English US - News voices
  'en-US-News-K': 'en-US',
  'en-US-News-L': 'en-US',
  'en-US-News-M': 'en-US',
  'en-US-News-N': 'en-US',
  // English US - Polyglot voices
  'en-US-Polyglot-1': 'en-US',
  // English US - Studio voices
  'en-US-Studio-M': 'en-US',
  'en-US-Studio-O': 'en-US',
  'en-US-Studio-Q': 'en-US',
  // English US - Wavenet voices
  'en-US-Wavenet-A': 'en-US',
  'en-US-Wavenet-B': 'en-US',
  'en-US-Wavenet-C': 'en-US',
  'en-US-Wavenet-D': 'en-US',
  'en-US-Wavenet-E': 'en-US',
  'en-US-Wavenet-F': 'en-US',
  'en-US-Wavenet-G': 'en-US',
  'en-US-Wavenet-H': 'en-US',
  'en-US-Wavenet-I': 'en-US',
  'en-US-Wavenet-J': 'en-US',
  // English US - Chirp voices
  'en-US-Chirp-HD-D': 'en-US',
  'en-US-Chirp3-HD-Achird': 'en-US',
  'en-US-Chirp3-HD-Albireo': 'en-US',
  'en-US-Chirp3-HD-Deneb': 'en-US',
  'en-US-Chirp3-HD-Dubhe': 'en-US',
  'en-US-Chirp3-HD-Elnath': 'en-US',
  'en-US-Chirp3-HD-Hadar': 'en-US',
  'en-US-Chirp3-HD-Kochab': 'en-US',
  'en-US-Chirp3-HD-Mizar': 'en-US',
  'en-US-Chirp3-HD-Naos': 'en-US',
  'en-US-Chirp3-HD-Peacock': 'en-US',
  'en-US-Chirp3-HD-Rasalhague': 'en-US',
  'en-US-Chirp3-HD-Saiph': 'en-US',
  'en-US-Chirp3-HD-Thuban': 'en-US',
  'en-US-Chirp3-HD-Wezen': 'en-US',
  'en-GB-Standard-A': 'en-GB',
  'en-GB-Standard-B': 'en-GB',
  'en-GB-Standard-C': 'en-GB',
  'en-GB-Standard-D': 'en-GB',
  'en-GB-Standard-F': 'en-GB',
  'en-GB-Neural2-A': 'en-GB',
  'en-GB-Neural2-B': 'en-GB',
  'en-GB-Neural2-C': 'en-GB',
  'en-GB-Neural2-D': 'en-GB',
  'en-GB-Neural2-F': 'en-GB',
  // English GB - Wavenet voices
  'en-GB-Wavenet-A': 'en-GB',
  'en-GB-Wavenet-B': 'en-GB',
  'en-GB-Wavenet-C': 'en-GB',
  'en-GB-Wavenet-D': 'en-GB',
  'en-GB-Wavenet-F': 'en-GB',
  // English GB - Studio voices
  'en-GB-Studio-B': 'en-GB',
  'en-GB-Studio-C': 'en-GB',
  // English GB - News voices
  'en-GB-News-G': 'en-GB',
  'en-GB-News-H': 'en-GB',
  'en-GB-News-I': 'en-GB',
  'en-GB-News-J': 'en-GB',
  'en-GB-News-K': 'en-GB',
  'en-GB-News-L': 'en-GB',
  'en-GB-News-M': 'en-GB',
  'en-AU-Standard-A': 'en-AU',
  'en-AU-Standard-B': 'en-AU',
  'en-AU-Standard-C': 'en-AU',
  'en-AU-Standard-D': 'en-AU',
  'en-AU-Neural2-A': 'en-AU',
  'en-AU-Neural2-B': 'en-AU',
  'en-AU-Neural2-C': 'en-AU',
  'en-AU-Neural2-D': 'en-AU',
  // English AU - Wavenet voices
  'en-AU-Wavenet-A': 'en-AU',
  'en-AU-Wavenet-B': 'en-AU',
  'en-AU-Wavenet-C': 'en-AU',
  'en-AU-Wavenet-D': 'en-AU',
  // English AU - News voices
  'en-AU-News-E': 'en-AU',
  'en-AU-News-F': 'en-AU',
  'en-AU-News-G': 'en-AU',
  'en-IN-Standard-A': 'en-IN',
  'en-IN-Standard-B': 'en-IN',
  'en-IN-Standard-C': 'en-IN',
  'en-IN-Standard-D': 'en-IN',
  'en-IN-Neural2-A': 'en-IN',
  'en-IN-Neural2-B': 'en-IN',
  'en-IN-Neural2-C': 'en-IN',
  'en-IN-Neural2-D': 'en-IN',
  // English IN - Wavenet voices
  'en-IN-Wavenet-A': 'en-IN',
  'en-IN-Wavenet-B': 'en-IN',
  'en-IN-Wavenet-C': 'en-IN',
  'en-IN-Wavenet-D': 'en-IN',
  'en-CA-Standard-A': 'en-CA',
  'en-CA-Standard-B': 'en-CA',
  'en-CA-Standard-C': 'en-CA',
  'en-CA-Standard-D': 'en-CA',
  'en-CA-Neural2-A': 'en-CA',
  'en-CA-Neural2-B': 'en-CA',
  'en-CA-Neural2-C': 'en-CA',
  // English CA - Wavenet voices
  'en-CA-Wavenet-A': 'en-CA',
  'en-CA-Wavenet-B': 'en-CA',
  'en-CA-Wavenet-C': 'en-CA',
  'en-CA-Wavenet-D': 'en-CA',
  // Portuguese voices
  'pt-BR-Standard-A': 'pt-BR',
  'pt-BR-Standard-B': 'pt-BR',
  'pt-BR-Standard-C': 'pt-BR',
  'pt-BR-Neural2-A': 'pt-BR',
  'pt-BR-Neural2-B': 'pt-BR',
  'pt-BR-Neural2-C': 'pt-BR',
  // Portuguese BR - Wavenet voices
  'pt-BR-Wavenet-A': 'pt-BR',
  'pt-BR-Wavenet-B': 'pt-BR',
  'pt-BR-Wavenet-C': 'pt-BR',
  'pt-PT-Standard-A': 'pt-PT',
  'pt-PT-Standard-B': 'pt-PT',
  'pt-PT-Standard-C': 'pt-PT',
  'pt-PT-Standard-D': 'pt-PT',
  'pt-PT-Neural2-A': 'pt-PT',
  'pt-PT-Neural2-B': 'pt-PT',
  'pt-PT-Neural2-C': 'pt-PT',
  'pt-PT-Neural2-D': 'pt-PT',
  // Portuguese PT - Wavenet voices
  'pt-PT-Wavenet-A': 'pt-PT',
  'pt-PT-Wavenet-B': 'pt-PT',
  'pt-PT-Wavenet-C': 'pt-PT',
  'pt-PT-Wavenet-D': 'pt-PT',
  // French voices
  'fr-FR-Standard-A': 'fr-FR',
  'fr-FR-Standard-B': 'fr-FR',
  'fr-FR-Standard-C': 'fr-FR',
  'fr-FR-Standard-D': 'fr-FR',
  'fr-FR-Standard-E': 'fr-FR',
  'fr-FR-Neural2-A': 'fr-FR',
  'fr-FR-Neural2-B': 'fr-FR',
  'fr-FR-Neural2-C': 'fr-FR',
  'fr-FR-Neural2-D': 'fr-FR',
  'fr-FR-Neural2-E': 'fr-FR',
  'fr-FR-Neural2-F': 'fr-FR',
  'fr-FR-Neural2-G': 'fr-FR',
  // French FR - Wavenet voices
  'fr-FR-Wavenet-A': 'fr-FR',
  'fr-FR-Wavenet-B': 'fr-FR',
  'fr-FR-Wavenet-C': 'fr-FR',
  'fr-FR-Wavenet-D': 'fr-FR',
  'fr-FR-Wavenet-E': 'fr-FR',
  // French FR - Studio voices
  'fr-FR-Studio-A': 'fr-FR',
  'fr-FR-Studio-D': 'fr-FR',
  // French FR - Polyglot voices
  'fr-FR-Polyglot-1': 'fr-FR',
  // French FR - Journey voices
  'fr-FR-Journey-D': 'fr-FR',
  'fr-FR-Journey-F': 'fr-FR',
  'fr-CA-Standard-A': 'fr-CA',
  'fr-CA-Standard-B': 'fr-CA',
  'fr-CA-Standard-C': 'fr-CA',
  'fr-CA-Standard-D': 'fr-CA',
  'fr-CA-Neural2-A': 'fr-CA',
  'fr-CA-Neural2-B': 'fr-CA',
  'fr-CA-Neural2-C': 'fr-CA',
  'fr-CA-Neural2-D': 'fr-CA',
  // French CA - Wavenet voices
  'fr-CA-Wavenet-A': 'fr-CA',
  'fr-CA-Wavenet-B': 'fr-CA',
  'fr-CA-Wavenet-C': 'fr-CA',
  'fr-CA-Wavenet-D': 'fr-CA',
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const langCode = searchParams.get('lang') || 'es';
    
    // Extract language prefix (es, en, pt, fr)
    const langPrefix = langCode.slice(0, 2).toLowerCase();
    
    // Fetch app settings from database
    const settings = await getAppSettings();
    
    // Get the configured voice for this language
    const voiceSettingKey = `tts_voice_name_${langPrefix}`;
    const configuredVoice = settings && voiceSettingKey in settings ? settings[voiceSettingKey] : null;
    
    // Get the correct language code for the voice
    let actualLanguageCode = langCode;
    if (configuredVoice && configuredVoice in VOICE_LANGUAGE_MAP) {
      actualLanguageCode = VOICE_LANGUAGE_MAP[configuredVoice];
    }
    
    return NextResponse.json({
      success: true,
      language: langPrefix,
      voice: configuredVoice,
      languageCode: actualLanguageCode,
      provider: settings?.tts_provider || 'google'
    });
  } catch (error) {
    console.error('Error fetching voice config:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch voice configuration'
    }, { status: 500 });
  }
}
