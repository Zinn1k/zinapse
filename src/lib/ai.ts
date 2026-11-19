import { db } from "./db";

export interface GeneratedCard {
  term: string;
  definition: string;
  hint?: string;
  front: string;
  back: string;
}

export interface GenerateDeckOptions {
  userApiKey?: string;
  apiKey?: string;
  model?: string;
  prompt: string;
  text?: string;
  image?: string; // base64 data URL
  count?: number;
  difficulty?: "beginner" | "intermediate" | "advanced";
  style?: "term-definition" | "exam-qa" | "concept-summary" | "cloze";
  language?: "auto" | "ru" | "en";
}

export interface GenerateDeckResult {
  title: string;
  description: string;
  cards: GeneratedCard[];
}

/**
 * Calls server-side /api/generate-deck powered by official @google/genai SDK
 */
export async function generateFlashcardsWithAI(
  options: GenerateDeckOptions
): Promise<GeneratedCard[]> {
  const result = await generateDeckWithAI(options);
  return result.cards;
}

export async function generateDeckWithAI(
  options: GenerateDeckOptions
): Promise<GenerateDeckResult> {
  const text = options.text || options.prompt;
  let userApiKey = options.userApiKey || options.apiKey;
  let model = options.model;

  // If in browser and missing userApiKey or model, fetch from saved settings
  if (typeof window !== "undefined" && (!userApiKey || !model)) {
    try {
      const setting = await db.settings.get("current");
      if (setting) {
        if (!userApiKey && setting.geminiApiKey) {
          userApiKey = setting.geminiApiKey;
        }
        if (!model && setting.geminiModel) {
          model = setting.geminiModel;
        }
      }
    } catch {
      // ignore Dexie lookup errors
    }
  }

  const res = await fetch("/api/generate-deck", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      image: options.image,
      count: options.count || 10,
      difficulty: options.difficulty || "intermediate",
      style: options.style || "term-definition",
      language: options.language || "auto",
      userApiKey,
      model: model || "gemini-3.5-flash-lite",
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Ошибка при генерации карточек с помощью AI.");
  }

  interface ApiCard {
    term: string;
    definition: string;
    hint?: string;
  }

  const cards: GeneratedCard[] = (data.cards as ApiCard[]).map((c) => ({
    term: c.term,
    definition: c.definition,
    hint: c.hint,
    front: c.term,
    back: c.definition,
  }));

  return {
    title: data.title || "Новая колода",
    description: data.description || "",
    cards,
  };
}
