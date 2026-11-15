import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      text,
      count = 10,
      difficulty = "intermediate", // "beginner" | "intermediate" | "advanced"
      style = "term-definition", // "term-definition" | "exam-qa" | "concept-summary"
      language = "auto", // "auto" | "ru" | "en"
      userApiKey,
    } = body;

    // Prioritize server env GEMINI_API_KEY, fallback to user-provided key, then NEXT_PUBLIC_
    const apiKey =
      process.env.GEMINI_API_KEY ||
      userApiKey ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (
      !apiKey ||
      apiKey.trim() === "" ||
      apiKey === "your_gemini_api_key_here"
    ) {
      return NextResponse.json(
        {
          error:
            "Ключ Google Gemini API не настроен. Добавьте GEMINI_API_KEY в .env.local или укажите свой персональный API-ключ в настройках формы.",
          code: "MISSING_API_KEY",
        },
        { status: 400 }
      );
    }

    if (!text || typeof text !== "string" || text.trim().length < 20) {
      return NextResponse.json(
        {
          error:
            "Текст слишком короткий для генерации карточек. Вставьте конспект, лекцию или билеты объемом не менее 20 символов.",
          code: "TEXT_TOO_SHORT",
        },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Determine style instructions
    let styleGuideline = "";
    if (style === "exam-qa") {
      styleGuideline =
        "- Format: Exam Question & Concise Answer. 'term' should be the examination question, 'definition' should be the structured and clear answer.";
    } else if (style === "concept-summary") {
      styleGuideline =
        "- Format: Core Concept & Deep Summary. 'term' is the fundamental concept or law, 'definition' includes key points, mechanics, and practical implications.";
    } else {
      styleGuideline =
        "- Format: Classic Flashcard (Term — Definition). 'term' is a concise concept, word, theorem, or entity. 'definition' is an accurate explanation.";
    }

    // Determine language instruction
    let langGuideline = "";
    if (language === "ru") {
      langGuideline =
        "All output (title, description, term, definition, hint) MUST be in Russian.";
    } else if (language === "en") {
      langGuideline =
        "All output (title, description, term, definition, hint) MUST be in English.";
    } else {
      langGuideline =
        "Match the predominant language of the provided input text.";
    }

    const systemInstruction = `
You are an expert pedagogical AI specializing in spaced repetition and high-yield flashcard design.
Analyze the source material and synthesize exactly ${count} high-quality flashcards.

Key requirements:
1. ${styleGuideline}
2. ${langGuideline}
3. Difficulty level: ${difficulty}.
4. For math, physics, or chemistry formulas, strictly use LaTeX notation:
   - Inline math: $formula$ (e.g., $E = mc^2$, $\\lambda = \\frac{h}{p}$)
   - Block equations: $$formula$$ (e.g., $$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$)
5. 'hint' should provide a concise memory cue, mnemonic, or context clue (maximum 10 words).
6. Provide an informative, concise deck title and a 1-sentence description.
`;

    const userPrompt = `Source Material:
"""
${text.trim()}
"""

Create a flashcard deck with exactly ${count} cards according to the specifications.`;

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `${systemInstruction}\n\n${userPrompt}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: "Concise title for the deck",
              },
              description: {
                type: Type.STRING,
                description: "1-sentence summary of the deck content",
              },
              cards: {
                type: Type.ARRAY,
                description: "List of flashcards",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    term: {
                      type: Type.STRING,
                      description: "Front of the card (question, term, or concept)",
                    },
                    definition: {
                      type: Type.STRING,
                      description: "Back of the card (answer or definition)",
                    },
                    hint: {
                      type: Type.STRING,
                      description: "Helpful mnemonic or memory cue",
                    },
                  },
                  required: ["term", "definition"],
                },
              },
            },
            required: ["title", "cards"],
          },
        },
      });
    } catch (apiErr: unknown) {
      const errMessage = apiErr instanceof Error ? apiErr.message : String(apiErr);
      if (errMessage.includes("not found") || errMessage.includes("404")) {
        response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: `${systemInstruction}\n\n${userPrompt}`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                cards: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      term: { type: Type.STRING },
                      definition: { type: Type.STRING },
                      hint: { type: Type.STRING },
                    },
                    required: ["term", "definition"],
                  },
                },
              },
              required: ["title", "cards"],
            },
          },
        });
      } else {
        throw apiErr;
      }
    }

    const outputText = response.text;
    if (!outputText) {
      return NextResponse.json(
        { error: "Получен пустой ответ от Gemini API.", code: "EMPTY_RESPONSE" },
        { status: 500 }
      );
    }

    const result = JSON.parse(outputText);

    if (!result.cards || !Array.isArray(result.cards)) {
      return NextResponse.json(
        {
          error: "Некорректная структура ответа от языковой модели.",
          code: "INVALID_SCHEMA",
        },
        { status: 500 }
      );
    }

    interface RawCard {
      term?: unknown;
      definition?: unknown;
      hint?: unknown;
    }

    return NextResponse.json({
      title: result.title || "Новая колода",
      description: result.description || "",
      cards: (result.cards as RawCard[]).map((c) => ({
        term: String(c.term || "").trim(),
        definition: String(c.definition || "").trim(),
        hint: c.hint ? String(c.hint).trim() : "",
      })),
    });
  } catch (error: unknown) {
    console.error("Gemini Deck Generation Error:", error);

    const message = error instanceof Error ? error.message : String(error);
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? (error as { status?: number }).status
        : undefined;

    if (
      message.includes("API_KEY_INVALID") ||
      message.includes("invalid API key") ||
      status === 401 ||
      status === 403
    ) {
      return NextResponse.json(
        {
          error:
            "Недействительный ключ Gemini API. Пожалуйста, проверьте ключ в .env.local или в настройках формы.",
          code: "INVALID_KEY",
        },
        { status: 401 }
      );
    }

    if (
      message.includes("RESOURCE_EXHAUSTED") ||
      message.includes("Quota exceeded") ||
      status === 429
    ) {
      return NextResponse.json(
        {
          error:
            "Превышен лимит запросов к Gemini API (429 Quota Exceeded). Подождите несколько секунд или используйте персональный API-ключ.",
          code: "RATE_LIMIT",
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error:
          message ||
          "Произошла ошибка при генерации колоды с помощью Gemini AI. Попробуйте еще раз.",
        code: "SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}
