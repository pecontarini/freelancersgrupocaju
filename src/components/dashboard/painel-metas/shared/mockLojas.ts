/**
 * Mock determinístico para as 10 lojas reais da rede.
 * Substituir por dados reais (Supabase) na fase de integração.
 */
import type { MetaKey, MetaPolarity } from "./types";

export type LojaCode =
  | "CP_SG"
  | "CP_AN"
  | "CP_AC"
  | "CP_AS"
  | "NZ_SG"
  | "NZ_AS"
  | "NZ_AC"
  | "NZ_GO"
  | "CJ_SG"
  | "CJ_AN";

export type Bandeira = "CP" | "NZ" | "CJ";

export interface LojaMock {
  code: LojaCode;
  nome: string;
  bandeira: Bandeira;
  /** valores absolutos por métrica (mês corrente). */
  values: Record<RankingMetric, number>;
  /** valores do mês anterior (para variação). */
  prev: Record<RankingMetric, number>;
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
  nps: { label: "NPS Salão", suffix: "", polarity: "higher", meta: 80, redFlag: 60 },
  "cmv-salmao": { label: "CMV Salmão (kg/R$1k)", suffix: "kg", polarity: "lower", meta: 1.2, redFlag: 1.6 },
  "cmv-carnes": { label: "CMV Carnes (desvio %)", suffix: "%", polarity: "lower", meta: 5, redFlag: 8 },
  kds: { label: "KDS Target Preta", suffix: "%", polarity: "higher", meta: 80, redFlag: 65 },
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
};

function bandeiraFromCode(code: LojaCode): Bandeira {
  return code.split("_")[0] as Bandeira;
}

function unidadeSufixo(code: LojaCode): string {
  const map: Record<string, string> = {
    SG: "Setor Sul",
    AN: "Asa Norte",
    AC: "Águas Claras",
    AS: "Asa Sul",
    GO: "Goiânia",
  };
  return map[code.split("_")[1]] ?? code.split("_")[1];
}

const RAW: Array<{ code: LojaCode; values: Record<RankingMetric, number>; prev: Record<RankingMetric, number> }> = [
  { code: "CP_SG", values: { nps: 82, "cmv-salmao": 1.18, "cmv-carnes": 4.2, kds: 84, conformidade: 93 }, prev: { nps: 79, "cmv-salmao": 1.22, "cmv-carnes": 5.1, kds: 80, conformidade: 91 } },
  { code: "CP_AN", values: { nps: 76, "cmv-salmao": 1.31, "cmv-carnes": 6.4, kds: 78, conformidade: 88 }, prev: { nps: 78, "cmv-salmao": 1.28, "cmv-carnes": 5.9, kds: 80, conformidade: 89 } },
  { code: "CP_AC", values: { nps: 71, "cmv-salmao": 1.45, "cmv-carnes": 8.6, kds: 70, conformidade: 79 }, prev: { nps: 73, "cmv-salmao": 1.42, "cmv-carnes": 8.1, kds: 72, conformidade: 81 } },
  { code: "CP_AS", values: { nps: 80, "cmv-salmao": 1.22, "cmv-carnes": 5.0, kds: 82, conformidade: 91 }, prev: { nps: 77, "cmv-salmao": 1.25, "cmv-carnes": 5.4, kds: 79, conformidade: 90 } },
  { code: "NZ_SG", values: { nps: 85, "cmv-salmao": 1.15, "cmv-carnes": 3.8, kds: 88, conformidade: 95 }, prev: { nps: 82, "cmv-salmao": 1.20, "cmv-carnes": 4.2, kds: 85, conformidade: 93 } },
  { code: "NZ_AS", values: { nps: 78, "cmv-salmao": 1.28, "cmv-carnes": 5.5, kds: 79, conformidade: 87 }, prev: { nps: 80, "cmv-salmao": 1.24, "cmv-carnes": 5.1, kds: 81, conformidade: 88 } },
  { code: "NZ_AC", values: { nps: 68, "cmv-salmao": 1.62, "cmv-carnes": 9.2, kds: 64, conformidade: 73 }, prev: { nps: 70, "cmv-salmao": 1.58, "cmv-carnes": 8.7, kds: 66, conformidade: 75 } },
  { code: "NZ_GO", values: { nps: 74, "cmv-salmao": 1.34, "cmv-carnes": 6.8, kds: 75, conformidade: 84 }, prev: { nps: 72, "cmv-salmao": 1.36, "cmv-carnes": 7.0, kds: 74, conformidade: 82 } },
  { code: "CJ_SG", values: { nps: 81, "cmv-salmao": 1.20, "cmv-carnes": 4.6, kds: 83, conformidade: 92 }, prev: { nps: 79, "cmv-salmao": 1.23, "cmv-carnes": 4.9, kds: 81, conformidade: 90 } },
  { code: "CJ_AN", values: { nps: 73, "cmv-salmao": 1.40, "cmv-carnes": 7.3, kds: 72, conformidade: 81 }, prev: { nps: 75, "cmv-salmao": 1.37, "cmv-carnes": 7.0, kds: 74, conformidade: 83 } },
];

export const LOJAS_MOCK: LojaMock[] = RAW.map((r) => {
  const bandeira = bandeiraFromCode(r.code);
  return {
    code: r.code,
    bandeira,
    nome: `${BANDEIRA_NOME[bandeira]} · ${unidadeSufixo(r.code)}`,
    values: r.values,
    prev: r.prev,
  };
});

/**
 * Normaliza um valor para 0–100 considerando meta e polaridade.
 * higher: 100 quando value ≥ meta; 0 quando value ≤ redFlag.
 * lower:  100 quando value ≤ meta; 0 quando value ≥ redFlag.
 */
export function normalizeMetric(metric: RankingMetric, value: number): number {
  const { polarity, meta, redFlag } = METRIC_META[metric];
  if (polarity === "higher") {
    if (value >= meta) return 100;
    if (value <= redFlag) return 0;
    return Math.round(((value - redFlag) / (meta - redFlag)) * 100);
  }
  // lower
  if (value <= meta) return 100;
  if (value >= redFlag) return 0;
  return Math.round(((redFlag - value) / (redFlag - meta)) * 100);
}

export function bandeiraStyles(b: Bandeira): { label: string; ring: string; bg: string; text: string } {
  switch (b) {
    case "CP":
      return { label: "CP", ring: "ring-red-400/40", bg: "bg-red-500/15", text: "text-red-300" };
    case "NZ":
      return { label: "NZ", ring: "ring-sky-400/40", bg: "bg-sky-500/15", text: "text-sky-300" };
    case "CJ":
      return { label: "CJ", ring: "ring-emerald-400/40", bg: "bg-emerald-500/15", text: "text-emerald-300" };
  }
}

export type RankingStatus = "excelente" | "bom" | "regular" | "redflag";

export function statusFor(metric: RankingMetric, value: number): RankingStatus {
  const norm = normalizeMetric(metric, value);
  if (norm >= 90) return "excelente";
  if (norm >= 70) return "bom";
  if (norm >= 40) return "regular";
  return "redflag";
}

export function variation(metric: RankingMetric, value: number, prev: number): number {
  // Retorna variação positiva quando "melhorou" segundo a polaridade.
  const { polarity } = METRIC_META[metric];
  const diff = value - prev;
  return polarity === "higher" ? diff : -diff;
}

export function isMetaKeyRanking(k: MetaKey): k is RankingMetric {
  return (RANKING_METRICS as MetaKey[]).includes(k);
}
