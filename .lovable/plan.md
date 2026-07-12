# Plano: White-label Multi-tenant (Fase Estrutural)

## Objetivo
Transformar o app atual (hoje amarrado ao Grupo Caju) numa base **multi-marca**, onde cada empresa (tenant) tem seu próprio logo, cores, nome e termos de negócio, com **dados 100% isolados**. Esta fase prepara o terreno: extrai todo o branding para uma camada de tema e cria a estrutura de tenant no banco — sem ainda migrar as unidades existentes nem exigir uma segunda empresa cadastrada.

O Grupo Caju continua funcionando exatamente como hoje durante toda a fase.

---

## O que muda na prática

### 1. Camada de tema por tenant (frontend)
Um único arquivo por empresa define tudo que é "cara" da marca:

```text
src/tenants/
  caju/
    theme.ts        → cores (tokens HSL), nome, logo, favicon
    copy.ts         → textos: "loja" vs "unidade" vs "filial", nomes de setores, etc.
    logo.svg        → asset da marca
  _default/         → fallback
```

- Cores viram tokens CSS aplicados via `:root[data-tenant="caju"] { --primary: ... }` no `index.css`, respeitando o design system existente (não hardcoda cor em componente).
- Nome do app, título da aba, favicon e logo passam a ler de `useTenant()`.
- Textos de negócio (ex.: "Unidade" no header, rótulos de setores) passam por um helper `t("unidade")` que resolve pelo `copy.ts` do tenant ativo.

### 2. Resolução do tenant ativo
Como você quer isolamento total, o caminho recomendado é **um domínio por marca**:
- `caju.seudominio.com` → tenant `caju`
- `empresa2.seudominio.com` → tenant `empresa2`

O tenant é resolvido no boot da app pelo subdomínio (com fallback via `VITE_TENANT` para dev). Login e dados ficam automaticamente escopados.

### 3. Isolamento de dados no banco
Adiciona `tenant_id` como coluna em todas as tabelas de negócio e uma tabela `tenants`:

```text
tenants (id, slug, nome, ativo)
user_tenants (user_id, tenant_id, role)   ← quem pertence a qual empresa
```

- Cria função `current_tenant_id()` (SECURITY DEFINER) que retorna o tenant do usuário logado.
- **RLS reescrita**: toda policy passa a exigir `tenant_id = current_tenant_id()` **além** das regras atuais por unidade/role.
- Migração inicial cria o tenant `caju` e faz backfill: todos os registros existentes recebem `tenant_id = <caju>`. Zero perda de dado, zero mudança visível para os usuários atuais.
- Trigger de `BEFORE INSERT` preenche `tenant_id` automaticamente a partir do usuário, para não quebrar formulários existentes.

### 4. Admin global (você)
Uma role `super_admin` numa tabela separada permite que você veja/administre todos os tenants. Um seletor de tenant aparece **só** para essa role no header. Operadores normais nunca veem outro tenant.

### 5. O que **não** muda nesta fase
- Nenhuma tela é redesenhada.
- Nenhum fluxo de negócio muda.
- `useUnidade()`, RLS por unidade, permissões atuais — tudo continua funcionando por cima da nova camada de tenant.
- Nenhum dado é movido de projeto: continua tudo neste mesmo backend.

---

## Etapas de entrega

**Etapa 1 · Fundação (esta primeira leva de trabalho)**
1. Criar `tenants`, `user_tenants`, função `current_tenant_id()`, role `super_admin`.
2. Migração: adicionar `tenant_id` em todas as tabelas de negócio, popular com o tenant `caju`, criar índice `(tenant_id, ...)` onde já existe índice principal.
3. Atualizar RLS de todas as tabelas para incluir a checagem de tenant.
4. Trigger de auto-preenchimento de `tenant_id` em INSERT.

**Etapa 2 · Camada de tema no frontend**
5. Criar `src/tenants/` com `caju/` como tenant de referência, extrair logo, nome, cores e termos que hoje estão hardcoded (ex.: "CajuPAR", "Caju Limão", "Portal da Liderança") para `theme.ts` / `copy.ts`.
6. Criar `TenantProvider` + `useTenant()` + helper `t()` para textos.
7. Aplicar tokens CSS do tenant no `<html data-tenant="...">` e trocar referências diretas a logos/nomes pelos hooks.

**Etapa 3 · Resolução por subdomínio + admin global**
8. Resolver tenant por subdomínio (com fallback `VITE_TENANT` em dev).
9. Adicionar seletor de tenant no header apenas para `super_admin`.
10. Criar tenant `_default` (esqueleto) para servir de template ao cadastrar novas empresas.

**Etapa 4 · Onboarding de nova empresa (quando quiser)**
Cadastrar uma nova empresa vira: (a) linha em `tenants`, (b) pasta `src/tenants/<slug>/` com logo/cores/textos, (c) apontar o subdomínio. Sem tocar em código de negócio.

---

## Detalhes técnicos (para referência)

- **Tokens de cor**: mantêm o formato HSL do `index.css` atual; cada tenant sobrescreve `--primary`, `--accent`, `--cj-accent`, etc. dentro de um seletor `[data-tenant="..."]`. Nada de `text-white`/`bg-[#...]` — segue a regra do design system.
- **RLS**: policies existentes ganham um `AND tenant_id = public.current_tenant_id()`. Onde há função `SECURITY DEFINER` (ex.: `has_role`), incluir `tenant_id` no filtro.
- **Backfill**: transação única, `UPDATE ... SET tenant_id = '<caju-uuid>' WHERE tenant_id IS NULL`, seguido de `ALTER COLUMN tenant_id SET NOT NULL`.
- **Edge functions**: as que usam `service_role` precisam receber `tenant_id` explicitamente (via JWT do chamador ou parâmetro) e filtrar por ele. Auditar uma a uma na Etapa 1.
- **Storage**: buckets viram `tenant-scoped` por prefixo de path (`{tenant_slug}/...`) e as policies do bucket passam a checar o prefixo.
- **Assets/logos**: logos por tenant vão para Lovable Assets (CDN), referenciados via `.asset.json`.

---

## Riscos e mitigações

- **RLS mal migrada trava o app**: cada tabela é migrada + testada em staging/preview antes de aplicar. Rollback pronto.
- **Edge functions que ignoram tenant**: auditoria completa na Etapa 1 antes de habilitar segundo tenant.
- **Custo de manter dois tenants no mesmo banco**: baixo agora; se um cliente exigir banco separado no futuro, a arquitetura permite "promover" um tenant para outro projeto Lovable copiando o código como está.

---

## Confirmação antes de começar
Se aprovar, começo pela **Etapa 1 (fundação no banco)**: criar `tenants`, `user_tenants`, `current_tenant_id()`, adicionar `tenant_id` em todas as tabelas com backfill para `caju` e reescrever as RLS. Nada visível muda nesta etapa — é a base para tudo o resto.