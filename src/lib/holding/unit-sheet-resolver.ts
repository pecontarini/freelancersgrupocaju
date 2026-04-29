// Resolve com SEGURANÇA quais blocos da planilha pertencem a cada unidade
// real do banco. Diferente do matcher antigo (puro fuzzy), aqui:
//
//   - Marca É OBRIGATÓRIA e bloqueante: aba/bloco da marca X nunca pode
//     alimentar unidade da marca Y. Evita preencher Foster com dados de Caju.
//   - Abas compostas (CP - NAZO SIG, CP - NAZO ÁGUAS CLARAS) são divididas
//     internamente: blocos com marker=caminito vão para a unidade Caminito,
//     blocos com marker=nazo vão para a unidade Nazo da mesma região.
//   - Aliases conhecidos (NAZO ASS=ASA SUL, NAZO GYN=GOIÂNIA, ITAM=ITAIM)
//     são tratados explicitamente.
//   - Unidades sem fonte clara ficam como "missing" — não recebem dados de
//     outra loja por aproximação.

import type { Brand, SectorKey } from "@/lib/holding/sectors";
import { deriveBrand } from "@/lib/holding/sectors";
import type {
  BlockMarker,
  ParsedBlock,
  ParsedSheet,
} from "@/lib/holding/minimum-scale-parser";

export interface UnitTarget {
  unitId: string;
  unitName: string;
  brand: Brand;
}

export interface ResolvedCell {
  sector_key: SectorKey;
  shift_type: "almoco" | "jantar";
  day_of_week: number;
  required_count: number;
  extras_count: number;
}

export interface ResolvedUnit {
  unitId: string;
  unitName: string;
  brand: Brand;
  /** Aba(s) usadas como origem. */
  sourceSheets: string[];
  /** Blocos consumidos (após filtro de marca/marker). */
  sourceBlocks: ParsedBlock[];
  /** Células finais prontas para upsert. */
  cells: ResolvedCell[];
  warnings: string[];
}

export interface ResolveResult {
  resolved: ResolvedUnit[];
  /** Unidades selecionadas que não casaram com nenhum bloco. */
  missing: UnitTarget[];
  /** Abas/blocos que sobraram sem unidade-alvo. */
  orphanSheets: Array<{ sheetName: string; reason: string }>;
}

// ---------------------------------------------------------------------------
// Normalização e tokens

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  "BAR",
]);

const REGION_ALIASES: Record<string, string[]> = {
  // canon → variações conhecidas que devem ser tratadas como sinônimo
  "ASA NORTE": ["ASA NORTE", "AN"],
  "ASA SUL": ["ASA SUL", "AS", "ASS"], // "NAZO ASS" = NAZO ASA SUL
  SUDOESTE: ["SUDOESTE", "SW"],
  SIG: ["SIG"],
  TAGUATINGA: ["TAGUATINGA", "TAG"],
  "AGUAS CLARAS": ["AGUAS CLARAS", "AGUAS"],
  GOIANIA: ["GOIANIA", "GO", "GYN"],
  ITAIM: ["ITAIM", "ITAM"],
  BOSQUE: ["BOSQUE"],
};

function tokens(s: string): string[] {
  return norm(s)
    .split(" ")
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/** Retorna o conjunto de tokens canônicos da unidade (apenas região). */
function unitRegionCanon(unitName: string): string {
  const n = norm(unitName);
  // tenta achar alias canônico
  for (const canon of Object.keys(REGION_ALIASES)) {
    if (n.includes(canon)) return canon;
  }
  // fallback: pega tokens significativos depois do prefixo (CAJU 01 -, MULT 03 -, NFE 01 -)
  const after = n.split(" - ").slice(1).join(" ").trim();
  if (after) return norm(after);
  return n;
}

/** Retorna conjunto de regiões reconhecidas presentes em um texto qualquer.
 *  IMPORTANTE: usa word boundaries reais — aliases curtos como "AS"/"AN"/"GO"
 *  NÃO podem casar dentro de palavras (ex.: "BRASILIA", "GOIANIA"). */
function regionsIn(text: string): Set<string> {
  const n = " " + norm(text) + " ";
  const out = new Set<string>();
  for (const [canon, aliases] of Object.entries(REGION_ALIASES)) {
    for (const a of aliases) {
      // exige fronteira de palavra dos dois lados
      if (n.includes(" " + a + " ")) {
        out.add(canon);
        break;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Marca da aba (do nome dela)

function deriveBrandFromSheetName(sheetName: string): Brand | "composta" | null {
  const n = norm(sheetName);
  const hasNazo = /\bNAZO\b/.test(n);
  const hasCp = /\bCP\b/.test(n) || /\bCAMINITO\b/.test(n);
  const hasCaju = /\bCAJU\b/.test(n) || /\bCAJULIMAO\b/.test(n);
  const hasFoster = /\bFB\d|\bFOSTER/.test(n);

  if (hasNazo && hasCp) return "composta";
  if (hasNazo) return "Nazo";
  if (hasCp) return "Caminito";
  if (hasCaju) return "Caju Limão";
  if (hasFoster) return "Foster's Burguer";
  return null;
}

// ---------------------------------------------------------------------------
// Resolver

function blockBrand(sheetBrand: Brand | "composta" | null, marker: BlockMarker): Brand | null {
  if (sheetBrand === "composta") {
    if (marker === "nazo") return "Nazo";
    if (marker === "caminito") return "Caminito";
    return null; // bloco neutro em aba composta = ambíguo, descartar
  }
  return sheetBrand ?? null;
}

export function resolveUnitsFromSheets(
  sheets: ParsedSheet[],
  units: UnitTarget[],
): ResolveResult {
  // Indexa unidades por marca + região canônica
  const unitsByBrand = new Map<Brand, UnitTarget[]>();
  for (const u of units) {
    const list = unitsByBrand.get(u.brand) ?? [];
    list.push(u);
    unitsByBrand.set(u.brand, list);
  }

  // Inicializa "buckets" por unidade (uma única vez)
  const buckets = new Map<string, ResolvedUnit>();
  for (const u of units) {
    buckets.set(u.unitId, {
      unitId: u.unitId,
      unitName: u.unitName,
      brand: u.brand,
      sourceSheets: [],
      sourceBlocks: [],
      cells: [],
      warnings: [],
    });
  }

  const orphanSheets: Array<{ sheetName: string; reason: string }> = [];

  for (const sheet of sheets) {
    const sheetBrand = deriveBrandFromSheetName(sheet.sheetName);
    if (!sheetBrand) {
      orphanSheets.push({
        sheetName: sheet.sheetName,
        reason: "Marca da aba não identificada.",
      });
      continue;
    }
    const sheetRegions = regionsIn(sheet.sheetName + " " + (sheet.storeHeader ?? ""));

    for (const block of sheet.blocks) {
      // descarta bloco sem setor reconhecido
      if (!block.sectorKey) continue;

      const effectiveBrand = blockBrand(sheetBrand, block.marker);
      if (!effectiveBrand) {
        orphanSheets.push({
          sheetName: sheet.sheetName,
          reason: `Aba composta com bloco neutro ("${block.rawSectorLabel}") — descartado por segurança.`,
        });
        continue;
      }

      // candidatos = unidades da marca correta
      const candidates = unitsByBrand.get(effectiveBrand) ?? [];
      if (!candidates.length) {
        orphanSheets.push({
          sheetName: sheet.sheetName,
          reason: `Sem unidade cadastrada da marca ${effectiveBrand} para receber.`,
        });
        continue;
      }

      // escolhe melhor candidato por região
      let best: { unit: UnitTarget; score: number } | null = null;
      for (const u of candidates) {
        const uRegion = unitRegionCanon(u.unitName);
        const uRegions = regionsIn(u.unitName);

        let score = 0;
        // canon presente nas regiões da aba/header?
        if (sheetRegions.has(uRegion)) score += 5;
        // interseção
        for (const r of uRegions) if (sheetRegions.has(r)) score += 2;
        // se só existe UMA unidade da marca, ela ganha por padrão
        if (candidates.length === 1) score += 3;

        if (best === null || score > best.score) best = { unit: u, score };
      }

      if (!best || best.score === 0) {
        orphanSheets.push({
          sheetName: sheet.sheetName,
          reason: `Bloco "${block.rawSectorLabel}" (${effectiveBrand}) sem unidade-alvo clara.`,
        });
        continue;
      }

      const bucket = buckets.get(best.unit.unitId)!;
      if (!bucket.sourceSheets.includes(sheet.sheetName)) {
        bucket.sourceSheets.push(sheet.sheetName);
      }
      bucket.sourceBlocks.push(block);
      // dedupe por (sector, dow, shift): última leitura vence
      const seen = new Map<string, ResolvedCell>();
      for (const c of bucket.cells) {
        seen.set(`${c.sector_key}|${c.day_of_week}|${c.shift_type}`, c);
      }
      for (const c of block.cells) {
        seen.set(`${block.sectorKey}|${c.day_of_week}|${c.shift_type}`, {
          sector_key: block.sectorKey!,
          shift_type: c.shift_type,
          day_of_week: c.day_of_week,
          required_count: c.required_count,
          extras_count: c.extras_count,
        });
      }
      bucket.cells = Array.from(seen.values());
      if (block.warnings.length) bucket.warnings.push(...block.warnings);
    }
  }

  const resolved: ResolvedUnit[] = [];
  const missing: UnitTarget[] = [];
  for (const u of units) {
    const b = buckets.get(u.unitId)!;
    if (b.cells.length > 0) resolved.push(b);
    else missing.push(u);
  }

  return { resolved, missing, orphanSheets };
}

// Helper exposto para a UI
export { deriveBrandFromSheetName };
// Helper para satisfaz import do deriveBrand (não usado aqui, mas mantém api estável)
export const _deriveBrand = deriveBrand;
