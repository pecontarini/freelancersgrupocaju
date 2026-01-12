/**
 * Fuzzy matching utilities for string comparison
 * Uses Levenshtein distance algorithm for similarity detection
 */

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits needed to change one string into the other
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  const m = s1.length;
  const n = s2.length;
  
  // Create a matrix
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));
  
  // Initialize first column
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  
  // Initialize first row
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }
  
  // Fill in the rest of the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Calculate similarity percentage between two strings (0 to 1)
 * 1 = identical, 0 = completely different
 */
export function stringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);
  
  if (s1 === s2) return 1;
  
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  
  if (maxLength === 0) return 1;
  
  return 1 - distance / maxLength;
}

/**
 * Normalize a string for comparison:
 * - Remove extra spaces
 * - Convert to uppercase
 * - Remove accents
 */
export function normalizeString(str: string): string {
  if (!str) return "";
  
  return str
    .trim()
    .toUpperCase()
    // Remove extra spaces
    .replace(/\s+/g, " ")
    // Normalize accents
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Find the best match for a value from a list of options
 * Returns the best match and its similarity score
 */
export interface MatchResult {
  original: string;
  match: string | null;
  matchId: string | null;
  similarity: number;
  isExactMatch: boolean;
  needsReview: boolean;
}

export interface MatchOption {
  id: string;
  nome: string;
}

const EXACT_MATCH_THRESHOLD = 1.0;
const AUTO_MATCH_THRESHOLD = 0.85; // Above this, auto-accept
const SUGGESTION_THRESHOLD = 0.5;  // Below this, no suggestion

/**
 * Find the best matching option for an input string
 */
export function findBestMatch(
  input: string,
  options: MatchOption[]
): MatchResult {
  const normalizedInput = normalizeString(input);
  
  // First, try exact match
  const exactMatch = options.find(
    opt => normalizeString(opt.nome) === normalizedInput
  );
  
  if (exactMatch) {
    return {
      original: input,
      match: exactMatch.nome,
      matchId: exactMatch.id,
      similarity: 1,
      isExactMatch: true,
      needsReview: false,
    };
  }
  
  // Find best fuzzy match
  let bestMatch: MatchOption | null = null;
  let bestSimilarity = 0;
  
  for (const option of options) {
    const similarity = stringSimilarity(input, option.nome);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = option;
    }
  }
  
  // Determine if it needs review
  if (bestSimilarity >= AUTO_MATCH_THRESHOLD && bestMatch) {
    return {
      original: input,
      match: bestMatch.nome,
      matchId: bestMatch.id,
      similarity: bestSimilarity,
      isExactMatch: false,
      needsReview: false, // Auto-accepted due to high similarity
    };
  }
  
  if (bestSimilarity >= SUGGESTION_THRESHOLD && bestMatch) {
    return {
      original: input,
      match: bestMatch.nome,
      matchId: bestMatch.id,
      similarity: bestSimilarity,
      isExactMatch: false,
      needsReview: true, // Needs manual review
    };
  }
  
  // No good match found
  return {
    original: input,
    match: null,
    matchId: null,
    similarity: bestSimilarity,
    isExactMatch: false,
    needsReview: true, // Needs manual selection
  };
}

/**
 * Get all matches for an array of values, identifying which need review
 */
export interface MappingEntry {
  rowIndex: number;
  original: string;
  selectedMatch: string | null;
  selectedMatchId: string | null;
  similarity: number;
  isExactMatch: boolean;
  needsReview: boolean;
  suggestions: MatchOption[];
}

export function mapValuesToOptions(
  values: { rowIndex: number; value: string }[],
  options: MatchOption[]
): MappingEntry[] {
  const uniqueValues = new Map<string, number[]>();
  
  // Group rows by normalized value
  values.forEach(({ rowIndex, value }) => {
    const normalized = normalizeString(value);
    if (!uniqueValues.has(normalized)) {
      uniqueValues.set(normalized, []);
    }
    uniqueValues.get(normalized)!.push(rowIndex);
  });
  
  const results: MappingEntry[] = [];
  
  values.forEach(({ rowIndex, value }) => {
    const matchResult = findBestMatch(value, options);
    
    // Get top 5 suggestions sorted by similarity
    const allSuggestions = options
      .map(opt => ({
        ...opt,
        similarity: stringSimilarity(value, opt.nome),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
    
    results.push({
      rowIndex,
      original: value,
      selectedMatch: matchResult.match,
      selectedMatchId: matchResult.matchId,
      similarity: matchResult.similarity,
      isExactMatch: matchResult.isExactMatch,
      needsReview: matchResult.needsReview,
      suggestions: allSuggestions,
    });
  });
  
  return results;
}

/**
 * Check if all mappings are resolved (no items need review without a selection)
 */
export function areMappingsComplete(mappings: MappingEntry[]): boolean {
  return mappings.every(
    m => m.isExactMatch || m.selectedMatchId !== null
  );
}
