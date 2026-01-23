// src/lib/speech.ts
export interface VoiceOption {
  name: string;
  lang: string;
  voiceURI: string;
}

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
    if (_currentAudio) {
      _currentAudio.pause();
      _currentAudio.currentTime = 0;
      _currentAudio = null;
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

  try {
    if (typeof window !== 'undefined') {
      // Announce narration to any listeners (e.g., Map) so they can react and navigate
      window.dispatchEvent(new CustomEvent('santi:narrate', { detail: { text, source: opts?.source } }));
      window.dispatchEvent(new CustomEvent('santi:narration:start', { detail: { text, source: opts?.source } }));
    }
  } catch (e) { /* ignore dispatch errors */ }

  _isNarrating = true;

  fetch('/api/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
    .then(response => {
      if (response.status === 401) throw new Error("API_KEY_MISSING");
      if (!response.ok) throw new Error("Audio generation failed");
      return response.blob();
    })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      _currentAudio = audio;
      audio.play().catch(err => {
        console.warn("Autoplay blocked:", err);
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
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('santi:narration:end'));
        }
      } catch (e) { /* ignore */ }
      _isNarrating = false;
      if (error.message === "API_KEY_MISSING") {
        alert("Santi no puede hablar porque falta la OPENAI_API_KEY");
      }
    });
};

export const santiNarrate = santiSpeak;

// Initialize voices on load
if (typeof window !== 'undefined') {
  loadVoices();
}