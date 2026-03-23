# Plano: Integrar Presença de Freelancers ao Budget Gerencial com Regras de Aprovação

## Diagnóstico

O sistema atual tem dois fluxos separados:

- **freelancer_entries**: lançamentos manuais que alimentam o dashboard de budget (BudgetsGerenciaisTab, FinancialHealthCard)
- **freelancer_checkins**: registros de presença via QR Code com aprovação pelo gestor (CheckinManagerDashboard)

Esses dois fluxos não estão conectados. O pedido é que checkins aprovados sejam automaticamente lançados como custo no budget, e que a ordem de pagamento só funcione para registros que passaram por esse fluxo.

## Mudanças

### 1. Migração SQL — nova tabela `checkin_budget_entries` + RLS

Tabela ponte que registra o lançamento de um checkin aprovado no budget, criando a trilha de auditoria:


| Coluna          | Tipo                                 | Notas                            |
| --------------- | ------------------------------------ | -------------------------------- |
| id              | uuid PK                              | &nbsp;                           |
| checkin_id      | uuid FK → freelancer_checkins UNIQUE | 1:1                              |
| loja_id         | uuid FK → config_lojas               | &nbsp;                           |
| freelancer_name | text                                 | snapshot do nome                 |
| cpf             | text                                 | snapshot                         |
| chave_pix       | text                                 | snapshot                         |
| tipo_chave_pix  | text                                 | snapshot                         |
| data_servico    | date                                 | data do checkin                  |
| checkin_at      | timestamptz                          | horário entrada                  |
| checkout_at     | timestamptz                          | horário saída                    |
| valor           | numeric NOT NULL                     | valor_aprovado                   |
| signed_by       | uuid                                 | ID do gestor que assinou         |
| signed_at       | timestamptz                          | timestamp da assinatura          |
| approval_id     | uuid FK → checkin_approvals          | referência da assinatura em lote |
| created_at      | timestamptz                          | &nbsp;                           |


**RLS**: SELECT para autenticados com acesso à loja. INSERT apenas via DB function (segurança).

**DB Function** `promote_approved_checkins(p_approval_id uuid)`: security definer function que, dada uma approval, insere os checkins aprovados (status='approved' AND valor_status='approved') na tabela `checkin_budget_entries`. Ignora checkins já promovidos (ON CONFLICT DO NOTHING). Retorna quantidade inserida.

**RLS na ordem de pagamento**: A query de checkins para pagamento deve fazer JOIN com `checkin_budget_entries` — só retorna checkins que existem nessa tabela.

### 2. `src/hooks/useCheckinApprovals.ts` — chamar promote após batch approve

Após `batchApprove.mutateAsync`, chamar um RPC `promote_approved_checkins` passando o approval_id retornado. Isso garante que a promoção ao budget aconteça atomicamente com a assinatura.

### 3. `src/hooks/useCheckinBudgetEntries.ts` — novo hook

Query que busca `checkin_budget_entries` filtrado por loja e mês. Retorna dados formatados compatíveis com o dashboard de budget (nome, data, valor, horários).

### 4. `src/components/dashboard/BudgetsGerenciaisTab.tsx` — exibir custos de presença

- Importar `useCheckinBudgetEntries`
- Somar os valores ao total de freelancers (ou como sub-categoria "Presença Freelancers")
- Exibir na lista de lançamentos recentes com badge "Via Check-in"
- Esses registros são somente leitura (não editáveis/deletáveis pelo dashboard)

### 5. `src/components/FinancialHealthCard.tsx` — incluir presença no cálculo

- Importar `useCheckinBudgetEntries`
- Somar ao `freelancerTotal` existente na categoria Freelancers
- Sem mudança visual — apenas o valor aumenta

### 6. `src/components/checkin/CheckinPaymentOrder.tsx` — bloqueio no frontend

- Só exibir checkins que existem na `checkin_budget_entries`
- Mostrar mensagem clara quando há checkins aprovados mas não promovidos
- Incluir chave_pix e tipo_chave_pix no PDF

### 7. `src/components/checkin/CheckinManagerDashboard.tsx` — feedback visual

- Após assinatura em lote bem-sucedida, exibir toast informando que os registros foram lançados no budget
- Badge visual nos cards já promovidos

## Arquivos


| Arquivo                                              | Ação                          |
| ---------------------------------------------------- | ----------------------------- |
| Nova migração SQL                                    | Tabela, function, RLS         |
| `src/hooks/useCheckinApprovals.ts`                   | Chamar RPC promote após batch |
| `src/hooks/useCheckinBudgetEntries.ts`               | Novo hook                     |
| `src/components/dashboard/BudgetsGerenciaisTab.tsx`  | Exibir custos de presença     |
| `src/components/FinancialHealthCard.tsx`             | Somar presença ao freelancer  |
| `src/components/checkin/CheckinPaymentOrder.tsx`     | Bloqueio + dados Pix          |
| `src/components/checkin/CheckinManagerDashboard.tsx` | Feedback pós-assinatura       |


## Ordem de Implementação

1. Migração SQL (tabela + function + RLS)
2. Hook `useCheckinBudgetEntries`
3. Atualizar `useCheckinApprovals` para chamar promote
4. Integrar ao BudgetsGerenciaisTab e FinancialHealthCard
5. Bloqueio na CheckinPaymentOrder
6. Feedback visual no CheckinManagerDashboard  
  
**Adendo ao Plano 2 — Campo de valor no fluxo do freelancer e confirmação pelo gestor**
  > **Ajuste no check-in (página pública via QR Code)** O formulário de check-in deve incluir um campo obrigatório de valor a receber pelo dia de trabalho. O freelancer preenche esse valor no momento da entrada, antes de registrar a selfie. O valor deve ser salvo na tabela `freelancer_checkins` em uma coluna `valor_solicitado numeric`.
  >
  > **Ajuste no painel do gestor (CheckinManagerDashboard)** No card de cada freelancer, exibir o valor solicitado pelo freelancer. O gestor deve poder editar esse valor antes de aprovar — se concordar, mantém; se divergir, corrige. O valor final confirmado pelo gestor deve ser salvo como `valor_aprovado numeric` no registro de presença. Somente o `valor_aprovado` deve ser usado na promoção ao budget e na ordem de pagamento — nunca o `valor_solicitado` diretamente.
  >
  > **Ajuste na tabela** `checkin_budget_entries` A coluna `valor` deve ser populada com o `valor_aprovado` definido pelo gestor, não com o valor original do freelancer. A DB function `promote_approved_checkins` deve ler o `valor_aprovado`do registro de presença ao criar a entrada no budget.
  >
  > **Restrição adicional** Checkins sem `valor_aprovado` preenchido não podem ser promovidos ao budget nem incluídos em ordem de pagamento. O sistema deve bloquear a assinatura em lote se houver checkins aprovados com valor pendente de confirmação.