import { LOGO_BASE64 } from "@/lib/logoBase64";
import { STUTZ_LOGO_BASE64 } from "@/lib/brandLogos/stutzLogoBase64";

/**
 * Branding usado em PDFs/Excel gerados no cliente.
 *
 * Lê o slug do tenant ativo de `document.documentElement[data-tenant]`
 * (setado por `TenantContext.applyThemeToDocument`) e devolve nome curto,
 * nome longo e o data URL da logo para embutir no PDF.
 *
 * Não usa hook — funciona em módulos puros como `grupoCajuPdfTheme.ts`.
 */

export interface ExportBranding {
  /** Nome curto em CAIXA-ALTA (headers). Ex: "CAJUPAR", "STUTZ", "2SELL". */
  shortName: string;
  /** Nome longo/institucional (footers). Ex: "CajuPAR", "Stutz", "2Sell". */
  fullName: string;
  /** Data URL PNG/JPEG pronto para `doc.addImage`, ou null. */
  logoDataUrl: string | null;
  /** Formato passado para `doc.addImage` — combinar com `logoDataUrl`. */
  logoFormat: "JPEG" | "PNG";
}

const REGISTRY: Record<string, ExportBranding> = {
  caju: {
    shortName: "CAJUPAR",
    fullName: "CajuPAR",
    logoDataUrl: LOGO_BASE64,
    logoFormat: "JPEG",
  },
  cajupar: {
    shortName: "CAJUPAR",
    fullName: "CajuPAR",
    logoDataUrl: LOGO_BASE64,
    logoFormat: "JPEG",
  },
  stutz: {
    shortName: "STUTZ",
    fullName: "Stutz",
    logoDataUrl: STUTZ_LOGO_BASE64,
    logoFormat: "PNG",
  },
};

const FALLBACK: ExportBranding = {
  shortName: "2SELL",
  fullName: "2Sell",
  logoDataUrl: null,
  logoFormat: "PNG",
};

function getCurrentTenantSlug(): string | null {
  if (typeof document === "undefined") return null;
  return document.documentElement.getAttribute("data-tenant");
}

export function getExportBranding(): ExportBranding {
  const slug = getCurrentTenantSlug();
  if (slug && REGISTRY[slug]) return REGISTRY[slug];
  return FALLBACK;
}
