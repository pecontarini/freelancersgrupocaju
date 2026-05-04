/**
 * Tipos e helpers de domínio compartilhados pelo Painel de Metas.
 */

export type MetaKey =
  | "visao-geral"
  | "nps"
  | "cmv-salmao"
  | "cmv-carnes"
  | "kds"
  | "conformidade"
  | "red-flag"
  | "planos"
  | "diario"
  | "holding"
  | "ranking"
  | "comparativo";

/**
 * Polaridade da meta:
 *   higher: maior valor é melhor (NPS, conformidade, target preta OK%)
 *   lower:  menor valor é melhor (CMV salmão kg/R$1k, desvio de carnes %)
 */
export type MetaPolarity = "higher" | "lower";

export interface MetaDefinition {
  key: MetaKey;
  label: string;
  /** Descrição curta exibida no header da página. */
  description: string;
  /** lucide-react icon name (importado dinamicamente onde for usado). */
  iconKey: string;
  /** Cor "dot" da sidebar (token semântico HSL). */
  dotToken: string;
  polarity?: MetaPolarity;
  /** Apenas admin/operator pode ver. */
  adminOnly?: boolean;
  /** Sufixo de unidade exibido nos valores ("%", "kg", etc). */
  unitSuffix?: string;
}

export interface MonthValue {
  /** "YYYY-MM" */
  mes: string;
  /** Rótulo curto "Abr/26". */
  label: string;
  value: number | null;
}

export interface SixMonthSummary {
  metaCode: MetaKey;
  polarity: MetaPolarity;
  series: MonthValue[];
  current: MonthValue | null;
  best: MonthValue | null;
  worst: MonthValue | null;
}

export interface RankingRow {
  loja_id: string;
  nome: string;
  /** Valor primário usado para ordenar. */
  value: number | null;
  /** Texto de apoio (ex.: "3 reclamações"). */
  hint?: string;
  /** Faixa de cor (excelente/bom/regular/redflag). */
  faixa?: "excelente" | "bom" | "regular" | "redflag" | null;
}
