import { describe, it, expect } from "vitest";
import {
  levenshteinDistance,
  normalizeAnswerText,
  checkAnswerWithFuzzy,
} from "../levenshtein";

describe("Levenshtein distance & fuzzy matching", () => {
  it("calculates exact edit distances correctly", () => {
    expect(levenshteinDistance("kitten", "sitting")).toBe(3);
    expect(levenshteinDistance("hello", "hello")).toBe(0);
    expect(levenshteinDistance("", "abc")).toBe(3);
    expect(levenshteinDistance("мир", "мор")).toBe(1);
  });

  it("normalizes text by stripping punctuation and casing", () => {
    expect(normalizeAnswerText("  Hello, World! ")).toBe("hello world");
    expect(normalizeAnswerText("$E = mc^2$")).toBe("e = mc^2");
    expect(normalizeAnswerText("¿Dónde está?")).toBe("¿dónde está");
  });

  it("identifies exact matches regardless of casing and punctuation", () => {
    const res = checkAnswerWithFuzzy("Madrid", "madrid");
    expect(res.isExact).toBe(true);
    expect(res.isClose).toBe(true);
    expect(res.distance).toBe(0);
  });

  it("detects minor typos for typo tolerance", () => {
    // 1 typo in a 6-letter word (length >= 4 and distance === 1)
    const res = checkAnswerWithFuzzy("Madris", "Madrid");
    expect(res.isExact).toBe(false);
    expect(res.isClose).toBe(true);
    expect(res.distance).toBe(1);
  });

  it("detects 2 typos for longer words (length >= 7 and distance <= 2)", () => {
    // 2 typos in an 8-letter word
    const res = checkAnswerWithFuzzy("Barcelnoa", "Barcelona");
    expect(res.isExact).toBe(false);
    expect(res.isClose).toBe(true);
    expect(res.distance).toBe(2);
  });

  it("marks distant answers as incorrect", () => {
    const res = checkAnswerWithFuzzy("London", "Madrid");
    expect(res.isExact).toBe(false);
    expect(res.isClose).toBe(false);
  });
});
