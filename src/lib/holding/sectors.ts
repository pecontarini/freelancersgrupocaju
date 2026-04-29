/**
 * Lista canônica de sector_key + labels legíveis usadas pela
 * área "Configuração Operacional — Holding".
 *
 * A mesma string `label` é usada quando a trigger
 * `mirror_holding_to_staffing_matrix` auto-cria o setor em `sectors`.
 */
export type SectorKey =
  | "chefe_subchefe_salao"
  | "garcom"
  | "cumin"
  | "hostess"
  | "caixa_delivery"
  | "parrilla"
  | "cozinha"
  | "bar"
  | "servicos_gerais_salao_bar"
  | "producao"
  | "sushi";

export const UNIVERSAL_SECTORS: SectorKey[] = [
  "chefe_subchefe_salao",
  "garcom",
  "cumin",
  "hostess",
  "caixa_delivery",
  "parrilla",
  "cozinha",
  "bar",
  "servicos_gerais_salao_bar",
  "producao",
];

export const NAZO_ONLY_SECTORS: SectorKey[] = ["sushi"];

export const SECTOR_LABELS: Record<SectorKey, string> = {
  chefe_subchefe_salao: "Chefe/Subchefe de Salão",
  garcom: "Garçom",
  cumin: "Cumin",
  hostess: "Hostess",
  caixa_delivery: "Caixa/Delivery",
  parrilla: "Parrilla",
  cozinha: "Cozinha",
  bar: "Bar",
  servicos_gerais_salao_bar: "Serviços Gerais Salão/Bar",
  producao: "Produção",
  sushi: "Sushi",
};

export type Brand = "Caju Limão" | "Caminito" | "Nazo" | "Foster's Burguer";

/**
 * Deriva a marca a partir do nome da unidade, baseado nos prefixos reais
 * usados em `config_lojas`:
 *   - CAJU 01, CAJU 03, ...           → Caju Limão
 *   - FB01, FB02, ...                 → Foster's Burguer
 *   - MULT XX - NAZO ..., NFE - NAZO  → Nazo
 *   - MULT XX - CAMINITO ...          → Caminito
 * Unidades não-operacionais (CPD, RESPONSA) retornam null e são ocultadas
 * dos seletores.
 */
export function deriveBrand(unitName: string | null | undefined): Brand | null {
  const name = (unitName ?? "").toUpperCase().trim();
  if (!name) return null;
  // Não-operacionais
  if (name.startsWith("CPD") || name.startsWith("RESPONSA")) return null;
  // Marca por keyword (mais específica primeiro)
  if (name.includes("NAZO")) return "Nazo";
  if (name.includes("CAMINITO")) return "Caminito";
  if (/^CAJU\b/.test(name) || name.includes("CAJU LIMÃO") || name.includes("CAJU LIMAO")) {
    return "Caju Limão";
  }
  if (/^FB\d/.test(name) || name.includes("FOSTER")) return "Foster's Burguer";
  return null;
}

export const ALL_BRANDS: Brand[] = ["Caju Limão", "Foster's Burguer", "Caminito", "Nazo"];

/** Setores aplicáveis a uma marca. */
export function sectorsForBrand(brand: Brand): SectorKey[] {
  if (brand === "Nazo") return [...UNIVERSAL_SECTORS, ...NAZO_ONLY_SECTORS];
  return UNIVERSAL_SECTORS;
}

export const SHIFT_TYPES = [
  { key: "almoco", label: "Almoço" },
  { key: "jantar", label: "Jantar" },
] as const;

export const DAYS_OF_WEEK = [
  { key: 0, label: "DOM" },
  { key: 1, label: "SEG" },
  { key: 2, label: "TER" },
  { key: 3, label: "QUA" },
  { key: 4, label: "QUI" },
  { key: 5, label: "SEX" },
  { key: 6, label: "SAB" },
] as const;
