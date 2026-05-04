/**
 * Mapeamento centralizado de nomes de exibição e cores de marca por loja_codigo.
 * Usado em /painel/metas para padronizar a apresentação das lojas.
 */

export interface LojaDisplay {
  nome: string;
  marca: string;
  sigla: string;
  cor: string;
}

export const LOJA_DISPLAY: Record<string, LojaDisplay> = {
  CJ_AN: { nome: "Caju Limão · Asa Norte", marca: "Caju Limão", sigla: "CJ", cor: "#F59E0B" },
  CJ_SG: { nome: "Caju Limão · SIG", marca: "Caju Limão", sigla: "CJ", cor: "#F59E0B" },
  CP_AC: { nome: "Caminito · Águas Claras", marca: "Caminito Parrilla", sigla: "CP", cor: "#EF4444" },
  CP_AN: { nome: "Caminito · Asa Norte", marca: "Caminito Parrilla", sigla: "CP", cor: "#EF4444" },
  CP_AS: { nome: "Caminito · Asa Sul", marca: "Caminito Parrilla", sigla: "CP", cor: "#EF4444" },
  CP_SG: { nome: "Caminito · SIG", marca: "Caminito Parrilla", sigla: "CP", cor: "#EF4444" },
  NZ_AC: { nome: "Nazo · Águas Claras", marca: "Nazo Japanese", sigla: "NZ", cor: "#6366F1" },
  NZ_AS: { nome: "Nazo · Asa Sul", marca: "Nazo Japanese", sigla: "NZ", cor: "#6366F1" },
  NZ_GO: { nome: "Nazo · Goiânia", marca: "Nazo Japanese", sigla: "NZ", cor: "#6366F1" },
  NZ_SG: { nome: "Nazo · SIG", marca: "Nazo Japanese", sigla: "NZ", cor: "#6366F1" },
};

export function getLojaDisplay(codigo: string): LojaDisplay {
  return (
    LOJA_DISPLAY[codigo] ?? {
      nome: codigo,
      marca: "",
      sigla: (codigo ?? "").slice(0, 2),
      cor: "#6B7280",
    }
  );
}

export function getLojaBadge(codigo: string) {
  const l = getLojaDisplay(codigo);
  return { sigla: l.sigla, cor: l.cor, nomeCompleto: l.nome, marca: l.marca };
}

/**
 * Aplicabilidade de cada métrica por loja (true = a loja é avaliada nessa métrica).
 */
export const LOJA_METRICS: Record<
  string,
  { nps: boolean; cmv_carnes: boolean; cmv_salmao: boolean; kds: boolean; conformidade: boolean }
> = {
  CJ_AN: { nps: true, cmv_carnes: false, cmv_salmao: false, kds: true, conformidade: true },
  CJ_SG: { nps: true, cmv_carnes: false, cmv_salmao: false, kds: true, conformidade: true },
  CP_AC: { nps: true, cmv_carnes: true, cmv_salmao: false, kds: true, conformidade: true },
  CP_AN: { nps: true, cmv_carnes: true, cmv_salmao: false, kds: true, conformidade: true },
  CP_AS: { nps: true, cmv_carnes: true, cmv_salmao: false, kds: true, conformidade: true },
  CP_SG: { nps: true, cmv_carnes: true, cmv_salmao: false, kds: true, conformidade: true },
  NZ_AC: { nps: true, cmv_carnes: false, cmv_salmao: true, kds: true, conformidade: true },
  NZ_AS: { nps: true, cmv_carnes: false, cmv_salmao: true, kds: true, conformidade: true },
  NZ_GO: { nps: true, cmv_carnes: false, cmv_salmao: true, kds: true, conformidade: true },
  NZ_SG: { nps: true, cmv_carnes: false, cmv_salmao: true, kds: true, conformidade: true },
};

export type LojaMetricKey = "nps" | "cmv_carnes" | "cmv_salmao" | "kds" | "conformidade";

export function lojaHasMetric(loja_codigo: string, metric: LojaMetricKey): boolean {
  return LOJA_METRICS[loja_codigo]?.[metric] ?? false;
}

const RANKING_TO_LOJA_METRIC: Record<string, LojaMetricKey> = {
  nps: "nps",
  "cmv-salmao": "cmv_salmao",
  "cmv-carnes": "cmv_carnes",
  kds: "kds",
  conformidade: "conformidade",
};

/** Aceita o RankingMetric (com hífen) usado nas views. */
export function lojaHasRankingMetric(loja_codigo: string, metric: string): boolean {
  const k = RANKING_TO_LOJA_METRIC[metric];
  return k ? lojaHasMetric(loja_codigo, k) : true;
}
