/**
 * Tradução entre vocabulários legacy (turno_config,
 * escala_minima) e sector_key canônico (holding).
 *
 * DÍVIDA TÉCNICA: este arquivo existe porque 3 vocabulários
 * paralelos coexistem hoje. Eliminação prevista em fase 8.6
 * via migration que normaliza turno_config.setor para
 * SectorKey canônico no banco.
 */

import { SECTOR_LABELS, type SectorKey } from "./sectors";

/** União dos vocabulários legacy conhecidos (turno_config + escala_minima). */
export type SectorAlias =
  | "ASG"
  | "BAR"
  | "CHEFE_SUBCHEFE"
  | "COZINHA"
  | "CUMIN"
  | "DELIVERY"
  | "GARCOM"
  | "HOSTESS"
  | "PARRILLA"
  | "PRODUCAO"
  | "SERVICOS_GERAIS"
  | "SUBCHEFE_SALAO";

/** Mapa de alias legacy → sector_key canônico. */
export const LEGACY_TO_SECTOR_KEY: Record<SectorAlias, SectorKey> = {
  ASG: "servicos_gerais_salao_bar",
  BAR: "bar",
  CHEFE_SUBCHEFE: "chefe_subchefe_salao",
  COZINHA: "cozinha",
  CUMIN: "cumin",
  DELIVERY: "caixa_delivery",
  GARCOM: "garcom",
  HOSTESS: "hostess",
  PARRILLA: "parrilla",
  PRODUCAO: "producao",
  SERVICOS_GERAIS: "servicos_gerais_salao_bar",
  SUBCHEFE_SALAO: "chefe_subchefe_salao",
};

/**
 * Converte um setor em vocabulário legacy para o sector_key canônico.
 * Faz UPPER(TRIM) no input. Se não encontrar mapeamento, emite warn
 * e retorna lowercase do input como fallback otimista.
 */
export function legacyToSectorKey(legacy: string): SectorKey {
  const normalized = legacy.trim().toUpperCase();
  const mapped = LEGACY_TO_SECTOR_KEY[normalized as SectorAlias];
  if (mapped) return mapped;
  console.warn(
    `[sectorAlias] Sem mapeamento legacy→sector_key para "${legacy}". ` +
      `Usando fallback lowercase. Revisar LEGACY_TO_SECTOR_KEY.`,
  );
  return legacy.trim().toLowerCase() as SectorKey;
}

/**
 * Label legível do sector_key — reexport conveniente de SECTOR_LABELS.
 * Não duplicar a tabela: fonte única continua em `sectors.ts`.
 */
export function sectorKeyToLegacyDisplay(key: SectorKey): string {
  return SECTOR_LABELS[key] ?? key;
}
