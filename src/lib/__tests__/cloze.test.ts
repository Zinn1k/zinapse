import { describe, it, expect } from "vitest";
import {
  hasCloze,
  extractClozeItems,
  getUniqueClozeIndices,
  renderClozeQuestion,
  renderClozeAnswer,
  stripClozeSyntax,
  wrapWithCloze,
} from "../cloze";

describe("Cloze Deletion Engine", () => {
  it("detects cloze syntax", () => {
    expect(hasCloze("The capital of France is {{c1::Paris}}.")).toBe(true);
    expect(hasCloze("Photosynthesis produces {{glucose}}.")).toBe(true);
    expect(hasCloze("No cloze here.")).toBe(false);
  });

  it("extracts cloze items with index and optional hint", () => {
    const text = "Water boils at {{c1::100°C::temperature}} and freezes at {{c2::0°C}}.";
    const items = extractClozeItems(text);

    expect(items.length).toBe(2);
    expect(items[0]).toEqual({
      raw: "{{c1::100°C::temperature}}",
      index: 1,
      answer: "100°C",
      hint: "temperature",
    });
    expect(items[1]).toEqual({
      raw: "{{c2::0°C}}",
      index: 2,
      answer: "0°C",
      hint: undefined,
    });
  });

  it("extracts unique indices", () => {
    const text = "{{c1::First}} and {{c2::Second}} and {{c1::Another First}}";
    expect(getUniqueClozeIndices(text)).toEqual([1, 2]);
  });

  it("masks target cloze in question view while leaving other clozes readable", () => {
    const text = "{{c1::Madrid}} is the capital of {{c2::Spain}}.";

    // Asking for c1
    const q1 = renderClozeQuestion(text, 1);
    expect(q1).toBe("[**...**] is the capital of Spain.");

    // Asking for c2
    const q2 = renderClozeQuestion(text, 2);
    expect(q2).toBe("Madrid is the capital of [**...**].");
  });

  it("displays hint if provided in question view", () => {
    const text = "Mitochondria is the {{c1::powerhouse::role}} of the cell.";
    const q = renderClozeQuestion(text, 1);
    expect(q).toBe("Mitochondria is the [**role**] of the cell.");
  });

  it("reveals highlighted answer in answer view", () => {
    const text = "Mitochondria is the {{c1::powerhouse::role}} of the cell.";
    const ans = renderClozeAnswer(text, 1);
    expect(ans).toBe("Mitochondria is the **powerhouse** of the cell.");
  });

  it("strips cloze syntax to plain text", () => {
    const text = "The capital of {{c1::France::country}} is {{c2::Paris}}.";
    expect(stripClozeSyntax(text)).toBe("The capital of France is Paris.");
  });

  it("wraps text in cloze syntax correctly", () => {
    expect(wrapWithCloze("Paris", 1)).toBe("{{c1::Paris}}");
    expect(wrapWithCloze("Paris", 2, "city")).toBe("{{c2::Paris::city}}");
  });
});
