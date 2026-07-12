import { TENANT_REGISTRY } from "./registry";

/**
 * Resolve qual tenant carregar no boot do app.
 *
 * Ordem de prioridade:
 * 1. `VITE_TENANT` no `.env` (dev / build por marca).
 * 2. Subdomínio do host (`caju.seudominio.com` → `caju`).
 * 3. `localStorage.tenant_slug` (últimos overrides do super_admin).
 * 4. Fallback: `caju` (retrocompatibilidade com o app atual).
 *
 * O tenant *do banco* (o que a RLS enxerga) vem do vínculo `user_tenants` do
 * usuário logado. Esta resolução aqui é apenas para BRANDING inicial —
 * o `TenantProvider` reconcilia depois com o backend quando o usuário loga.
 */
export function resolveInitialTenantSlug(): string {
  // 1. Env var (build ou dev override)
  const envSlug = import.meta.env.VITE_TENANT as string | undefined;
  if (envSlug && TENANT_REGISTRY[envSlug]) return envSlug;

  // 2. Subdomínio
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const parts = host.split(".");
    if (parts.length >= 3) {
      const sub = parts[0];
      if (TENANT_REGISTRY[sub]) return sub;
    }

    // 3. localStorage (super_admin override)
    try {
      const stored = window.localStorage.getItem("tenant_slug");
      if (stored && TENANT_REGISTRY[stored]) return stored;
    } catch {
      // ignore storage errors (privacy mode)
    }
  }

  // 4. Fallback retrocompatível
  return "caju";
}
