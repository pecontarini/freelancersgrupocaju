import type { TenantConfig } from "../types";

/**
 * Grupo Caju — tenant de referência.
 *
 * Mantém a identidade visual atual do app (coral/terracotta, "Portal da Liderança").
 * Cores em HSL (formato do design system em index.css).
 */
export const cajuTenant: TenantConfig = {
  slug: "caju",
  theme: {
    // #D55A1E → HSL aproximado
    primary: "20 74% 48%",
    primaryStrong: "20 80% 40%",
    accent: "20 74% 48%",
  },
  copy: {
    appName: "Portal da Liderança",
    tagline: "Grupo Caju",
    browserTitle: "Portal da Liderança · Grupo Caju",
    metaDescription:
      "Portal de gestão operacional do Grupo Caju: escalas, freelancers, checklists, CMV, metas e indicadores.",
    terms: {
      unit: "unidade",
      unitPlural: "unidades",
      group: "grupo",
    },
    strings: {
      welcome: "Bem-vindo ao Portal da Liderança",
    },
  },
  logoUrl: undefined, // usa o logo atual do projeto até migrarmos para asset por tenant
};
