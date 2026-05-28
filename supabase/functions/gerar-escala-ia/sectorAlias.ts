/**
 * Tradução entre vocabulários legacy (turno_config, escala_minima)
 * e sector_key canônico (holding_staffing_config).
 *
 * ⚠️ DUPLICATED from src/lib/holding/sectorAlias.ts
 *    Edge functions Deno não conseguem importar src/ via path
 *    relativo. Manter os dois arquivos em sincronia até a
 *    consolidação da fase 8.6 (migration que normaliza
 *    turno_config.setor para SectorKey canônico no banco).
 */

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

export const LEGACY_TO_SECTOR_KEY: Record<SectorAlias, string> = {
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

export function legacyToSectorKey(legacy: string): string {
  const normalized = legacy.trim().toUpperCase();
  const mapped = LEGACY_TO_SECTOR_KEY[normalized as SectorAlias];
  if (mapped) return mapped;
  console.warn(
    `[sectorAlias] Sem mapeamento legacy→sector_key para "${legacy}". ` +
      `Usando fallback lowercase. Revisar LEGACY_TO_SECTOR_KEY.`,
  );
  return legacy.trim().toLowerCase();
}
