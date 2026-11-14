import { GoogleGenAI, Type } from "@google/genai";

export interface GeneratedCard {
  front: string;
  back: string;
  hint?: string;
  frontLang?: string;
  backLang?: string;
}

export interface GenerateDeckOptions {
  apiKey?: string;
  prompt: string;
  count?: number;
  difficulty?: "beginner" | "intermediate" | "advanced";
  sourceLanguage?: string;
  targetLanguage?: string;
}

/**
 * Generates flashcards using the @google/genai SDK with structured JSON responseSchema.
 */
export async function generateFlashcardsWithAI(
  options: GenerateDeckOptions
): Promise<GeneratedCard[]> {
  const {
    apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY,
    prompt,
    count = 10,
    difficulty = "intermediate",
  } = options;

  // If no client-side key, call our internal Next.js API route
  if (!apiKey) {
    const res = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "Failed to generate flashcards with AI.");
    }

    const data = await res.json();
    return data.cards;
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
You are an expert educational content creator and flashcard designer.
Your task is to generate high-yield, memorable flashcards for spaced repetition study.
Format requirements:
- Use clear, unambiguous wording.
- For math, physics, or chemistry, use LaTeX syntax enclosed in $...$ for inline or $$...$$ for display equations.
- Use Markdown bolding, lists, and formatting where helpful for readability.
- Generate exactly ${count} cards.
- Target difficulty level: ${difficulty}.
`;

  const userPrompt = `Generate ${count} educational flashcards based on the following topic or source material:
"${prompt}"

Ensure terms/questions go on the 'front', and comprehensive definitions, formulas, or answers go on the 'back'.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `${systemInstruction}\n\n${userPrompt}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        description: "List of generated flashcards",
        items: {
          type: Type.OBJECT,
          properties: {
            front: {
              type: Type.STRING,
              description: "The question, term, formula, or concept on the front side",
            },
            back: {
              type: Type.STRING,
              description: "The definition, explanation, solution, or translation on the back side",
            },
            hint: {
              type: Type.STRING,
              description: "A short subtle hint or mnemonic",
            },
            frontLang: {
              type: Type.STRING,
              description: "BCP-47 language code for front TTS (e.g., en-US, es-ES)",
            },
            backLang: {
              type: Type.STRING,
              description: "BCP-47 language code for back TTS",
            },
          },
          required: ["front", "back"],
        },
      },
    },
  });

  const responseText = response.text;
  if (!responseText) {
    throw new Error("No response text received from Gemini API");
  }

  const parsed = JSON.parse(responseText) as GeneratedCard[];
  return parsed;
}
