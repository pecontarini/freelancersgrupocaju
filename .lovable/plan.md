# Plano: 2board White-Label por Subdomínio

## Visão geral

O produto passa a se chamar **2board** (marca guarda-chuva). Cada empresa cliente terá seu próprio subdomínio (ex: `cajupar.2board.app`, `empresaX.2board.app`). Ao acessar o subdomínio, o sistema identifica o tenant **antes do login** e aplica tema, logo, nome e favicon da empresa. O login e todas as views passam a ser 100% personalizadas por empresa.

Um subdomínio raiz (`app.2board.app` ou `2board.app`) mostra a landing/marca 2board neutra.

## Arquitetura

```text
┌─────────────────────────────────────────────────────┐
│  Usuário digita: cajupar.2board.app                 │
└────────────────────┬────────────────────────────────┘
                     ↓
       ┌─────────────────────────────┐
       │  TenantResolver (bootstrap) │
       │  Lê window.location.host    │
       │  Extrai subdomínio "cajupar"│
       └────────────┬────────────────┘
                    ↓
       ┌─────────────────────────────┐
       │  Query: tenants.slug=cajupar│
       │  Retorna: theme, copy,      │
       │  logos, favicon, nome       │
       └────────────┬────────────────┘
                    ↓
       ┌─────────────────────────────┐
       │  Aplica CSS vars + <title>  │
       │  + <link rel=icon> ANTES    │
       │  de renderizar login        │
       └────────────┬────────────────┘
                    ↓
       Login com cara da CajuPAR
                    ↓
       Após auth: view da empresa
```

## Etapas de implementação

### 1. Marca 2board (guarda-chuva)
- Definir tenant "root" (slug `2board`) para o domínio raiz `2board.app` / `app.2board.app`.
- Este tenant hospeda a landing pública, cadastro/demonstração, e é o fallback quando o subdomínio não bate com nenhuma empresa.
- Criar identidade visual mínima 2board (paleta neutra, logo texto simples) — pode ser refinada depois.

### 2. Tenant Resolver por subdomínio
- Criar `src/lib/tenantResolver.ts`:
  - Lê `window.location.hostname`.
  - Extrai o primeiro segmento (`cajupar` de `cajupar.2board.app`).
  - Tratamento especial para: `localhost`, `*.lovable.app` (preview), IPs → usa tenant default (`2board` ou último tenant do usuário via localStorage).
- Substituir a lógica atual do `TenantContext` que decide tenant por localStorage/user_tenants para usar o resolver como fonte primária.

### 3. Query pública de branding
- Criar RPC `public.get_tenant_branding(slug text)` que retorna apenas os campos públicos (nome, theme, copy, logos, favicon) — **sem exigir auth**, pois roda antes do login.
- Adicionar policy pública de SELECT em `tenants` restrita a colunas de branding via RPC security-definer.

### 4. Aplicação de tema pré-login
- Refatorar `TenantContext` para:
  - Fase 1 (síncrono no bootstrap): aplicar CSS vars, `<title>`, favicon dinâmico via `<link>` injetado em `<head>`.
  - Fase 2 (após auth): validar que o usuário tem acesso ao tenant do subdomínio; se não, redirecionar para `app.2board.app` com aviso.

### 5. Guard de acesso ao tenant
- Se um usuário logado tenta acessar `empresaX.2board.app` mas só tem `user_tenants` para `cajupar`, mostrar tela de "Sem acesso a esta empresa" com link para o subdomínio correto.

### 6. Painel super_admin (já existe)
- Ajustar `/admin/tenants` para exibir o subdomínio esperado de cada tenant (`{slug}.2board.app`) e link para acessar.

### 7. Publicação e DNS (ação do usuário)
- Publicar o projeto no Lovable → gera URL `.lovable.app`.
- Comprar/configurar domínio `2board.app` (ou usar um que você já tenha).
- Configurar **DNS wildcard**: `*.2board.app` → Lovable (registro A `185.158.133.1` + TXT de verificação).
- Adicionar no Lovable os domínios: `2board.app`, `app.2board.app`, `cajupar.2board.app` (e cada nova empresa).

## Detalhes técnicos

### Novos arquivos
- `src/lib/tenantResolver.ts` — extrai slug do hostname.
- `src/components/TenantNoAccessScreen.tsx` — tela quando user não tem acesso ao tenant do subdomínio.

### Arquivos modificados
- `src/contexts/TenantContext.tsx` — passa a usar tenantResolver + aplica branding no bootstrap síncrono.
- `index.html` — remove título hardcoded, deixa o TenantContext preencher dinamicamente.
- `src/pages/admin/Tenants.tsx` — exibe URL prevista de cada tenant.

### Migração SQL
- RPC `get_tenant_branding(slug)` security-definer que retorna JSON público (nome, theme, copy, logos, favicon).
- Backfill: garantir que existe um tenant com slug `2board` (root/marca guarda-chuva).

### Não muda
- `user_tenants`, `user_roles`, RLS por tenant — tudo continua igual.
- Todas as views/dashboards existentes continuam funcionando dentro de cada tenant.
- Nomes de tabelas, edge functions, hooks — nada quebra.

## O que você precisa fazer depois do código pronto

1. **Publicar o projeto** (botão Publish) → gera `.lovable.app`.
2. **Comprar o domínio `2board.app`** (posso ajudar via Lovable Domains) ou usar um seu.
3. **Configurar DNS wildcard** `*.2board.app` no registrador.
4. **Adicionar os subdomínios no Lovable** (um por empresa que for entrar).

Depois disso, criar uma empresa nova = criar o tenant no painel `/admin/tenants` + adicionar o subdomínio no Lovable. Sem tocar em código.

## Fora do escopo desta etapa

- Landing page de marketing do 2board (fica para depois).
- Auto-provisionamento de subdomínio via API (Lovable ainda exige adicionar domínio manualmente pelo dashboard).
- Fluxo de auto-cadastro de novas empresas pelo próprio site (por enquanto criação é manual pelo super_admin).

Posso seguir com a implementação?
