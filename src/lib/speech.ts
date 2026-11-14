/**
 * Client-side Text-To-Speech (TTS) using the browser's native Web Speech API.
 * Adheres to Zero Paid Storage principle (no cloud audio storage/APIs needed).
 */

export interface SpeechOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  voiceName?: string;
}

let activeUtterance: SpeechSynthesisUtterance | null = null;

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function stopSpeech(): void {
  if (isSpeechSupported()) {
    window.speechSynthesis.cancel();
    activeUtterance = null;
  }
}

export function detectLanguageFromText(text: string): "ru-RU" | "en-US" {
  if (/[а-яё]/i.test(text)) {
    return "ru-RU";
  }
  return "en-US";
}

export function getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!isSpeechSupported()) return Promise.resolve([]);

  return new Promise((resolve) => {
    let voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    const onVoicesChanged = () => {
      voices = window.speechSynthesis.getVoices();
      window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
      resolve(voices);
    };

    window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);

    // Fallback timeout in case voiceschanged event doesn't fire
    setTimeout(() => {
      resolve(window.speechSynthesis.getVoices());
    }, 500);
  });
}

export async function speakText(
  text: string,
  options: SpeechOptions = {}
): Promise<void> {
  if (!isSpeechSupported()) {
    console.warn("Web Speech API is not supported in this browser environment.");
    return;
  }

  // Stop any currently ongoing speech
  stopSpeech();

  const cleanText = text
    .replace(/[$`*#_\[\]()]/g, "") // strip markdown/latex markers for cleaner speech
    .trim();

  if (!cleanText) return;

  const utterance = new SpeechSynthesisUtterance(cleanText);
  activeUtterance = utterance;

  const detectedLang = detectLanguageFromText(cleanText);
  const targetLang = options.lang || detectedLang;
  const { rate = 1.0, pitch = 1.0, voiceName } = options;

  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.lang = targetLang;

  const voices = await getAvailableVoices();

  if (voiceName) {
    const selectedVoice = voices.find((v) => v.name === voiceName);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    }
  }

  if (!utterance.voice) {
    const langVoice = voices.find((v) =>
      v.lang.toLowerCase().replace("_", "-").startsWith(targetLang.toLowerCase().slice(0, 2))
    );
    if (langVoice) {
      utterance.voice = langVoice;
    }
  }

  return new Promise((resolve) => {
    utterance.onend = () => {
      if (activeUtterance === utterance) {
        activeUtterance = null;
      }
      resolve();
    };

    utterance.onerror = () => {
      if (activeUtterance === utterance) {
        activeUtterance = null;
      }
      resolve();
    };

    window.speechSynthesis.speak(utterance);
  });
}
