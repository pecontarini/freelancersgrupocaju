# Multi-tenant (White-label) · Guia rápido

## O que já está pronto

### Backend (banco)
- Tabela **`tenants`** — empresas (slug, nome, logo, cor primária, ativo).
- Tabela **`user_tenants`** — vínculo usuário↔empresa (com `is_default`).
- Novo papel **`super_admin`** no enum `app_role`.
- Funções: `current_tenant_id()`, `is_super_admin(user)`, `user_has_tenant(user, tenant)`.
- Tenant `caju` já criado; **todos os usuários existentes** foram vinculados a ele como default.

**Nenhuma tabela de negócio existente foi alterada.** O app continua funcionando como hoje.

### Frontend
- `src/tenants/types.ts` — tipos.
- `src/tenants/caju/` — configuração da marca Caju (a atual).
- `src/tenants/_default/` — esqueleto para novas empresas.
- `src/tenants/registry.ts` — mapa de tenants disponíveis no build.
- `src/tenants/resolve.ts` — resolve o tenant inicial (env → subdomínio → localStorage → caju).
- `src/contexts/TenantContext.tsx` — `TenantProvider`, `useTenant()`, helper `t()`.
- Já plugado no `App.tsx`, envolvendo `AuthProvider` → `TenantProvider` → `UnidadeProvider`.

### Como já é possível usar (opcional)
```tsx
import { useTenant } from "@/contexts/TenantContext";

function Header() {
  const { tenant, t } = useTenant();
  return (
    <div>
      <h1>{tenant.copy.appName}</h1>
      <p>{t("welcome")}</p>
    </div>
  );
}
```
E o `<html data-tenant="caju">` já é setado automaticamente, com `--primary` sobrescrito pela cor do tenant.

---

## O que **ainda falta** (próximas etapas)

### Etapa 3 · Aplicar branding nas telas
Substituir referências hardcoded a "CajuPAR", "Portal da Liderança", "Grupo Caju", logo, etc. por `useTenant()` / `t()`. Isso é incremental — dá pra ir tela a tela sem risco.

### Etapa 4 · Isolar dados por tenant (o passo crítico)
Adicionar `tenant_id UUID REFERENCES public.tenants(id)` a **todas** as tabelas de negócio, com backfill para `caju`, e reescrever cada policy RLS para incluir `AND tenant_id = current_tenant_id()`.

Recomendação: fazer em **blocos por domínio** (ex: escalas primeiro, depois freelancers, depois CMV…), cada bloco com sua própria migração revisável.

### Etapa 5 · Onboarding de nova empresa
1. Insert em `public.tenants` (slug + nome + cor).
2. `INSERT INTO user_tenants` para o(s) primeiro(s) usuário(s).
3. Criar `src/tenants/<slug>/index.ts` com `TenantConfig`.
4. Registrar em `src/tenants/registry.ts`.
5. Apontar subdomínio (ou usar `VITE_TENANT=<slug>` num build dedicado).

---

## Convenções

- **Nunca** hardcodar cor em componente (`text-white`, `bg-[#...]`). Usar tokens CSS (`--primary`, `--accent`) do design system.
- **Nunca** hardcodar "Grupo Caju" / "Portal da Liderança" em novo código — usar `useTenant().tenant.copy.appName`.
- Textos de negócio configuráveis vão em `TenantCopy.terms` (unit/unitPlural/group) e acessados via `tenant.copy.terms.unit`.
- Logos por tenant devem ir para Lovable Assets (CDN) e ser referenciados pelo `logoUrl` do config.
