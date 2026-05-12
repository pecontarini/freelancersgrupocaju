# TECH_DEBT — Linter & Schema Warnings

Documento de dívida técnica acumulada. **NÃO é escopo da Etapa 3 (PRs 1–4)**. Limpeza programada para PR separado após o fechamento da Etapa 3.

Última atualização: 2026-05-12 — após PR 1 (schema validação PIX + AJ1).

---

## Status

- **Total de warnings ativos no Supabase Linter:** 61
- **Introduzidos pelo PR 1:** 0
- **Pré-existentes:** 61

Nenhum warning é bloqueante para operação. Nenhum representa exposição de dados sensíveis confirmada — todos são *hardening* recomendado.

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
