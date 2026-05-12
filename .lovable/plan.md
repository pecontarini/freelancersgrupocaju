
# Respostas P1–P6 (pré-condicional aos PRs da Etapa 3)

Conforme combinado: **nenhum código antes de você validar estas respostas.** Ajustes incorporados: PIX-only, Opção B confirmada, schedule_drafts, archived flag, snapshot na ordem.

---

## P1 — Consumidores atuais de `freelancer_entries` (origem='escala' inclusive)

| # | Arquivo / Hook | Uso | Ação para `archived=false` |
|---|---|---|---|
| 1 | `src/hooks/useFreelancerEntries.ts` (`queryKey: ["freelancer-entries"]`) | Lista global usada por `EntriesTable`, `FilterBar`, `SummaryCard`, `FinancialCharts`, `ExportReportButton`, `AuditReportButton`, `MobileFreelancerCard` | Adicionar `.eq("archived", false)` na query base + parâmetro opcional `includeArchived` para tela admin de auditoria |
| 2 | `src/hooks/useScheduledFreelancers.ts` | Lê entries `origem='manual'` para casar com check-in da estação | Filtrar `archived=false`; itens arquivados não aparecem na estação |
| 3 | `src/hooks/useEstacaoStatus.ts` | Subscribe realtime + leitura para painel da estação | Filtrar `archived=false` na query inicial; ignorar eventos realtime cuja linha esteja `archived=true` |
| 4 | `src/hooks/useCpfLookup.ts` | Fallback de busca de freelancer pelo CPF | Manter — lookup pode usar histórico arquivado (read-only) |
| 5 | `src/components/ImportSpreadsheetModal.tsx` (linha 326) | Insert em massa de planilha | Sem mudança (insert define `archived=false` por default) |
| 6 | `src/components/ClearEntriesModal.tsx` (linha 51) | DELETE em massa | Migrar para soft-archive (`UPDATE archived=true`) em vez de DELETE físico |
| 7 | `src/components/escalas/FreelancerAddModal.tsx` (linha 178) | Lookup unificado | Sem mudança (read-only) |
| 8 | `src/pages/FreelancerCheckin.tsx` (linha 180) | Pré-preenche perfil pelo histórico | Sem mudança (read-only); manter para fallback |
| 9 | RPC `lookup_freelancer_unified` / `lookup_freelancer_by_cpf` | Função SQL de lookup global por CPF | Sem mudança (lookup histórico) |
| 10 | RPC `merge_duplicate_employees`, trigger `sync_schedule_to_freelancer_entry`, trigger `create_pending_manual_checkin`, RPC `promote_approved_checkins` | Triggers internos | `sync_schedule_to_freelancer_entry` será **desativado/condicionado** (PR 2). Demais não tocam `archived` — ok. |

**Telas/Hooks que precisam UI nova:** `EntriesTable` ganha aba/filtro "Arquivados (sistema)" visível só para admin.

---

## P2 — Panorama atual (consulta executada agora)

### `freelancer_entries` (total: 9.466 linhas)

| Métrica | Linhas |
|---|---|
| origem='escala' (criadas pelo trigger problemático) | **626** |
| origem='manual' | 8.840 |
| `chave_pix` igual ao CPF (PIX = CPF, com tipo possivelmente vazio) | **5.105** |
| `chave_pix` vazia/null | **211** |
| `valor` zero/negativo | 0 |
| Órfãos (origem=escala sem schedule válido) | 0 |
| Duplicados por (schedule_id, data) | 0 |

### `freelancer_profiles` (total: 1.616 linhas)

| Métrica | Linhas |
|---|---|
| Sem `chave_pix` | 0 |
| **Sem `tipo_chave_pix` (NULL/vazio)** | **1.615** (= 99,9%) |
| `chave_pix` igual ao CPF | **826** (51%) |

**Diagnóstico operacional:** praticamente todos os perfis estão sem `tipo_chave_pix` definido. Quase metade têm PIX = CPF (pode ser legítimo se for PIX-CPF, mas sem `tipo_chave_pix` não dá pra confirmar). Isso significa que ao ativar a trava da D2, **a maioria das ordens de pagamento será bloqueada até regularização cadastral** — precisamos de:
1. Migration que **infere** `tipo_chave_pix='cpf'` para os 826 onde `chave_pix == cpf`. Reduz pendência para ~789 perfis (1.615 − 826).
2. Tela "Cadastros pendentes" para operator/admin tratar o restante.
3. Bloqueio de promoção é gradual: só vale para `checkin_budget_entries` criados depois do go-live.

---

## P3 — Integrações externas

**Verificação no código:** não há edge function ou hook chamando API externa de banco/ERP a partir de `checkin_budget_entries` ou `freelancer_profiles`. As únicas saídas externas detectadas são:
- **PDF gerado no cliente** (`CheckinPaymentOrder.tsx` via `jspdf`).
- **Excel master export** (`MasterExportButton.tsx`, `scheduleMasterExport.ts`) — dados de escala, não de PIX.
- **Webhooks n8n** referenciados em `useN8nWebhooks.ts` — não consultados para pagamento freelancer (verificado).

**Ação:** nenhuma quebra de integração esperada ao adicionar `pix_snapshot jsonb` e bloqueios. Mesmo assim, recomendo **confirmar com o time financeiro** se há export para Conta Simples / contábil hoje feito manualmente a partir do PDF — caso afirmativo, manter o layout atual de colunas no PDF (Nome, CPF, Chave Pix, Entrada, Saída, Valor) e só **enriquecer o snapshot internamente**.

> **Pergunta de volta para você:** confirma que hoje o PDF da ordem é a única saída e não há export CSV para banco?

---

## P4 — Status "no-show"

**Estado atual:** **NÃO existe.** O sistema tem em `freelancer_checkins.status`: `pending_schedule | open | completed | approved | rejected`. Quando o freelancer é escalado e não aparece, o stub `pending_schedule` fica órfão indefinidamente; o manager hoje precisa rejeitar manualmente.

**Proposta (entra na PR 2):**
1. Adicionar `status='no_show'` ao enum/check de `freelancer_checkins`.
2. Botão "Marcar no-show" no `CheckinManagerDashboard` (ao lado de "Aprovar/Rejeitar"), exigindo justificativa.
3. Job diário (cron) ou trigger de fechamento: ao virar D+1 sem check-in real, status `pending_schedule` vira `no_show` automaticamente, com flag `auto_closed=true`.
4. No-show **nunca** vira `checkin_budget_entries` (RPC `promote_approved_checkins` já filtra por `status='approved'` — basta ele continuar excluindo `no_show`).
5. Relatório no dashboard: contador de no-shows por unidade/mês para ações disciplinares.

---

## P5 — Sugestão IA: tipo (efetivo vs extra) por slot

**Recomendação:** **sugerir SEM deixar em branco**, mas marcado como sugestão (não fixo). O modelo decide:

- **Efetivo** quando o slot está dentro do `staffing_matrix.required_count` ou `escala_minima.qtd_efetivos` ainda não preenchido para aquele setor/dia/turno.
- **Extra** quando o slot é adicional (acima do `required_count`, dentro de `extras_count`/`qtd_extras`), tipicamente em horário de pico (já mapeado em `peakHours.ts`).
- Cap: nunca sugerir mais extras do que `extras_count` + warning se ultrapassar.

A UI mostra o tipo sugerido com um chip clicável (Efetivo/Extra) que o operador pode trocar antes de vincular o colaborador. Argumento: deixar 100% em branco força o manager a decidir 60+ slots de tipo, retrabalho desnecessário; deixar editável preserva o controle humano.

> **Confirma essa abordagem ou prefere "100% em branco"?**

---

## P6 — Plano de testes manuais (executável em staging antes do merge de cada PR)

### Setup pré-teste
- 3 contas: `admin@teste`, `operator@teste` (vinculado à Caju Itaim), `manager@teste` (vinculado à Caju Itaim, role `gerente_unidade`).
- 1 freelancer "BOM" (PIX=CPF, tipo='cpf'), 1 "PENDENTE" (sem tipo_pix), 1 "PROBLEMA" (PIX aleatória UUID), 1 "TERCEIRO" (PIX = CPF de outra pessoa).

### Casos PR1 (validação PIX + snapshot + trava promote)

| # | Caso | Perfil | Resultado esperado |
|---|---|---|---|
| 1.1 | Cadastrar freelancer com PIX UUID aleatória | operator | Trigger rejeita: "PIX para terceiros não será processado…" |
| 1.2 | Cadastrar com tipo='cpf' mas chave≠cpf | operator | Trigger rejeita |
| 1.3 | Cadastrar com tipo='email' e regex inválido | operator | Trigger rejeita |
| 1.4 | Cadastrar com tipo='telefone' formato +55... | operator | Aceito |
| 1.5 | Manager tenta editar PIX | manager | RLS rejeita (403) |
| 1.6 | Manager clica "Solicitar atualização cadastral" | manager | Flag `update_requested_by` salva + notif para operator |
| 1.7 | Aprovar lote check-ins de freelancer "PENDENTE" | operator | RPC rejeita: "PIX inválido ou ausente — atualize o cadastro" |
| 1.8 | Aprovar lote check-ins de freelancer "BOM" | operator | Sucesso; `checkin_budget_entries.pix_snapshot` populado com tipo, chave, cpf_titular, nome_titular, validated_at, validated_by_user_id |
| 1.9 | Editar PIX do freelancer DEPOIS da promoção e gerar PDF | admin | PDF mostra o PIX **antigo** (snapshot), não o novo |

### Casos PR2 (trigger desativado + UI + no-show)

| # | Caso | Perfil | Resultado esperado |
|---|---|---|---|
| 2.1 | Lançar freelancer extra na escala | manager | `schedules` criado; **NENHUMA** linha em `freelancer_entries` (origem='escala'); `freelancer_checkins` stub pending_schedule criado |
| 2.2 | Slot do freelancer no grid | — | Badge "Aguardando check-in" |
| 2.3 | Freelancer faz check-in na estação | público | Badge muda para "Check-in confirmado" |
| 2.4 | Manager aprova presença + valor | manager | Badge "Aprovado — aguardando pagamento" |
| 2.5 | Operator aprova lote em CheckinBatchApproval | operator | Badge "Enviado para pagamento"; entrada em `checkin_budget_entries` |
| 2.6 | Freelancer não aparece, vira D+1 | cron | Stub pending_schedule vira `no_show` automático |
| 2.7 | Manager marca no-show manual | manager | Status atualiza, justificativa obrigatória |

### Casos PR3 (limpeza)

| # | Caso | Perfil | Resultado esperado |
|---|---|---|---|
| 3.1 | Operator tenta abrir tela de limpeza | operator | UI bloqueia (403) |
| 3.2 | Admin gera preview da limpeza | admin | JSON listando linhas por critério (a–f) sem deletar nada |
| 3.3 | Admin clica Confirmar (digita "LIMPAR") | admin | CSV de backup salvo no Storage `cleanup-backups/{timestamp}.csv`, transação roda, `audit_log` registra contagem por critério |
| 3.4 | Critério (f) específico (anexo a enviar) | admin | Preview mostra exatamente os registros do critério recebido |
| 3.5 | Admin tenta reverter (rollback) | admin | UI permite restaurar a partir do CSV de backup |

### Casos PR4 (archived/backfill)

| # | Caso | Perfil | Resultado esperado |
|---|---|---|---|
| 4.1 | Backfill marca `archived=true` para 626 linhas origem='escala' sem `checkin_budget_entries` | migration | Contagem confere com preview |
| 4.2 | Tela `EntriesTable` carrega | qualquer | Mostra apenas `archived=false` (manuais) |
| 4.3 | Admin liga toggle "Mostrar arquivados" | admin | Vê linhas com badge "Arquivado pelo sistema" |
| 4.4 | Filtros (ExportReport, Charts, Summary) | qualquer | Totais batem com `archived=false` |

### Casos cross-cutting

| # | Caso | Perfil | Resultado esperado |
|---|---|---|---|
| X.1 | Manager publica escala estourando budget | manager | Warning, exige PIN do operator para override |
| X.2 | Operator digita PIN errado | operator | Bloqueia; audit_log registra tentativa |
| X.3 | Manager publica escala excedendo cota de extras | manager | Warning + override por PIN |
| X.4 | Manager tenta publicar com slot vazio | manager | Botão "Publicar" desabilitado |

**Critério de aceite final:** os 4 PRs (1→2→3→4) só são considerados "done" depois que os 4 blocos de teste acima estiverem todos verdes em staging com evidências (screenshots + dump de tabela) anexadas no PR.

---

## Pendências antes de eu começar a codar

1. **Anexo do critério (f)** da limpeza (você mencionou que vem em mensagem separada).
2. **Confirmação P3**: PDF é única saída? Sem export para banco/ERP hoje?
3. **Confirmação P5**: a IA pode sugerir efetivo/extra (com chip editável) ou prefere 100% em branco?
4. **Tela "Cadastros pendentes"**: aceito que ela seja entregue dentro do PR 1 (junto com a trava de promoção), para evitar que a trava bloqueie operação no go-live?

Aguardando suas respostas para abrir o PR 1.
