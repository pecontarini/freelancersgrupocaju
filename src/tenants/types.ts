/**
 * Tenant configuration types.
 *
 * Cada empresa (marca) é uma "tenant". A configuração define:
 * - identidade visual (nome, logo, cores)
 * - textos e termos de negócio (copy)
 *
 * Dados de negócio ficam isolados no banco por tenant_id.
 * Ver: docs/multi-tenant.md e migration `tenants` + `user_tenants`.
 */

export interface TenantTheme {
  /** Cor primária em HSL sem "hsl()" — ex: "20 74% 48%". Aplicada a --primary. */
  primary: string;
  /** Cor de acento em HSL — ex: "20 74% 48%". */
  accent?: string;
  /** Cor forte para hovers/gradientes. */
  primaryStrong?: string;
  /** Radius global (ex: "0.75rem"). Opcional. */
  radius?: string;
}

export interface TenantCopy {
  /** Nome da empresa/portal (aparece no header). */
  appName: string;
  /** Subtítulo curto (opcional). */
  tagline?: string;
  /** Título da aba do navegador. */
  browserTitle: string;
  /** Meta description da página. */
  metaDescription: string;
  /** Termos de negócio configuráveis (singular / plural / feminino). */
  terms: {
    /** Como chamar uma unidade de negócio. Ex: "unidade", "loja", "filial". */
    unit: string;
    unitPlural: string;
    /** Como chamar o grupo/holding. Ex: "grupo", "rede". */
    group: string;
  };
  /** Textos livres nomeados. Ex: t("welcome") → "Bem-vindo ao Portal". */
  strings?: Record<string, string>;
}

export interface TenantLogos {
  /** Logo horizontal para fundo claro. */
  light?: string;
  /** Logo horizontal para fundo escuro. */
  dark?: string;
  /** Símbolo compacto (quadrado) para sidebar colapsada / favicons. */
  symbol?: string;
  /** Logo genérico (fallback quando light/dark não são fornecidos). */
  main?: string;
}

export interface TenantConfig {
  /** Slug único no banco (ex: "caju"). Deve casar com `tenants.slug`. */
  slug: string;
  /** ID do tenant no banco. Preenchido dinamicamente após lookup. */
  id?: string;
  theme: TenantTheme;
  copy: TenantCopy;
  /** URL do logo (via Lovable Assets ou path público). Legado — prefira `logos`. */
  logoUrl?: string;
  /** Logos por contexto (light/dark/símbolo). Todos opcionais. */
  logos?: TenantLogos;
  /** Favicon (opcional; se ausente usa o global). */
  faviconUrl?: string;
}
