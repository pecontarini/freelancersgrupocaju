/**
 * Resolve o slug do tenant a partir do hostname do navegador.
 *
 * Regras:
 * - `cajupar.2board.app`         → "cajupar"
 * - `empresaX.2board.app`        → "empresaX"
 * - `2board.app` / `app.2board.app` → "2board" (marca guarda-chuva)
 * - `localhost`, IPs, `*.lovable.app` (preview) → null (usa fallback)
 *
 * Reservamos subdomínios técnicos que NÃO representam empresas: `www`, `app`,
 * `admin`, `api`, `id-preview`.
 */

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "admin",
  "api",
  "staging",
  "dev",
  "preview",
]);

const ROOT_BRAND_SLUG = "2board";

export interface ResolvedHost {
  /** Slug detectado no hostname, ou null se não houver subdomínio real. */
  hostSlug: string | null;
  /** true quando o hostname é ambiente de desenvolvimento (localhost, preview Lovable, IP). */
  isDev: boolean;
  /** Domínio raiz (ex: "2board.app"). Null em dev. */
  rootDomain: string | null;
}

function isIpAddress(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
}

function isDevHost(host: string): boolean {
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    isIpAddress(host) ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovable.dev") ||
    host.endsWith(".lovableproject.com")
  );
}

export function resolveHost(hostname?: string): ResolvedHost {
  if (typeof window === "undefined" && !hostname) {
    return { hostSlug: null, isDev: true, rootDomain: null };
  }
  const host = (hostname ?? window.location.hostname).toLowerCase();

  if (isDevHost(host)) {
    return { hostSlug: null, isDev: true, rootDomain: null };
  }

  const parts = host.split(".");
  // domínio raiz sem subdomínio (ex: 2board.app)
  if (parts.length < 3) {
    return {
      hostSlug: ROOT_BRAND_SLUG,
      isDev: false,
      rootDomain: parts.join("."),
    };
  }

  const sub = parts[0];
  const rootDomain = parts.slice(1).join(".");

  if (RESERVED_SUBDOMAINS.has(sub)) {
    return { hostSlug: ROOT_BRAND_SLUG, isDev: false, rootDomain };
  }

  return { hostSlug: sub, isDev: false, rootDomain };
}

/**
 * Slug inicial no bootstrap. Prioridade:
 * 1. Env var VITE_TENANT (build/dev override)
 * 2. Query param `?tenant=slug` (link direto para apresentação/preview)
 * 3. Subdomínio do hostname
 * 4. localStorage.tenant_slug (fallback dev/preview)
 * 5. "2board" (marca guarda-chuva)
 */
export function resolveInitialTenantSlug(): string {
  const envSlug = import.meta.env.VITE_TENANT as string | undefined;
  if (envSlug) return envSlug;

  if (typeof window === "undefined") return ROOT_BRAND_SLUG;

  const queryTenant = new URLSearchParams(window.location.search).get("tenant");
  if (queryTenant) {
    try {
      window.localStorage.setItem("tenant_slug", queryTenant);
    } catch {
      // ignore
    }
    return queryTenant;
  }

  const { hostSlug, isDev } = resolveHost();
  if (hostSlug) return hostSlug;

  if (isDev) {
    try {
      const stored = window.localStorage.getItem("tenant_slug");
      if (stored) return stored;
    } catch {
      // ignore
    }
  }

  return ROOT_BRAND_SLUG;
}

/** URL esperada para acessar um tenant, dado o hostname atual. */
export function buildTenantUrl(slug: string): string {
  if (typeof window === "undefined") return `https://${slug}.2board.app`;
  const { rootDomain, isDev } = resolveHost();
  if (isDev || !rootDomain) {
    // Em dev, apenas troca via localStorage
    return `${window.location.origin}?tenant=${slug}`;
  }
  // Se estamos no root ou reserved, monta subdomínio
  return `${window.location.protocol}//${slug}.${rootDomain}`;
}

export { ROOT_BRAND_SLUG };
