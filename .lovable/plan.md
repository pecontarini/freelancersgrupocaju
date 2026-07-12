
# Remoção de módulos + Simplificação do app

## O que fica

- **Unitários, Budgets e Inventário** — tab `unitarios-gerentes` + `utensilios`
- **Gestão de Pessoas** — tab `gestao-pessoas` (escalas, freelancers, presença)
- **Agenda do Líder** — tab `agenda-lider` e rota `/agenda`
- **Configurações** — tab `configuracoes`

## O que sai (totalmente removido)

| Módulo | Tab / Rota | Componentes principais |
|---|---|---|
| Quadro Operacional | `quadro-operacional` | `OperationalDashboard` |
| Diagnóstico de Auditoria | `diagnostico` | `AuditDiagnosticDashboard`, `audit-diagnostic/`, `audit/` |
| Indicadores Operacionais | `/painel/metas` | `pages/painel/Metas.tsx`, `painel-metas/`, `indicadores/`, `metas/` |
| Remuneração Variável | `/painel/metas-variaveis` | `pages/painel/MetasVariaveis.tsx`, `leadership/`, `BonusCalculatorCard` |
| Visão Rede | `rede` | `RedeTab`, `ExecutiveNetworkDashboard`, `NetworkSummary`, `HoldingCentralTab` |

## Etapas de execução

### Etapa 1 · Frontend — remoção de acessos e páginas
- Editar `src/pages/Index.tsx`: remover imports, entradas de `tabConfig`, cases do switch e navegações (`painel`, `metas-variaveis`).
- Editar `src/App.tsx`: remover rotas `/painel/metas` e `/painel/metas-variaveis` (mantendo apenas `/agenda`, `/checkin`, etc.).
- Editar `src/components/layout/AppSidebar.tsx` e `BottomNavigation.tsx`: remover itens de menu dos módulos deletados.
- Excluir arquivos/pastas de página e componente correspondentes.

### Etapa 2 · Frontend — hooks, libs e assets órfãos
Remover apenas o que ficar sem uso após a Etapa 1:
- Hooks: `useAuditScores`, `useAuditSectorScores`, `useSupervisionAudits`, `useConformidadeData`, `useMetasHistorico`, `useMetasSnapshot`, `useIndicadoresSnapshot`, `usePayoutSnapshot`, `useLeadershipPerformance`, `useBonusRules`, `useAllSalesItems` (se só usado por rede), etc.
- Libs: `src/lib/audit/`, `src/lib/leadershipPdfGenerator.ts`, `src/lib/metasUtils.ts`, `src/lib/pdf/leadershipOccurrenceCard.ts`.
- Componentes soltos: `AuditReportButton`, `LeadershipRadar`, `MyPerformanceCard`, `WinsAlertsFeed`, `PerformanceEntriesList`, `PerformanceEntryForm`, `RankingsTab`, `UnitSummaryGrid`, `ComplianceHeatmap`, `SectorResponsibilityBadges`, `PendingValidationsList`, `AdminCXDashboard`, `CXHistoryArchive`, `CXPerformancePDF`, `ForecastingCard`.

**Validação**: `tsgo` (typecheck) precisa passar antes de seguir para a Etapa 3.

### Etapa 3 · Banco — drop de tabelas dos módulos removidos
Uma migração única com `DROP TABLE ... CASCADE` para as tabelas dos módulos removidos:

- **Auditoria**: `audit_alerts`, `audit_sector_scores`, `audit_upload_logs`, `supervision_audits`, `supervision_failures`, `checklist_corrections`
- **Indicadores/Metas**: `indicadores_snapshots`, `metas_snapshot`, `metas_cargo`, `nps_targets`
- **Remuneração variável**: `payout_indicator_sources`, `payout_orphan_records`, `payout_results_monthly`, `payout_role_target`, `payout_rules`, `bonus_config`, `bonus_rules`, `leadership_calculation_log`, `leadership_performance_scores`, `leadership_store_scores`, `store_performance`, `store_performance_entries`
- **Quadro operacional / rede**: `pop_ajustes_manuais`, `pop_minimo_padrao`, `pop_overrides`, `pop_reconciliacao_log`, `pop_relatorios_enviados`, `pop_unidades_agregadas`, `pracas_plano_chao`, `staffing_matrix`, `escala_minima` (se só usados aqui)

Também dropar edge functions ligadas (`calculate-leadership-performance`, `analyze-audit-patterns`, `generate-audit-alerts`, `scan-storage-fix-scores`, `submit-checklist-correction`, `plano-acao-ia` se estritamente do diagnóstico).

**Nota importante**: tabelas compartilhadas com módulos que ficam (ex: `action_plans` é usado tanto pelo Diagnóstico quanto pela Agenda do Líder) **não são dropadas** — apenas as views/UI de auditoria são removidas.

### Etapa 4 · Sidebar dinâmica por tenant (para o futuro)
Adicionar em `TenantConfig` uma propriedade `enabledModules: string[]` — hoje o Caju terá apenas os 4 módulos que sobraram, e novas empresas herdam o mesmo conjunto por padrão. Isso deixa a arquitetura pronta para reativar módulos por marca caso necessário.

## Detalhes técnicos

- Ordem obrigatória: **frontend primeiro, banco depois**. Dropar tabelas antes de remover o código causaria erros de runtime na hora atual.
- Cada `DROP TABLE` usa `CASCADE` para remover FKs, policies, triggers e índices dependentes.
- `tsgo --noEmit` roda ao final da Etapa 2 para garantir zero referências penduradas.
- Após a Etapa 3, o linter Supabase é reexecutado; warnings pré-existentes de views SECURITY DEFINER ligadas às tabelas removidas devem sumir.

## Riscos e ressalvas

- **Perda de dados histórica**: dados de auditoria, indicadores e remuneração variável do Caju **serão apagados permanentemente**. Se quiser exportar um snapshot antes, faça agora.
- **`action_plans`, `planos_acao`, `missoes`**: são usados pela Agenda do Líder — **ficam**. Se algum campo era exclusivo do Diagnóstico, ele fica sem uso mas não incomoda.
- **`useCMV` / CMV**: fica (parte de Unitários Gerentes).
- **`checklist_*`**: ficam (usados pelo self-checklist diário, que é parte de Gestão de Pessoas). `checklist_corrections` sai porque era vinculado ao fluxo de correção do Diagnóstico.
