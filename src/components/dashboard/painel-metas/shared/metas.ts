import type { MetaDefinition, MetaKey, MetaPolarity } from "./types";

export const META_DEFINITIONS: Record<MetaKey, MetaDefinition> = {
  "visao-geral": {
    key: "visao-geral",
    label: "Dashboard Executivo",
    description: "Visão consolidada de todas as unidades",
    iconKey: "LayoutDashboard",
    dotToken: "bg-primary",
  },
  nps: {
    key: "nps",
    label: "NPS & Reclamações",
    description: "Salão e Delivery · ranking entre lojas",
    iconKey: "MessageSquare",
    dotToken: "bg-sky-500",
    polarity: "higher",
    unitSuffix: "",
  },
  "cmv-salmao": {
    key: "cmv-salmao",
    label: "CMV Salmão",
    description: "kg consumido por R$1.000 faturado · Nazo",
    iconKey: "Fish",
    dotToken: "bg-emerald-500",
    polarity: "lower",
    unitSuffix: "kg",
  },
  "cmv-carnes": {
    key: "cmv-carnes",
    label: "CMV Carnes",
    description: "Desvio % sobre valor transferido · Caminito",
    iconKey: "Beef",
    dotToken: "bg-red-500",
    polarity: "lower",
    unitSuffix: "%",
  },
  kds: {
    key: "kds",
    label: "KDS · Tempo de Prato",
    description: "% de pratos em target preta por setor",
    iconKey: "Timer",
    dotToken: "bg-violet-500",
    polarity: "higher",
    unitSuffix: "%",
  },
  conformidade: {
    key: "conformidade",
    label: "Conformidade",
    description: "Score de auditoria por cargo e unidade",
    iconKey: "ClipboardCheck",
    dotToken: "bg-amber-500",
    polarity: "higher",
    unitSuffix: "%",
  },
  "red-flag": {
    key: "red-flag",
    label: "Centro Red Flag",
    description: "Histórico e monitoramento de alertas críticos",
    iconKey: "AlertTriangle",
    dotToken: "bg-destructive",
    polarity: "lower",
  },
  planos: {
    key: "planos",
    label: "Planos de Ação",
    description: "Registro por reclamação e desvio",
    iconKey: "ListChecks",
    dotToken: "bg-emerald-600",
  },
  diario: {
    key: "diario",
    label: "Diário Operacional",
    description: "Lançamentos diários por unidade",
    iconKey: "TrendingUp",
    dotToken: "bg-orange-400",
    adminOnly: true,
  },
  holding: {
    key: "holding",
    label: "Central Holding",
    description: "Visão consolidada da rede",
    iconKey: "Building2",
    dotToken: "bg-stone-500",
    adminOnly: true,
  },
  ranking: {
    key: "ranking",
    label: "Ranking de Lojas",
    description: "Ordenação por métrica · top performers e red flags",
    iconKey: "Trophy",
    dotToken: "bg-amber-400",
    managerPlus: true,
  },
  comparativo: {
    key: "comparativo",
    label: "Comparativo de Lojas",
    description: "Radar 0–100 entre 2 a 4 unidades",
    iconKey: "Radar",
    dotToken: "bg-violet-400",
    managerPlus: true,
  },
};

export interface MetaGroup {
  title: string;
  items: MetaKey[];
}

export const META_GROUPS: MetaGroup[] = [
  { title: "Visão Geral", items: ["visao-geral"] },
  { title: "Indicadores", items: ["nps", "cmv-salmao", "cmv-carnes", "kds", "conformidade"] },
  { title: "Análise", items: ["ranking", "comparativo"] },
  { title: "Gestão", items: ["red-flag", "planos"] },
  { title: "Admin", items: ["diario", "holding"] },
];

export function metaPolarity(key: MetaKey): MetaPolarity {
  return META_DEFINITIONS[key].polarity ?? "higher";
}

export function bestOf(values: Array<number | null>, polarity: MetaPolarity): number | null {
  const filtered = values.filter((v): v is number => typeof v === "number" && !isNaN(v));
  if (!filtered.length) return null;
  return polarity === "higher" ? Math.max(...filtered) : Math.min(...filtered);
}

export function worstOf(values: Array<number | null>, polarity: MetaPolarity): number | null {
  const filtered = values.filter((v): v is number => typeof v === "number" && !isNaN(v));
  if (!filtered.length) return null;
  return polarity === "higher" ? Math.min(...filtered) : Math.max(...filtered);
}
