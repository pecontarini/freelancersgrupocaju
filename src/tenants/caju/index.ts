import type { TenantConfig } from "../types";
import logoLight from "@/assets/cajupar-logo-light.png";
import logoDark from "@/assets/cajupar-logo-dark.png";
import logoSymbol from "@/assets/cajupar-symbol.png";
import logoMain from "@/assets/logo.png";

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
  logoUrl: logoMain,
  logos: {
    light: logoLight,
    dark: logoDark,
    symbol: logoSymbol,
    main: logoMain,
  },
  faviconUrl: "/favicon-cajupar.png",
};
