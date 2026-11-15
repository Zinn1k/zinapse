import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      prompt,
      count = 10,
      difficulty = "intermediate",
      apiKey: clientKey,
    } = body;

    const apiKey =
      clientKey || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Gemini API key is not configured. Please add your Gemini API Key in Settings or set GEMINI_API_KEY in .env.local.",
        },
        { status: 400 }
      );
    }

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { error: "A prompt or topic text is required to generate cards." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `
You are an expert educator and flashcard designer.
Generate high-yield, memorable flashcards for spaced repetition.
- Front: Question, term, formula, or concept.
- Back: Concise, precise answer, explanation, or translation.
- Use LaTeX syntax with $...$ or $$...$$ for math/science equations.
- Count: exactly ${count} cards.
- Difficulty: ${difficulty}.
`;

    const userPrompt = `Topic or notes:
${prompt}

Generate exactly ${count} flashcards.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `${systemInstruction}\n\n${userPrompt}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              front: { type: Type.STRING },
              back: { type: Type.STRING },
              hint: { type: Type.STRING },
              frontLang: { type: Type.STRING },
              backLang: { type: Type.STRING },
            },
            required: ["front", "back"],
          },
        },
      },
    });

    const text = response.text;
    if (!text) {
      return NextResponse.json(
        { error: "Empty response from Gemini API" },
        { status: 500 }
      );
    }

    const cards = JSON.parse(text);
    return NextResponse.json({ cards });
  } catch (error: unknown) {
    console.error("AI Generation error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate flashcards.";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
