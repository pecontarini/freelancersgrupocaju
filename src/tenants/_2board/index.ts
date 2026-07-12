import type { TenantConfig } from "../types";

/**
 * Tenant "2board" — marca guarda-chuva do produto.
 * Usado no domínio raiz (2board.app / app.2board.app) e como fallback
 * quando o subdomínio não corresponde a nenhuma empresa cadastrada.
 */
export const twoboardTenant: TenantConfig = {
  slug: "2board",
  theme: {
    primary: "220 90% 56%",
    primaryStrong: "220 90% 45%",
    accent: "220 90% 56%",
  },
  copy: {
    appName: "2board",
    tagline: "Plataforma de gestão operacional",
    browserTitle: "2board · Plataforma de gestão operacional",
    metaDescription:
      "A plataforma completa para gestão operacional: escalas, freelancers, checklists, CMV, metas e indicadores.",
    terms: {
      unit: "unidade",
      unitPlural: "unidades",
      group: "grupo",
    },
  },
};
