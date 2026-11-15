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
  prompt: string;
  text?: string;
  count?: number;
  difficulty?: "beginner" | "intermediate" | "advanced";
  style?: "term-definition" | "exam-qa" | "concept-summary";
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
  const userApiKey = options.userApiKey || options.apiKey;

  const res = await fetch("/api/generate-deck", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      count: options.count || 10,
      difficulty: options.difficulty || "intermediate",
      style: options.style || "term-definition",
      language: options.language || "auto",
      userApiKey,
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
