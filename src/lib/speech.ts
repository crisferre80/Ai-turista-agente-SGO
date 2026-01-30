// src/lib/speech.ts
export interface VoiceOption {
  name: string;
  lang: string;
  voiceURI: string;
}

// Helper function to clean text for natural speech
const cleanTextForSpeech = (text: string): string => {
  return text
    // Remove markdown formatting
    .replace(/\*\*(.*?)\*\*/g, '$1') // Bold markdown **text** -> text
    .replace(/\*(.*?)\*/g, '$1') // Italic markdown *text* -> text
    .replace(/`(.*?)`/g, '$1') // Code markdown `text` -> text
    .replace(/#{1,6}\s/g, '') // Headers # ## ### -> remove
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links [text](url) -> text
    .replace(/!\[(.*?)\]\(.*?\)/g, '$1') // Images ![alt](url) -> alt
    // Remove special characters that sound unnatural
    .replace(/[_~\[\]{}|\\<>]/g, ' ') // Remove underscores, tildes, brackets, etc.
    .replace(/\n+/g, '. ') // Replace newlines with periods for natural pauses
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    // Make it more conversational
    .replace(/\b(USD|ARS|\$)\s*(\d+)/gi, '$2 pesos') // Currency formatting
    .replace(/\bkm\b/gi, 'kilómetros') // Abbreviations
    .replace(/\bm\b(?=\s|$)/gi, 'metros') // Meters
    .replace(/&/g, 'y') // Ampersands
    .replace(/\s+\./g, '.') // Remove spaces before periods
    .trim();
};

let voices: SpeechSynthesisVoice[] = [];

export const loadVoices = (): Promise<SpeechSynthesisVoice[]> => {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    voices = synth.getVoices();
    if (voices.length > 0) {
      resolve(voices);
    } else {
      synth.onvoiceschanged = () => {
        voices = synth.getVoices();
        resolve(voices);
      };
    }
  });
};

export const getVoices = (): SpeechSynthesisVoice[] => {
  return voices;
};

export const getSelectedVoice = (): SpeechSynthesisVoice | null => {
  // Always use the first Spanish voice as default for Santi's character
  return voices.find(voice => voice.lang.startsWith('es')) || voices[0] || null;
};

let _isNarrating = false;
let _currentAudio: HTMLAudioElement | null = null;

export const stopSantiNarration = () => {
  try {
    // Stop OpenAI audio if playing
    if (_currentAudio) {
      _currentAudio.pause();
      _currentAudio.currentTime = 0;
      _currentAudio = null;
    }
    
    // Stop Web Speech API if speaking
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  } catch (e) { /* ignore */ }
  _isNarrating = false;
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('santi:narration:end'));
    }
  } catch (e) { /* ignore */ }
};

export const santiSpeak = (text: string, opts?: { source?: string, force?: boolean }): void => {
  if (_isNarrating && !opts?.force) {
    console.warn('santiSpeak: already narrating, skipping new narration to avoid overlap');
    return;
  }

  // Clean text for natural speech
  const cleanText = cleanTextForSpeech(text);
  console.log('santiSpeak: Original text:', text.substring(0, 50));
  console.log('santiSpeak: Cleaned text:', cleanText.substring(0, 50));

  // Si force=true, detener cualquier narración en curso
  if (opts?.force && _isNarrating) {
    console.log('🔇 santiSpeak: Force mode - stopping current narration');
    stopSantiNarration();
  }

  console.log('santiSpeak called with source:', opts?.source, opts?.force ? '(FORCED)' : '');

  try {
    if (typeof window !== 'undefined') {
      // Announce narration to any listeners (e.g., Map) so they can react and navigate
      window.dispatchEvent(new CustomEvent('santi:narrate', { 
        detail: { text: cleanText, source: opts?.source, force: opts?.force } // Use cleaned text
      }));
      console.log('Dispatched santi:narrate event with source:', opts?.source, 'force:', opts?.force);
      // Note: 'santi:narration:start' will be emitted when audio actually starts playing
    }
  } catch (e) { /* ignore dispatch errors */ }

  _isNarrating = true;

  // Helper function to use Web Speech API as fallback
  const useBrowserTTS = () => {
    console.log('Using browser TTS as fallback');
    try {
      const synth = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(cleanText); // Use cleaned text
      const spanishVoice = voices.find(v => v.lang.startsWith('es')) || voices[0];
      if (spanishVoice) utterance.voice = spanishVoice;
      utterance.lang = 'es-ES';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      
      // Emit start event when speech begins
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('santi:narration:start', { detail: { text: cleanText, source: opts?.source } }));
        }
      } catch (e) { /* ignore */ }
      
      utterance.onend = () => {
        try {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('santi:narration:end'));
          }
        } catch (e) { /* ignore */ }
        _isNarrating = false;
      };
      
      utterance.onerror = (e) => {
        console.error('Browser TTS error:', e);
        try {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('santi:narration:end'));
          }
        } catch (ee) { /* ignore */ }
        _isNarrating = false;
      };
      
      synth.speak(utterance);
    } catch (err) {
      console.error('Browser TTS failed:', err);
      _isNarrating = false;
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('santi:narration:end'));
        }
      } catch (e) { /* ignore */ }
    }
  };

  fetch('/api/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: cleanText }), // Use cleaned text
  })
    .then(response => {
      if (response.status === 401) throw new Error("API_KEY_MISSING");
      if (response.status === 429) throw new Error("QUOTA_EXCEEDED");
      if (!response.ok) throw new Error("Audio generation failed");
      return response.blob();
    })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      _currentAudio = audio;
      audio.play().then(() => {
        // Emit start event when audio actually begins playing
        try {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('santi:narration:start', { detail: { text: cleanText, source: opts?.source } }));
          }
        } catch (e) { /* ignore */ }
      }).catch(err => {
        console.warn("Autoplay blocked:", err);
        // Still emit start for UI purposes even if autoplay is blocked
        try {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('santi:narration:start', { detail: { text, source: opts?.source } }));
          }
        } catch (e) { /* ignore */ }
      });
      audio.onended = () => {
        try {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('santi:narration:end'));
          }
        } catch (e) { /* ignore */ }
        URL.revokeObjectURL(url);
        _currentAudio = null;
        _isNarrating = false;
      };
      audio.onerror = (e) => {
        console.error('Audio playback error', e);
        try {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('santi:narration:end'));
          }
        } catch (ee) { /* ignore */ }
        URL.revokeObjectURL(url);
        _currentAudio = null;
        _isNarrating = false;
      };
    })
    .catch(error => {
      console.error("TTS Error:", error);
      
      // Use browser TTS as fallback for quota exceeded or API errors
      if (error.message === "QUOTA_EXCEEDED" || error.message === "Audio generation failed") {
        useBrowserTTS();
        return;
      }
      
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('santi:narration:end'));
        }
      } catch (e) { /* ignore */ }
      _isNarrating = false;
      
      if (error.message === "API_KEY_MISSING") {
        console.warn("OpenAI API key missing, falling back to browser TTS");
        useBrowserTTS();
      }
    });
};

export const santiNarrate = santiSpeak;

// Initialize voices on load
if (typeof window !== 'undefined') {
  loadVoices();
}