/**
 * Cloze Deletion utility for fill-in-the-blank style flashcards.
 *
 * Supported syntaxes:
 * - Anki standard: {{c1::answer::hint}} or {{c1::answer}}
 * - Simplified: {{answer::hint}} or {{answer}}
 */

export interface ClozeItem {
  raw: string;
  index: number;
  answer: string;
  hint?: string;
}

const CLOZE_REGEX = /\{\{(?:c(\d+)::)?([^}:]+)(?:::([^}]+))?\}\}/g;

/**
 * Checks if the text contains at least one cloze deletion block.
 */
export function hasCloze(text: string): boolean {
  if (!text) return false;
  return /\{\{(?:c\d+::)?[^}]+\}\}/.test(text);
}

/**
 * Extracts all cloze items from a text string.
 */
export function extractClozeItems(text: string): ClozeItem[] {
  if (!text) return [];
  const items: ClozeItem[] = [];
  const regex = new RegExp(CLOZE_REGEX.source, "g");
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    const index = match[1] ? parseInt(match[1], 10) : 1;
    const answer = (match[2] || "").trim();
    const hint = match[3] ? match[3].trim() : undefined;

    items.push({ raw, index, answer, hint });
  }

  return items;
}

/**
 * Returns a sorted list of unique cloze indices present in the text (e.g. [1, 2]).
 */
export function getUniqueClozeIndices(text: string): number[] {
  const items = extractClozeItems(text);
  const indices = Array.from(new Set(items.map((i) => i.index))).sort((a, b) => a - b);
  return indices.length > 0 ? indices : [1];
}

/**
 * Renders the question view for a cloze card:
 * The target cloze (by index) is masked with [...] or [hint].
 * Other clozes in the same text display their actual answer.
 */
export function renderClozeQuestion(text: string, targetIndex: number = 1): string {
  if (!hasCloze(text)) return text;

  return text.replace(new RegExp(CLOZE_REGEX.source, "g"), (_match, indexStr, answer, hint) => {
    const clozeIndex = indexStr ? parseInt(indexStr, 10) : 1;
    if (clozeIndex === targetIndex) {
      const cue = hint ? hint.trim() : "...";
      return `[**${cue}**]`;
    }
    return answer.trim();
  });
}

/**
 * Renders the answer/revealed view for a cloze card:
 * The target cloze is highlighted (bold + colored mark).
 * Other clozes show their answer normally.
 */
export function renderClozeAnswer(text: string, targetIndex: number = 1): string {
  if (!hasCloze(text)) return text;

  return text.replace(new RegExp(CLOZE_REGEX.source, "g"), (_match, indexStr, answer) => {
    const clozeIndex = indexStr ? parseInt(indexStr, 10) : 1;
    const cleanAnswer = answer.trim();
    if (clozeIndex === targetIndex) {
      return `**${cleanAnswer}**`;
    }
    return cleanAnswer;
  });
}

/**
 * Strips all cloze syntax, leaving only the clean answers in text.
 */
export function stripClozeSyntax(text: string): string {
  if (!text) return "";
  return text.replace(new RegExp(CLOZE_REGEX.source, "g"), (_match, _idx, answer) => {
    return answer.trim();
  });
}

/**
 * Wraps selected text into a Cloze deletion format: {{c1::selectedText}}
 */
export function wrapWithCloze(selectedText: string, index: number = 1, hint?: string): string {
  if (!selectedText) return `{{c${index}::...}}`;
  if (hint && hint.trim()) {
    return `{{c${index}::${selectedText}::${hint.trim()}}}`;
  }
  return `{{c${index}::${selectedText}}}`;
}
