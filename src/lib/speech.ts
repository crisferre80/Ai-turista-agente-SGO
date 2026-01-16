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

export const santiSpeak = (text: string): void => {
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
      audio.play().catch(err => {
        console.warn("Autoplay blocked:", err);
      });
    })
    .catch(error => {
      console.error("TTS Error:", error);
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