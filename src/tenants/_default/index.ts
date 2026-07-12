import type { TenantConfig } from "../types";

/**
 * Tenant "fallback" — usado como esqueleto ao cadastrar uma nova empresa.
 *
 * Cópia dele, muda o slug/nome/cores e pronto.
 */
export const defaultTenant: TenantConfig = {
  slug: "_default",
  theme: {
    primary: "220 90% 56%",
    primaryStrong: "220 90% 45%",
    accent: "220 90% 56%",
  },
  copy: {
    appName: "Portal Operacional",
    tagline: undefined,
    browserTitle: "Portal Operacional",
    metaDescription:
      "Portal de gestão operacional: escalas, freelancers, checklists, CMV, metas e indicadores.",
    terms: {
      unit: "unidade",
      unitPlural: "unidades",
      group: "grupo",
    },
  },
};
