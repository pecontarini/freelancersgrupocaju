import { useTheme } from "next-themes";
import logoLightAsset from "@/assets/2sell-logo-light.png.asset.json";
import logoDarkAsset from "@/assets/2sell-logo-dark.png.asset.json";
import { useTenant } from "@/contexts/TenantContext";

/**
 * Marca exibida no app.
 *
 * - Plataforma-mãe (2Sell / 2board / _default) → identidade 2Sell fixa.
 * - Qualquer outro tenant (ex.: Stutz, Caju) → usa `tenant.logos` + `tenant.copy.appName`.
 *
 * Assim, ao acessar como usuário Stutz, o header, sidebar, splash e telas
 * de login/reset exibem a marca da Stutz — não a 2Sell.
 */
export const PLATFORM_BRAND_NAME = "2Sell";
export const PLATFORM_BRAND_TAGLINE = "IA | Consulting";

export const PLATFORM_LOGO_LIGHT = logoLightAsset.url;
export const PLATFORM_LOGO_DARK = logoDarkAsset.url;

/** Compat: alguns componentes ainda importam BRAND_LOGO_* diretamente. */
export const BRAND_LOGO_LIGHT = PLATFORM_LOGO_LIGHT;
export const BRAND_LOGO_DARK = PLATFORM_LOGO_DARK;

const PLATFORM_SLUGS = new Set(["2sell", "2board", "_default"]);

function isPlatformTenant(slug?: string | null) {
  return !slug || PLATFORM_SLUGS.has(slug);
}

/** Hook seguro: retorna null se estiver fora do TenantProvider. */
function useOptionalTenant() {
  try {
    return useTenant();
  } catch {
    return null;
  }
}

/** Nome de marca ativo (tenant ou plataforma). */
export function useBrandName(): string {
  const ctx = useOptionalTenant();
  if (ctx && !isPlatformTenant(ctx.tenant.slug)) {
    return ctx.tenant.copy.appName || PLATFORM_BRAND_NAME;
  }
  return PLATFORM_BRAND_NAME;
}

/** Tagline ativa (tenant ou plataforma). */
export function useBrandTagline(): string {
  const ctx = useOptionalTenant();
  if (ctx && !isPlatformTenant(ctx.tenant.slug)) {
    return ctx.tenant.copy.tagline || "";
  }
  return PLATFORM_BRAND_TAGLINE;
}

/** URL da logo ideal para o tema atual + tenant ativo. */
export function useBrandLogo(): { src: string; alt: string } {
  const { resolvedTheme } = useTheme();
  const ctx = useOptionalTenant();
  const isDark = resolvedTheme === "dark";

  if (ctx && !isPlatformTenant(ctx.tenant.slug)) {
    const logos = ctx.tenant.logos ?? {};
    const tenantSrc =
      (isDark ? logos.dark : logos.light) ||
      logos.main ||
      ctx.tenant.logoUrl ||
      logos.light ||
      logos.dark;
    if (tenantSrc) {
      return { src: tenantSrc, alt: ctx.tenant.copy.appName || PLATFORM_BRAND_NAME };
    }
  }

  return {
    src: isDark ? PLATFORM_LOGO_DARK : PLATFORM_LOGO_LIGHT,
    alt: PLATFORM_BRAND_NAME,
  };
}

/**
 * Compat: exports "constantes" antigas. Componentes que ainda importam
 * `BRAND_NAME` / `BRAND_TAGLINE` diretamente continuarão funcionando, mas
 * mostrarão 2Sell — prefira migrar para os hooks `useBrandName()` /
 * `useBrandTagline()` para respeitar o tenant.
 */
export const BRAND_NAME = PLATFORM_BRAND_NAME;
export const BRAND_TAGLINE = PLATFORM_BRAND_TAGLINE;
