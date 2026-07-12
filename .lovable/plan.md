# Caminho 2 — Self-service de novas empresas

Objetivo: permitir que um `super_admin` crie novas empresas (tenants), defina marca (nome, cores, logo) e vincule usuários — sem editar código nem migrar.

## 1. Banco (migração única)

**Alterar `public.tenants`**:
- Adicionar `theme JSONB` (primary/accent/primaryStrong em HSL)
- Adicionar `copy JSONB` (appName, tagline, browserTitle, metaDescription, terms, strings)
- Adicionar `logo_url TEXT`, `logo_dark_url TEXT`, `logo_symbol_url TEXT`, `favicon_url TEXT`
- Backfill do `caju` com os valores atuais de `src/tenants/caju/index.ts`

**Bucket de storage `tenant-assets`** (público, para logos/favicons):
- Policies: SELECT público; INSERT/UPDATE/DELETE só `super_admin`

**RPCs (SECURITY DEFINER, exigem `super_admin`)**:
- `admin_create_tenant(slug, name, theme, copy, logos)` → cria tenant
- `admin_update_tenant(id, patch)` → atualiza campos
- `admin_link_user_to_tenant(user_email, tenant_id, is_default)` → busca user por email em `auth.users` e cria `user_tenants`
- `admin_unlink_user(user_id, tenant_id)`
- `admin_list_tenants()` → lista tenants + contagem de usuários
- `admin_list_tenant_users(tenant_id)` → lista membros

Todas com `if not is_super_admin(auth.uid()) then raise exception 'forbidden'`.

## 2. Frontend — carregar tenants do banco

- `TenantContext` passa a buscar tenants ativos da tabela `tenants` no boot (fallback pro `TENANT_REGISTRY` estático quando offline/sem sessão).
- Merge: se existir no banco, usa branding do banco; senão, usa o TS file. Assim `caju` continua funcionando mesmo sem migração aplicada.
- `applyThemeToDocument` já suporta os campos — só passar do banco.

## 3. Painel `/admin/tenants` (super_admin)

Nova rota protegida por `super_admin`. Componentes:

- **`TenantsListPage`** — grid de cards com nome, slug, cor, nº usuários, botões Editar / Gerenciar usuários.
- **`TenantFormDialog`** — criar/editar:
  - slug (readonly no edit), nome, tagline, browserTitle, metaDescription
  - color pickers (primary/accent) → converte pra HSL
  - upload de logo (light/dark/symbol) e favicon via storage `tenant-assets`
  - preview ao vivo do header/botão com os tokens
- **`TenantMembersDialog`** — listar membros, adicionar por email, marcar default, remover.

Entrada no menu: item "Empresas" só visível para `super_admin` (via `useUserRole`).

## 4. Onboarding manual (fallback)

Documentar em `docs/multi-tenant.md` como criar o 1º `super_admin` via SQL (uma vez), depois todo o resto é self-service.

## Detalhes técnicos

- `theme` JSONB shape: `{ primary: "20 74% 48%", accent: "...", primaryStrong: "..." }`
- Uploads em `tenant-assets/{tenant_slug}/logo-light.png` etc.
- `TENANT_REGISTRY` vira só o `_default` + `caju` como seeds; novos tenants **não precisam** de arquivo TS.
- `getTenantBySlug` passa a consultar cache em memória populado pelo `TenantProvider` a partir do banco.

## Ordem de execução

1. Migração (colunas + bucket + RPCs + backfill caju)
2. Refactor `TenantContext` para carregar do banco
3. Rota `/admin/tenants` + componentes + item no sidebar
4. Typecheck + smoke test manual (criar tenant fake, trocar via TenantSwitcher)

## Riscos

- Se o backfill do `caju` falhar, o app fica sem branding → mitigado pelo fallback TS.
- Uploads de logo podem falhar em CDN → validar extensão/tamanho no front.
- Emails de usuários que não existem em `auth.users` no link → retornar erro claro no dialog.
