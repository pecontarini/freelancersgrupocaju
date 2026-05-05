/**
 * Funções puras para cálculo de status semafórico das metas.
 * Sem dependências externas — fácil de testar.
 */

export type MetaStatus = "excelente" | "bom" | "regular" | "redflag";

export interface ThresholdHigher {
  /** Maior é melhor. */
  meta: number;
  redFlag: number;
}

export interface ThresholdLower {
  /** Menor é melhor. */
  meta: number;
  redFlag: number;
}

/**
 * NPS CajuPAR — valor em R$/reclamação (não é 0–100).
 * Salão:    ≥120k excelente · ≥95k bom · ≥70k regular · <70k redflag
 * Delivery: ≥12k excelente  · ≥10k bom · ≥8k regular  · <8k redflag
 */
export function calcNpsStatus(
  value: number | null | undefined,
  tipo: "salao" | "delivery" = "salao",
): MetaStatus {
  if (value === null || value === undefined || Number.isNaN(value)) return "regular";
  if (tipo === "salao") {
    if (value >= 120000) return "excelente";
    if (value >= 95000) return "bom";
    if (value >= 70000) return "regular";
    return "redflag";
  }
  if (value >= 12000) return "excelente";
  if (value >= 10000) return "bom";
  if (value >= 8000) return "regular";
  return "redflag";
}

/** Formata R$/reclamação para exibição (ex.: 311545 → "R$ 311.545,00"). */
export function formatNpsDisplay(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** CMV Carnes — % de desvio sobre valor transferido (menor é melhor) */
export function calcCmvCarnesStatus(value: number | null | undefined): MetaStatus {
  if (value === null || value === undefined || Number.isNaN(value)) return "regular";
  if (value <= 0.6) return "excelente";
  if (value <= 1.0) return "bom";
  if (value <= 2.0) return "regular";
  return "redflag";
}

/** CMV Salmão — kg por R$1k vendido (menor é melhor) */
export function calcCmvSalmaoStatus(value: number | null | undefined): MetaStatus {
  if (value === null || value === undefined || Number.isNaN(value)) return "regular";
  if (value <= 1.55) return "excelente";
  if (value <= 1.65) return "bom";
  if (value <= 1.90) return "regular";
  return "redflag";
}

/**
 * Conformidade (auditoria/checklist) — meta 90%, red flag < 75%.
 */
export function calcConformidadeStatus(value: number | null | undefined): MetaStatus {
  if (value === null || value === undefined || Number.isNaN(value)) return "regular";
  if (value >= 95) return "excelente";
  if (value >= 90) return "bom";
  if (value >= 75) return "regular";
  return "redflag";
}

/**
 * Status genérico baseado em meta + redFlag e polaridade.
 *   higher: maior é melhor (ex.: NPS, KDS)
 *   lower:  menor é melhor (ex.: CMV)
 */
export function calcMetaStatus(
  value: number | null | undefined,
  meta: number,
  redFlag: number,
  polarity: "higher" | "lower" = "higher",
): MetaStatus {
  if (value === null || value === undefined || Number.isNaN(value)) return "regular";

  if (polarity === "higher") {
    if (value >= meta) return "excelente";
    const gap = meta - redFlag;
    if (value >= meta - gap * 0.25) return "bom";
    if (value >= redFlag) return "regular";
    return "redflag";
  }
  // lower
  if (value <= meta) return "excelente";
  const gap = redFlag - meta;
  if (value <= meta + gap * 0.25) return "bom";
  if (value <= redFlag) return "regular";
  return "redflag";
}

/**
 * Percentual de atingimento (0–100+) considerando polaridade.
 */
export function calcMetaPercentual(
  value: number | null | undefined,
  meta: number,
  polarity: "higher" | "lower" = "higher",
): number {
  if (value === null || value === undefined || Number.isNaN(value) || meta === 0) return 0;
  if (polarity === "higher") return Math.round((value / meta) * 100);
  // lower: meta atingida quando value <= meta
  return Math.round((meta / value) * 100);
}

/**
 * Mês de referência atual no formato 'YYYY-MM'.
 */
export function currentMesRef(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
