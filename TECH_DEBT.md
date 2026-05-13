# TECH_DEBT — Linter & Schema Warnings

Documento de dívida técnica acumulada. **NÃO é escopo da Etapa 3 (PRs 1–4)**. Limpeza programada para PR separado após o fechamento da Etapa 3.

Última atualização: 2026-05-12 — após Onda 6 Etapa 2 (PIN + publish_schedule_draft + validate_schedule_publish).

---

## Status

- **Total de warnings ativos no Supabase Linter:** 65
- **Piso aceitável após Etapa 2:** 65
- **Introduzidos pela Etapa 2 (net):** +2 (−1 ao revogar anon de `set_user_pin`, +3 SECDEF auth-callable arquiteturalmente necessários)
- **Pré-existentes:** 61

Nenhum warning é bloqueante para operação. Nenhum representa exposição de dados sensíveis confirmada — todos são *hardening* recomendado ou trade-off arquitetural documentado.

---

## Warnings esperados — NÃO são dívida

Linter rule **0029 (`authenticated SECDEF executable`)** conta cada função `SECURITY DEFINER` chamável por `authenticated`. As funções abaixo são arquiteturalmente SECDEF auth-callable e somam +3 ao count. **Não devem ser corrigidas** — fazem parte do desenho de permissões do módulo de escala:

- `verify_user_pin` — gerencia lock/contador de tentativas cross-user (precisa escrever em linhas de outros usuários para incrementar `failed_attempts` / setar `locked_until`).
- `publish_schedule_draft` — insere linhas em `shifts` (tabela global) e materializa `schedules` para múltiplos funcionários em uma transação atômica.
- `validate_schedule_publish` — lê `store_budgets` (RLS admin-only) para validar overrides feitos por operator.

Refatorar para esconder esses warnings exigiria que o operator chamasse 2 RPCs em sequência (race conditions, RLS mais complicada, UX pior). Ganho = só passar o linter. **Não vale.**

Crescimento futuro do count é esperado se features novas exigirem novas funções SECDEF auth-callable. Documentar aqui caso a caso.

---

## Categorias

### 1. `function_search_path_mutable` (maioria)

Funções legacy criadas sem `SET search_path = public` explícito. Risco teórico de hijack se um schema malicioso for criado antes de `public` no `search_path` do role executor.

**Mitigação atual:** todas as funções rodam com role `postgres` ou `service_role` (search_path controlado pelo Supabase). Risco prático ≈ 0.

**Ação futura:** adicionar `SET search_path = public` em cada função em PR de hardening dedicado. Lista das funções afetadas a ser exportada via `supabase--linter` antes do PR de cleanup.

### 2. `rls_disabled` / `policy_exists_rls_disabled` (algumas tabelas auxiliares)

Tabelas internas (config, lookup, staging) sem RLS habilitado. Acessadas exclusivamente por `service_role` em edge functions; clientes anônimos/authenticated não têm grant direto.

**Ação futura:** habilitar RLS com policy `USING (false)` por padrão e abrir só onde necessário.

### 3. `storage_bucket_public` (buckets públicos intencionais)

Buckets de fotos de utensílios, fotos de checklist, anexos de manutenção declarados públicos por design (URLs compartilhadas em links/PDFs).

**Ação futura:** revisar caso a caso se vale migrar para signed URLs.

### 4. `extension_in_public_schema`

`pg_trgm` / `unaccent` instalados em `public` (default Supabase). Padrão da plataforma.

**Ação futura:** mover para schema `extensions` quando Supabase oferecer migração assistida.

---

## Próximos passos

1. Concluir Etapa 3 (PR 1 → 2 → 3 → 4).
2. Abrir PR de hardening: rodar `supabase--linter`, exportar lista exata, gerar migration única corrigindo `search_path` em lote + RLS nas tabelas faltantes.
3. Validar que contagem de warnings cai para ≤ 5 (apenas extensions/buckets intencionais).

## Decisão C · gerente_unidade vê todos os cargos da loja

**Data:** 2026-05-13
**Owner:** Pedro Contarini

**Contexto.** A coluna `cargo` não existe em `profiles`. Reside em `employees.role` ou `job_titles`. Resolver o lookup na Fase B exigia migration estrutural extra fora do escopo.

**Decisão.** A policy `p_results_gerente_self` em `payout_results_monthly` filtra apenas por loja, sem filtrar por cargo.

**Impacto.** Um `gerente_unidade` enxerga o payout de TODOS os colaboradores (chefes + outro gerente) da sua loja.

**Aceitável porque.** Gerentes já têm visão de equipe operacionalmente. O dado é interno à liderança da unidade.

**Refinar quando.** Fase D (UI). Esconder no front-end os cargos que não são do usuário logado, OU implementar lookup `profiles → employees → role` para filtrar no banco.
