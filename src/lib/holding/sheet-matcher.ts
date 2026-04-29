// Casa abas de uma planilha (uma por unidade) com o nome real da unidade
// no banco. Usa normalização (sem acento, uppercase, sem pontuação) e
// score por interseção de tokens (marca + bairro/região).

import type { ExtractedSheet } from "@/lib/extract-attachment-text";
import type { Brand } from "@/lib/holding/sectors";

export interface SheetMatch {
  sheet: ExtractedSheet;
  score: number;
  reason: string;
}

const STOPWORDS = new Set([
  "DE",
  "DA",
  "DO",
  "DAS",
  "DOS",
  "E",
  "A",
  "O",
  "AS",
  "OS",
  "PARRILLA",
  "BURGUER",
  "JAPANESE",
  "GRILL",
  "RESTAURANTE",
  "UNIDADE",
  "LOJA",
  "ESCALA",
  "MINIMA",
  "MÍNIMA",
]);

// Aliases conhecidos para tokens de marca
const BRAND_TOKENS: Record<Brand, string[]> = {
  "Caju Limão": ["CAJU", "CAJULIMAO", "LIMAO"],
  Caminito: ["CAMINITO", "CP"],
  Nazo: ["NAZO"],
  "Foster's Burguer": ["FOSTER", "FOSTERS"],
};

// Aliases regionais frequentes
const REGION_ALIASES: Record<string, string[]> = {
  ASA: ["ASA"],
  NORTE: ["NORTE", "AN"],
  SUL: ["SUL", "AS"],
  SUDOESTE: ["SUDOESTE", "SW"],
  SIG: ["SIG"],
  TAGUATINGA: ["TAGUATINGA", "TAG"],
  AGUAS: ["AGUAS", "ÁGUAS"],
  CLARAS: ["CLARAS"],
};

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function expandTokens(tokens: string[]): Set<string> {
  const out = new Set<string>(tokens);
  for (const t of tokens) {
    const aliases = REGION_ALIASES[t];
    if (aliases) for (const a of aliases) out.add(a);
  }
  return out;
}

function brandTokens(brand: Brand): Set<string> {
  return new Set(BRAND_TOKENS[brand].map(normalize));
}

/**
 * Tenta achar a aba que melhor descreve a unidade.
 * Score = interseção de tokens (marca + região).
 * Threshold mínimo: precisa bater pelo menos 1 token de marca + 1 token específico,
 * ou 2 tokens específicos da região.
 */
export function matchSheetToUnit(
  sheets: ExtractedSheet[],
  unitName: string,
  brand: Brand,
): SheetMatch | null {
  if (!sheets?.length) return null;
  const unitTokens = expandTokens(tokenize(unitName));
  const bTokens = brandTokens(brand);

  let best: SheetMatch | null = null;

  for (const sheet of sheets) {
    const sheetTokens = expandTokens(tokenize(sheet.name));
    if (!sheetTokens.size) continue;

    // tokens da unidade que NÃO são marca (regionais, específicos)
    const regionTokens = [...unitTokens].filter((t) => !bTokens.has(t));

    const brandHit = [...bTokens].some((t) => sheetTokens.has(t));
    const regionHits = regionTokens.filter((t) => sheetTokens.has(t)).length;

    // Score: marca vale 2, cada região vale 3
    const score = (brandHit ? 2 : 0) + regionHits * 3;

    // Threshold: precisa marca + 1 região, OU 2 regiões
    const valid = (brandHit && regionHits >= 1) || regionHits >= 2;
    if (!valid) continue;

    if (!best || score > best.score) {
      best = {
        sheet,
        score,
        reason: `marca=${brandHit ? "ok" : "não"}, regiões=${regionHits}`,
      };
    }
  }

  return best;
}

export interface MatchReport {
  unitId: string;
  unitName: string;
  brand: Brand;
  match: SheetMatch | null;
}

export function buildMatchReport(
  sheets: ExtractedSheet[],
  units: Array<{ unitId: string; unitName: string; brand: Brand }>,
): MatchReport[] {
  return units.map((u) => ({
    unitId: u.unitId,
    unitName: u.unitName,
    brand: u.brand,
    match: matchSheetToUnit(sheets, u.unitName, u.brand),
  }));
}
