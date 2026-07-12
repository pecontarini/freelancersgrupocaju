import type { TenantConfig } from "./types";
import { cajuTenant } from "./caju";
import { defaultTenant } from "./_default";
import { twoboardTenant } from "./_2board";

/**
 * Registro central de tenants disponíveis no build.
 *
 * Estes são apenas FALLBACKS estáticos. O branding real (tema, logo, textos)
 * vem do banco via RPC `get_tenant_branding`. O registry aqui serve para:
 * - Tipos e chaves de UI internas
 * - Boot inicial antes da resposta do banco (evita flash)
 * - Marca guarda-chuva 2board
 */
export const TENANT_REGISTRY: Record<string, TenantConfig> = {
  caju: cajuTenant,
  "2board": twoboardTenant,
  _default: defaultTenant,
};

export function getTenantBySlug(slug: string | null | undefined): TenantConfig {
  if (!slug) return TENANT_REGISTRY["2board"] ?? defaultTenant;
  return TENANT_REGISTRY[slug] ?? {
    ...defaultTenant,
    slug,
    copy: {
      ...defaultTenant.copy,
      appName: slug,
      browserTitle: slug,
    },
  };
}
