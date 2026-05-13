# Painel de Metas Variáveis · Estado do Projeto

**Última atualização:** 2026-05-13

## Status atual

✅ **Fase 1 · Painel Visual MVP** (em andamento)
- Dashboard `/painel/metas-variaveis` ativo
- Lê direto de `sheets_blocks_snapshot` (4 fontes)
- Planilha continua sendo SSOT (Single Source of Truth)
- Sync manual via Edge Function `sync-sheets-staging`

⏸️ **Fase 2 · Automação da Planilha** (pausada)
- `compute_payouts` real (substitui Duda no cálculo)
- 5 parsers SQL individuais (`parse_cmv_salmao_avg`, `parse_cmv_carnes_diff`, `parse_nps_revenue`, `parse_kds_brand_avg`, `parse_conformidade`)
- Workflow n8n diário
- Trabalho avançado em B5/B6 (esqueleto pronto, 67.77% match em maio/2026)

⏸️ **Fase 3 · Migração SSOT** (futuro)
- Banco vira fonte de verdade
- Planilha vira espelho readonly

## O que está pronto no banco

- 11 lojas operacionais ativas em `config_lojas` com `code+brand+cnpj`
- 4 CNPJs administrativos em `cnpj_administrativo`
- Tabelas: `payout_rules`, `payout_indicator_sources`, `payout_results_monthly`, `payout_orphan_records`
- Funções: `classify_payout`, `normalize_loja_code`, `resolve_loja_id`, `get_latest_payload`
- 5 parsers TypeScript em `sync-sheets-staging` (parsePayoutRules, parsePayoutTargetByRole, parsePayoutConsolidated, parsePayoutRegistry, parseSalmaoDiario)
- 7+ fontes sincronizando OK em `sheets_sources`

## Fontes ativas (sheets_sources · meta_keys de payout)

| meta_key | nome | status |
|---|---|---|
| payout_rules | Painel de Metas · Regras | ok |
| payout_target_by_role | Painel de Metas · Target por Cargo | ok |
| payout_consolidated | Painel de Metas · Consolidado | ok |
| payout_registry | Painel de Metas · Registro | ok |

Outras fontes operacionais: `nps`, `cmv-salmao`, `cmv-carnes`, `conformidade`, `atendimento-medias`, `reclamacoes`, `salmao_diario`, `ranking-supervisores`.

## Edge Functions

- `get-payout-snapshot` (read-only, auth-protected) — retorna `{consolidated, registry, rules, target_by_role, last_sync, mes_ref, sources}`.
- `sync-sheets-staging` — sincronização individual por `sourceId`.

## Decisões importantes

- **Caju Itaim = CJ SP** (CNPJ próprio 62.723.936/0001-06)
- `gerente_unidade` vê todos os cargos da própria loja (TECH_DEBT.md)
- **Modelo C híbrido**: regras na planilha, painel lê do banco
- Frontend filtra `consolidated` e `registry` por `loja_code` quando `operator`/`gerente_unidade`

## Rota e RBAC

- `/painel/metas-variaveis` (ProtectedRoute)
- `admin`: vê todas as 11 lojas
- `operator`: filtra pelas lojas vinculadas (`unidades`)
- `gerente_unidade`: filtra pela própria loja
