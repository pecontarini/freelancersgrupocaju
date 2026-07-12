import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TenantConfig } from "@/tenants/types";
import { getTenantBySlug, TENANT_REGISTRY } from "@/tenants/registry";
import {
  resolveHost,
  resolveInitialTenantSlug,
  ROOT_BRAND_SLUG,
} from "@/lib/tenantResolver";
import { TenantNoAccessScreen } from "@/components/TenantNoAccessScreen";

interface TenantContextValue {
  tenant: TenantConfig;
  tenantId: string | null;
  availableTenants: TenantConfig[];
  setTenantSlug: (slug: string) => void;
  t: (key: string) => string;
  isLoading: boolean;
  /** True quando o slug vem do subdomínio (não pode ser trocado livremente). */
  isHostLocked: boolean;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

function applyThemeToDocument(tenant: TenantConfig) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-tenant", tenant.slug);

  // Nota: cores do tenant (primary/accent/etc) são IGNORADAS de propósito —
  // a plataforma tem identidade visual fixa (2Sell, P&B). Só aplicamos radius.
  const { theme } = tenant;
  if (theme.radius) root.style.setProperty("--radius", theme.radius);

  // Título e meta description sempre 2Sell (não sobrescrever).
  // Favicon também é fixo — vem de index.html.
}

function mergeTenantWithDbRow(base: TenantConfig, row: any): TenantConfig {
  if (!row) return base;
  const dbTheme = row.theme && typeof row.theme === "object" ? row.theme : {};
  const dbCopy = row.copy && typeof row.copy === "object" ? row.copy : {};
  return {
    ...base,
    id: row.id,
    slug: row.slug,
    theme: {
      ...base.theme,
      ...(dbTheme.primary ? { primary: dbTheme.primary } : {}),
      ...(dbTheme.primaryStrong ? { primaryStrong: dbTheme.primaryStrong } : {}),
      ...(dbTheme.accent ? { accent: dbTheme.accent } : {}),
      ...(dbTheme.radius ? { radius: dbTheme.radius } : {}),
    },
    copy: {
      ...base.copy,
      ...(dbCopy.appName ? { appName: dbCopy.appName } : {}),
      ...(dbCopy.tagline !== undefined ? { tagline: dbCopy.tagline } : {}),
      ...(dbCopy.browserTitle ? { browserTitle: dbCopy.browserTitle } : {}),
      ...(dbCopy.metaDescription ? { metaDescription: dbCopy.metaDescription } : {}),
      ...(dbCopy.terms ? { terms: { ...base.copy.terms, ...dbCopy.terms } } : {}),
      ...(dbCopy.strings ? { strings: { ...(base.copy.strings ?? {}), ...dbCopy.strings } } : {}),
    },
    logoUrl: row.logo_url ?? base.logoUrl,
    logos: {
      ...(base.logos ?? {}),
      ...(row.logo_url ? { main: row.logo_url, light: row.logo_url } : {}),
      ...(row.logo_dark_url ? { dark: row.logo_dark_url } : {}),
      ...(row.logo_symbol_url ? { symbol: row.logo_symbol_url } : {}),
    },
    faviconUrl: row.favicon_url ?? base.faviconUrl,
  };
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const hostInfo = useMemo(() => resolveHost(), []);
  const isHostLocked = !hostInfo.isDev && !!hostInfo.hostSlug && hostInfo.hostSlug !== ROOT_BRAND_SLUG;

  const [slug, setSlug] = useState<string>(() => resolveInitialTenantSlug());
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [availableSlugs, setAvailableSlugs] = useState<string[]>([]);
  const [dbTenants, setDbTenants] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const tenant = useMemo(() => {
    const base = getTenantBySlug(slug);
    return mergeTenantWithDbRow(base, dbTenants[slug]);
  }, [slug, dbTenants]);

  useEffect(() => {
    applyThemeToDocument(tenant);
  }, [tenant]);

  // 1. Boot: carrega branding do slug atual via RPC público (sem auth)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("get_tenant_branding", { _slug: slug });
      if (cancelled || error || !data) return;
      setDbTenants((prev) => ({ ...prev, [slug]: data }));
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // 2. Após login: valida vínculos e reconcilia
  useEffect(() => {
    let cancelled = false;

    async function loadUserTenants() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;
      setIsAuthenticated(!!session);

      if (!session) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_tenants")
        .select("tenant_id, is_default, tenants!inner(slug, id)")
        .order("is_default", { ascending: false });

      if (cancelled) return;

      if (error || !data) {
        setIsLoading(false);
        return;
      }

      const slugs = data
        .map((row: any) => row.tenants?.slug)
        .filter((s: string | undefined): s is string => Boolean(s));
      setAvailableSlugs(slugs);

      // Se o host trava o tenant (subdomínio real), o usuário PRECISA ter acesso a ele
      if (isHostLocked) {
        if (slugs.includes(slug)) {
          const row = data.find((r: any) => r.tenants?.slug === slug);
          setTenantId(row?.tenant_id ?? null);
          setAccessDenied(false);
        } else {
          setAccessDenied(true);
        }
      } else {
        // No root/dev: usa o default do usuário
        if (slugs.length > 0 && !slugs.includes(slug)) {
          const first = slugs[0];
          setSlug(first);
          const row = data.find((r: any) => r.tenants?.slug === first);
          setTenantId(row?.tenant_id ?? null);
        } else if (slugs.includes(slug)) {
          const row = data.find((r: any) => r.tenants?.slug === slug);
          setTenantId(row?.tenant_id ?? null);
        }
      }

      // Pré-carrega branding de todos os tenants do usuário para o seletor
      for (const s of slugs) {
        if (!dbTenants[s]) {
          const { data: b } = await supabase.rpc("get_tenant_branding", { _slug: s });
          if (b && !cancelled) {
            setDbTenants((prev) => ({ ...prev, [s]: b }));
          }
        }
      }

      setIsLoading(false);
    }

    loadUserTenants();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      loadUserTenants();
    });

    return () => {
      cancelled = true;
      authListener?.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHostLocked]);

  const setTenantSlug = (nextSlug: string) => {
    if (isHostLocked) return; // travado pelo subdomínio
    if (!TENANT_REGISTRY[nextSlug] && !dbTenants[nextSlug]) return;
    setSlug(nextSlug);
    try {
      window.localStorage.setItem("tenant_slug", nextSlug);
    } catch {
      // ignore
    }
  };

  const t = (key: string) => tenant.copy.strings?.[key] ?? key;

  const availableTenants = useMemo(
    () =>
      availableSlugs.map((s) => {
        const base = getTenantBySlug(s);
        return mergeTenantWithDbRow(base, dbTenants[s]);
      }),
    [availableSlugs, dbTenants],
  );

  const value: TenantContextValue = {
    tenant,
    tenantId,
    availableTenants,
    setTenantSlug,
    t,
    isLoading,
    isHostLocked,
  };

  // Gate: usuário logado tentando acessar subdomínio ao qual não tem vínculo
  if (accessDenied && isAuthenticated) {
    return (
      <TenantContext.Provider value={value}>
        <TenantNoAccessScreen
          availableSlugs={availableSlugs}
          currentHostSlug={slug}
        />
      </TenantContext.Provider>
    );
  }

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error("useTenant deve ser usado dentro de <TenantProvider>");
  }
  return ctx;
}
