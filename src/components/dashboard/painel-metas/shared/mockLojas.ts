/**
 * Adapter: converte snapshots vindos do Supabase em estrutura usada pelo painel
 * (RankingView / ComparativoView). Tipos e helpers de normalização permanecem aqui.
 */
import type { MetaKey, MetaPolarity } from "./types";
import type { MetaSnapshotRow } from "@/hooks/useMetasSnapshot";

export type Bandeira = "CP" | "NZ" | "CJ" | "FB" | "OUTRA";

export interface LojaSnapshot {
  code: string;
  nome: string;
  bandeira: Bandeira;
  values: Record<RankingMetric, number | null>;
  prev: Record<RankingMetric, number | null>;
  redFlag: boolean;
}

export type RankingMetric =
  | "nps"
  | "cmv-salmao"
  | "cmv-carnes"
  | "kds"
  | "conformidade";

export const METRIC_META: Record<
  RankingMetric,
  { label: string; suffix: string; polarity: MetaPolarity; meta: number; redFlag: number }
> = {
  nps: { label: "NPS Salão (R$/recl.)", suffix: "", polarity: "higher", meta: 120000, redFlag: 70000 },
  "cmv-salmao": { label: "CMV Salmão (kg/R$1k)", suffix: "kg", polarity: "lower", meta: 1.55, redFlag: 1.90 },
  "cmv-carnes": { label: "CMV Carnes (desvio %)", suffix: "%", polarity: "lower", meta: 0.6, redFlag: 2.0 },
  kds: { label: "KDS Black Target (%)", suffix: "%", polarity: "lower", meta: 5, redFlag: 10 },
  conformidade: { label: "Conformidade", suffix: "%", polarity: "higher", meta: 90, redFlag: 75 },
};

export const RANKING_METRICS: RankingMetric[] = [
  "nps",
  "cmv-salmao",
  "cmv-carnes",
  "kds",
  "conformidade",
];

const BANDEIRA_NOME: Record<Bandeira, string> = {
  CP: "Caminito Parrilla",
  NZ: "Nazo Japanese",
  CJ: "Caju Limão",
  FB: "Foster's Burguer",
  OUTRA: "Loja",
};

function bandeiraFromCode(code: string): Bandeira {
  const prefix = code.split("_")[0]?.toUpperCase();
  if (prefix === "CP" || prefix === "NZ" || prefix === "CJ" || prefix === "FB") return prefix;
  return "OUTRA";
}

function unidadeSufixo(code: string): string {
  const map: Record<string, string> = {
    SG: "Setor Sul",
    AN: "Asa Norte",
    AC: "Águas Claras",
    AS: "Asa Sul",
    GO: "Goiânia",
  };
  const suf = code.split("_")[1] ?? "";
  return map[suf] ?? suf;
}

/**
 * Converte uma linha do Supabase em estrutura consumida pelas views.
 */
export function snapshotToLoja(row: MetaSnapshotRow): LojaSnapshot {
  const bandeira = bandeiraFromCode(row.loja_codigo);
  return {
    code: row.loja_codigo,
    bandeira,
    nome: `${BANDEIRA_NOME[bandeira]} · ${unidadeSufixo(row.loja_codigo)}`,
    values: {
      nps: row.nps,
      "cmv-salmao": row.cmv_salmao,
      "cmv-carnes": row.cmv_carnes,
      kds: row.kds,
      conformidade: row.conformidade,
    },
    prev: {
      nps: row.nps_anterior,
      "cmv-salmao": row.cmv_salmao_anterior,
      "cmv-carnes": row.cmv_carnes_anterior,
      kds: row.kds_anterior,
      conformidade: row.conformidade_anterior,
    },
    redFlag: row.red_flag,
  };
}

/**
 * Normaliza um valor para 0–100 considerando meta e polaridade.
 */
export function normalizeMetric(metric: RankingMetric, value: number | null): number {
  if (value === null || Number.isNaN(value)) return 0;
  const { polarity, meta, redFlag } = METRIC_META[metric];
  if (polarity === "higher") {
    if (value >= meta) return 100;
    if (value <= redFlag) return 0;
    return Math.round(((value - redFlag) / (meta - redFlag)) * 100);
  }
  if (value <= meta) return 100;
  if (value >= redFlag) return 0;
  return Math.round(((redFlag - value) / (redFlag - meta)) * 100);
}

export function bandeiraStyles(b: Bandeira): { label: string; ring: string; bg: string; text: string } {
  switch (b) {
    case "CP":
      return { label: "CP", ring: "ring-red-400/40", bg: "bg-red-500/15", text: "text-red-600 dark:text-red-300" };
    case "NZ":
      return { label: "NZ", ring: "ring-sky-400/40", bg: "bg-sky-500/15", text: "text-sky-300" };
    case "CJ":
      return { label: "CJ", ring: "ring-emerald-400/40", bg: "bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-300" };
    case "FB":
      return { label: "FB", ring: "ring-amber-400/40", bg: "bg-amber-500/15", text: "text-amber-700 dark:text-amber-300" };
    default:
      return { label: "—", ring: "ring-white/20", bg: "bg-foreground/10", text: "text-foreground/80" };
  }
}

export type RankingStatus = "excelente" | "bom" | "regular" | "redflag";

export function statusFor(metric: RankingMetric, value: number | null): RankingStatus {
  if (value === null) return "regular";
  const norm = normalizeMetric(metric, value);
  if (norm >= 90) return "excelente";
  if (norm >= 70) return "bom";
  if (norm >= 40) return "regular";
  return "redflag";
}

export function variation(
  metric: RankingMetric,
  value: number | null,
  prev: number | null,
): number {
  if (value === null || prev === null) return 0;
  const { polarity } = METRIC_META[metric];
  const diff = value - prev;
  return polarity === "higher" ? diff : -diff;
}

export function isMetaKeyRanking(k: MetaKey): k is RankingMetric {
  return (RANKING_METRICS as MetaKey[]).includes(k);
}
