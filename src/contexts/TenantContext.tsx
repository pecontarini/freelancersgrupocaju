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
import { resolveInitialTenantSlug } from "@/tenants/resolve";

interface TenantContextValue {
  /** Tenant ativo (frontend branding). */
  tenant: TenantConfig;
  /** UUID do tenant no banco (após lookup). Pode ser null durante boot. */
  tenantId: string | null;
  /** Todos os tenants aos quais o usuário logado tem acesso. */
  availableTenants: TenantConfig[];
  /** Troca o tenant ativo (só faz efeito visual; RLS ainda depende do vínculo). */
  setTenantSlug: (slug: string) => void;
  /** Helper de textos: t("welcome") → busca em copy.strings[key], fallback pro próprio key. */
  t: (key: string) => string;
  /** Loading state do lookup inicial no banco. */
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

/**
 * Aplica os tokens de tema do tenant no <html data-tenant="...">.
 * Sobrescreve variáveis CSS que já existem no design system (index.css).
 */
function applyThemeToDocument(tenant: TenantConfig) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-tenant", tenant.slug);

  const { theme } = tenant;
  if (theme.primary) root.style.setProperty("--primary", theme.primary);
  if (theme.accent) root.style.setProperty("--accent", theme.accent);
  if (theme.primaryStrong) {
    root.style.setProperty("--cj-accent-strong", `hsl(${theme.primaryStrong})`);
  }
  if (theme.radius) root.style.setProperty("--radius", theme.radius);

  // Título da aba
  if (tenant.copy.browserTitle) {
    document.title = tenant.copy.browserTitle;
  }

  // Favicon (se fornecido)
  if (tenant.faviconUrl) {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = tenant.faviconUrl;
  }
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [slug, setSlug] = useState<string>(() => resolveInitialTenantSlug());
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [availableSlugs, setAvailableSlugs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const tenant = useMemo(() => getTenantBySlug(slug), [slug]);

  // Aplica tema sempre que o tenant muda
  useEffect(() => {
    applyThemeToDocument(tenant);
  }, [tenant]);

  // Lookup inicial: buscar tenants do usuário no banco e reconciliar
  useEffect(() => {
    let cancelled = false;

    async function loadTenants() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        // Sem sessão: mantém o slug resolvido do env/subdomínio para branding do login
        if (!cancelled) setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_tenants")
        .select("tenant_id, is_default, tenants!inner(slug, id)")
        .order("is_default", { ascending: false });

      if (cancelled) return;

      if (error || !data || data.length === 0) {
        // Sem vínculos ainda; deixa o app seguir com o slug atual sem tenantId
        setIsLoading(false);
        return;
      }

      const slugs = data
        .map((row: any) => row.tenants?.slug)
        .filter((s: string | undefined): s is string => Boolean(s));
      setAvailableSlugs(slugs);

      // Se o slug atual não pertence ao usuário, força o default dele
      const currentBelongs = slugs.includes(slug);
      const effectiveSlug = currentBelongs ? slug : slugs[0];
      if (effectiveSlug !== slug) setSlug(effectiveSlug);

      const matchingRow = data.find(
        (row: any) => row.tenants?.slug === effectiveSlug,
      );
      setTenantId(matchingRow?.tenant_id ?? null);
      setIsLoading(false);
    }

    loadTenants();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      loadTenants();
    });

    return () => {
      cancelled = true;
      authListener?.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTenantSlug = (nextSlug: string) => {
    if (!TENANT_REGISTRY[nextSlug]) return;
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
      availableSlugs
        .map((s) => TENANT_REGISTRY[s])
        .filter((tc): tc is TenantConfig => Boolean(tc)),
    [availableSlugs],
  );

  const value: TenantContextValue = {
    tenant,
    tenantId,
    availableTenants,
    setTenantSlug,
    t,
    isLoading,
  };

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
