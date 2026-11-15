/**
 * Levenshtein distance algorithm for fuzzy typo-tolerant answer validation.
 */

export function levenshteinDistance(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix: number[][] = Array.from({ length: bn + 1 }, () =>
    new Array(an + 1).fill(0)
  );

  for (let i = 0; i <= an; i++) matrix[0][i] = i;
  for (let j = 0; j <= bn; j++) matrix[j][0] = j;

  for (let j = 1; j <= bn; j++) {
    for (let i = 1; i <= an; i++) {
      if (b.charAt(j - 1) === a.charAt(i - 1)) {
        matrix[j][i] = matrix[j - 1][i - 1];
      } else {
        matrix[j][i] = Math.min(
          matrix[j - 1][i - 1] + 1, // substitution
          matrix[j][i - 1] + 1, // insertion
          matrix[j - 1][i] + 1 // deletion
        );
      }
    }
  }

  return matrix[bn][an];
}

export function normalizeAnswerText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[$`*#_\[\]()'".,;:!?\\/-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface CheckAnswerResult {
  isExact: boolean;
  isClose: boolean;
  distance: number;
  userNormalized: string;
  expectedNormalized: string;
}

export function checkAnswerWithFuzzy(
  userAnswer: string,
  expectedAnswer: string
): CheckAnswerResult {
  const userNorm = normalizeAnswerText(userAnswer);
  const expNorm = normalizeAnswerText(expectedAnswer);

  if (userNorm === expNorm) {
    return {
      isExact: true,
      isClose: true,
      distance: 0,
      userNormalized: userNorm,
      expectedNormalized: expNorm,
    };
  }

  // Also check if user entered one of comma-separated or slash-separated valid synonyms
  const synonyms = expectedAnswer
    .split(/[,;/]/)
    .map((s) => normalizeAnswerText(s))
    .filter(Boolean);

  if (synonyms.some((syn) => syn === userNorm)) {
    return {
      isExact: true,
      isClose: true,
      distance: 0,
      userNormalized: userNorm,
      expectedNormalized: expNorm,
    };
  }

  const distance = levenshteinDistance(userNorm, expNorm);

  // Levenshtein tolerance:
  // - 1 typo allowed for words with length >= 4
  // - 2 typos allowed for words with length >= 7
  let isClose = false;
  if (expNorm.length >= 7 && distance <= 2) {
    isClose = true;
  } else if (expNorm.length >= 4 && distance === 1) {
    isClose = true;
  }

  return {
    isExact: false,
    isClose,
    distance,
    userNormalized: userNorm,
    expectedNormalized: expNorm,
  };
}
