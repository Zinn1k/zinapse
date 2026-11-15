import { describe, it, expect } from "vitest";
import { parseCardsFromText, previewImport, detectSeparators } from "../importer";

describe("Batch importer", () => {
  it("detects tab-separated Quizlet export format", () => {
    const raw = "Bonjour\tHello\nMerci\tThank you\nAu revoir\tGoodbye";
    const detected = detectSeparators(raw);
    expect(detected.termSeparator).toBe("\t");
    expect(detected.cardSeparator).toBe("\n");

    const cards = parseCardsFromText(raw);
    expect(cards.length).toBe(3);
    expect(cards[0].term).toBe("Bonjour");
    expect(cards[0].definition).toBe("Hello");
    expect(cards[1].term).toBe("Merci");
    expect(cards[1].definition).toBe("Thank you");
  });

  it("detects dash-separated terms", () => {
    const raw = "Dog - Собака\nCat - Кошка\nBird - Птица";
    const detected = detectSeparators(raw);
    expect(detected.termSeparator).toBe(" - ");

    const cards = parseCardsFromText(raw);
    expect(cards.length).toBe(3);
    expect(cards[0].term).toBe("Dog");
    expect(cards[0].definition).toBe("Собака");
  });

  it("extracts hints from card definitions", () => {
    const raw = "Hola\tПривет [hint: испанское приветствие]\nAdios\tПока (hint: прощание)";
    const cards = parseCardsFromText(raw);
    expect(cards.length).toBe(2);
    expect(cards[0].term).toBe("Hola");
    expect(cards[0].definition).toBe("Привет");
    expect(cards[0].hint).toBe("испанское приветствие");
    expect(cards[1].term).toBe("Adios");
    expect(cards[1].definition).toBe("Пока");
    expect(cards[1].hint).toBe("прощание");
  });

  it("previewImport validates lines and reports invalid entries", () => {
    const raw = "Valid\tCard\nAnother\tOne\nInvalidLineWithoutSeparator";
    const preview = previewImport(raw, { termSeparator: "\t", cardSeparator: "\n" });
    expect(preview.validCount).toBe(2);
    expect(preview.invalidLines.length).toBe(1);
    expect(preview.invalidLines[0]).toBe("InvalidLineWithoutSeparator");
  });
});
