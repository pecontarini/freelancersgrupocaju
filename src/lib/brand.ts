import { useTheme } from "next-themes";
import logoLightAsset from "@/assets/2sell-logo-light.png.asset.json";
import logoDarkAsset from "@/assets/2sell-logo-dark.png.asset.json";

/**
 * Marca fixa da plataforma: 2Sell.
 * Ignora qualquer branding por tenant — a plataforma tem uma única identidade.
 *
 * - Tema light  → logo preta sobre fundo claro (2sell-logo-light.png)
 * - Tema dark   → logo branca sobre fundo escuro (2sell-logo-dark.png)
 */
export const BRAND_NAME = "2Sell";
export const BRAND_TAGLINE = "IA | Consulting";

export const BRAND_LOGO_LIGHT = logoLightAsset.url;
export const BRAND_LOGO_DARK = logoDarkAsset.url;

/** URL da logo ideal para o tema atual (usar em <img src=...>). */
export function useBrandLogo(): { src: string; alt: string } {
  const { resolvedTheme } = useTheme();
  return {
    src: resolvedTheme === "dark" ? BRAND_LOGO_DARK : BRAND_LOGO_LIGHT,
    alt: BRAND_NAME,
  };
}
