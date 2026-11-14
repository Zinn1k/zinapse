/**
 * Parser for fast batch card import from Quizlet, Excel, CSV, Anki, and plain text.
 */

export interface ParsedCard {
  term: string;
  definition: string;
  hint?: string;
}

export interface ParseOptions {
  termSeparator?: string; // e.g. "\t", ";", " - ", ","
  cardSeparator?: string; // e.g. "\n", "\n\n"
}

export interface ImportPreview {
  cards: ParsedCard[];
  validCount: number;
  invalidLines: string[];
  detectedTermSeparator: string;
  detectedCardSeparator: string;
}

/**
 * Automatically inspects sample text to detect the most probable term and card separators.
 */
export function detectSeparators(rawText: string): {
  termSeparator: string;
  cardSeparator: string;
} {
  // 1. Detect card separator (is it separated by blank lines \n\n or single \n?)
  const hasDoubleNewline = /\n\s*\n/.test(rawText.trim());
  const cardSeparator = hasDoubleNewline ? "\n\n" : "\n";

  // 2. Detect term separator
  const sampleBlocks = rawText
    .split(cardSeparator)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 15);

  let tabScore = 0;
  let dashScore = 0;
  let semicolonScore = 0;
  let commaScore = 0;

  for (const block of sampleBlocks) {
    if (block.includes("\t")) tabScore++;
    if (block.includes(" - ")) dashScore++;
    if (block.includes(";")) semicolonScore++;
    if (block.includes(",")) commaScore++;
  }

  let termSeparator = "\t"; // Default Quizlet
  const maxScore = Math.max(tabScore, dashScore, semicolonScore, commaScore);

  if (maxScore > 0) {
    if (tabScore === maxScore) termSeparator = "\t";
    else if (dashScore === maxScore) termSeparator = " - ";
    else if (semicolonScore === maxScore) termSeparator = ";";
    else if (commaScore === maxScore) termSeparator = ",";
  }

  return { termSeparator, cardSeparator };
}

/**
 * Strips CSV/quoted wraps like "hello" -> hello
 */
function cleanQuotedText(text: string): string {
  let clean = text.trim();
  if (
    (clean.startsWith('"') && clean.endsWith('"')) ||
    (clean.startsWith("'") && clean.endsWith("'"))
  ) {
    clean = clean.slice(1, -1);
  }
  return clean.replace(/""/g, '"').trim();
}

/**
 * Parses raw text into structured cards.
 */
export function parseCardsFromText(
  rawText: string,
  options: ParseOptions = {}
): ParsedCard[] {
  if (!rawText || !rawText.trim()) return [];

  const detected = detectSeparators(rawText);
  const termSep = options.termSeparator || detected.termSeparator;
  const cardSep = options.cardSeparator || detected.cardSeparator;

  const rawBlocks = rawText
    .split(cardSep)
    .map((b) => b.trim())
    .filter(Boolean);

  const results: ParsedCard[] = [];

  for (const block of rawBlocks) {
    let parts: string[] = [];

    if (termSep === "\t") {
      parts = block.split("\t");
    } else if (termSep === " - ") {
      parts = block.split(/\s+-\s+/);
    } else if (termSep === ";") {
      parts = block.split(";");
    } else if (termSep === ",") {
      // Basic CSV parser
      parts = parseCsvLine(block);
    } else {
      parts = block.split(termSep);
    }

    if (parts.length >= 2) {
      const term = cleanQuotedText(parts[0]);
      const definition = cleanQuotedText(parts.slice(1).join(termSep === " - " ? " - " : termSep));

      if (term && definition) {
        // Extract optional hint format like (hint: ...) or [hint: ...]
        let hint: string | undefined = undefined;
        let cleanDef = definition;
        const hintMatch = definition.match(/\[hint:\s*([^\]]+)\]/i) || definition.match(/\(hint:\s*([^)]+)\)/i);
        if (hintMatch) {
          hint = hintMatch[1].trim();
          cleanDef = cleanDef.replace(hintMatch[0], "").trim();
        }

        results.push({
          term,
          definition: cleanDef,
          hint,
        });
      }
    }
  }

  return results;
}

/**
 * Generates an import preview for user inspection before saving.
 */
export function previewImport(
  rawText: string,
  options: ParseOptions = {}
): ImportPreview {
  const detected = detectSeparators(rawText);
  const termSep = options.termSeparator || detected.termSeparator;
  const cardSep = options.cardSeparator || detected.cardSeparator;

  const blocks = rawText
    .split(cardSep)
    .map((b) => b.trim())
    .filter(Boolean);

  const parsed = parseCardsFromText(rawText, {
    termSeparator: termSep,
    cardSeparator: cardSep,
  });

  const invalidLines: string[] = [];

  for (const block of blocks) {
    let hasSep = false;
    if (termSep === " - ") {
      hasSep = /\s+-\s+/.test(block);
    } else {
      hasSep = block.includes(termSep);
    }

    if (!hasSep) {
      invalidLines.push(block.length > 60 ? block.slice(0, 60) + "..." : block);
    }
  }

  return {
    cards: parsed,
    validCount: parsed.length,
    invalidLines,
    detectedTermSeparator: termSep,
    detectedCardSeparator: cardSep,
  };
}

/**
 * Simple CSV line splitter respecting quotes
 */
function parseCsvLine(text: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}
