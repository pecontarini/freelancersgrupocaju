/**
 * Configuração hardcoded de cargos × métricas × pesos R$.
 * Define quais cargos são responsáveis por cada métrica e o valor da variável.
 *
 * Faixas em R$ por status seguem regra proporcional:
 *   excelente = 100% do peso
 *   bom       = 66% do peso
 *   regular   = 33% do peso
 *   redflag   = 0
 */
import type { RankingMetric } from "./mockLojas";
import type { RankingStatus } from "./mockLojas";

export interface CargoMeta {
  cargoKey: string;
  cargoLabel: string;
  pesoReais: number;
  faixas: Record<RankingStatus, number>;
}

function makeFaixas(peso: number): Record<RankingStatus, number> {
  return {
    excelente: peso,
    bom: Math.round(peso * 0.66),
    regular: Math.round(peso * 0.33),
    redflag: 0,
  };
}

function cargo(key: string, label: string, peso: number): CargoMeta {
  return { cargoKey: key, cargoLabel: label, pesoReais: peso, faixas: makeFaixas(peso) };
}

export const METAS_CARGO_CONFIG: Record<RankingMetric, CargoMeta[]> = {
  nps: [
    cargo("gerente_front", "Gerente de Front", 1500),
    cargo("gerente_back", "Gerente de Back", 1500),
  ],
  "cmv-carnes": [
    cargo("gerente_back", "Gerente de Back", 2000),
    cargo("chefe_parrilla", "Chefe de Parrilla", 1000),
  ],
  "cmv-salmao": [
    cargo("gerente_back", "Gerente de Back", 2000),
    cargo("chefe_sushi", "Chefe de Sushi", 1000),
  ],
  kds: [
    cargo("chefe_cozinha", "Chefe de Cozinha", 1000),
    cargo("chefe_parrilla", "Chefe de Parrilla", 500),
    cargo("chefe_sushi", "Chefe de Sushi", 500),
  ],
  conformidade: [
    cargo("gerente_front", "Gerente de Front", 1500),
    cargo("gerente_back", "Gerente de Back", 1500),
  ],
};

export const STATUS_LABEL_PT: Record<RankingStatus, string> = {
  excelente: "Excelente",
  bom: "Bom",
  regular: "Regular",
  redflag: "Red Flag",
};
