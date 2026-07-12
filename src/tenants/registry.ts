import type { TenantConfig } from "./types";
import { cajuTenant } from "./caju";
import { defaultTenant } from "./_default";

/**
 * Registro central de tenants disponíveis no build.
 *
 * Para adicionar uma nova empresa:
 * 1. Crie `src/tenants/<slug>/index.ts` exportando um `TenantConfig`.
 * 2. Importe e adicione ao mapa abaixo.
 * 3. Crie a linha em `public.tenants` no banco (via migração ou insert).
 * 4. Aponte o subdomínio (ex: <slug>.seudominio.com) para o app.
 */
export const TENANT_REGISTRY: Record<string, TenantConfig> = {
  caju: cajuTenant,
  _default: defaultTenant,
};

export function getTenantBySlug(slug: string | null | undefined): TenantConfig {
  if (!slug) return defaultTenant;
  return TENANT_REGISTRY[slug] ?? defaultTenant;
}
