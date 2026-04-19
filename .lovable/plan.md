

## Plano: Integração automática Escalas ↔ Budget Gerencial

### Conceito
Quando um **freelancer** for escalado no Editor de Escalas (com diária definida), criar automaticamente um lançamento "provisório" no Budget Gerencial, com origem rastreável e que se atualiza/cancela conforme a escala muda.

### 1) Schema: marcar origem do lançamento
Migration adicionando 2 colunas em `freelancer_entries`:
- `schedule_id uuid NULL` — referência opcional para `schedules.id`
- `origem text NOT NULL DEFAULT 'manual'` — valores: `'manual'`, `'escala'`, `'checkin'`

Índice único parcial: `UNIQUE (schedule_id) WHERE schedule_id IS NOT NULL AND origem = 'escala'` — garante 1 lançamento por turno escalado.

### 2) Trigger no Postgres: sincronizar `schedules` → `freelancer_entries`

Trigger `AFTER INSERT/UPDATE/DELETE` em `schedules`:

- **INSERT** de escala `working` para freelancer com `daily_rate > 0`:
  - Busca `cpf`, `nome`, `chave_pix` em `employees` (já está lá ao adicionar via FreelancerAddModal).
  - Insere em `freelancer_entries` com `origem='escala'`, `schedule_id=NEW.id`, `valor=NEW.daily_rate`, `data_pop=NEW.schedule_date`, `loja_id` da unidade.
  - Função/gerência: pega do `job_titles` vinculado.

- **UPDATE** mudando `daily_rate`, `schedule_date` ou `status='cancelled'`:
  - Atualiza ou marca o entry correspondente. Se status virou cancelled → deleta o entry de origem `escala`.

- **DELETE** de escala: cascata deleta o entry de origem `escala`.

### 3) Evitar duplicação com check-in
Quando o check-in for aprovado e `promote_approved_checkins` for chamada:
- Antes de inserir em `checkin_budget_entries`, **deletar o lançamento provisório** de `freelancer_entries` referente ao mesmo `schedule_id` (`origem='escala'`).
- Assim, a previsão (`escala`) é substituída pelo valor real (`checkin`) sem somar duas vezes.

### 4) UI: indicar origem no Budget Gerencial
Em `BudgetsGerenciaisTab.tsx` (lista "Freelancers Escalados"):
- Badge cinza "Previsto (Escala)" para entries com `origem='escala'`.
- Badge verde "Check-in confirmado" para `checkin_budget_entries`.
- Edição manual desses entries fica **bloqueada** (eles seguem a escala) — para alterar valor/data, o usuário muda na escala.

### 5) Backfill
Script único para criar entries `origem='escala'` para todas as escalas atuais de freelancers ainda não associados a um check-in aprovado.

### Resultado para o usuário
- Escalou um freela com diária R$ 120 na quinta → R$ 120 já aparece no Budget Gerencial daquele dia/loja como "Previsto".
- Freela faz check-in e aprovador confirma R$ 130 → lançamento "previsto" some, "Check-in R$ 130" aparece.
- Cancelou a escala → some do Budget automaticamente.
- Sem dupla contagem, sem trabalho manual.

### Arquivos
- **Migration nova**: 2 colunas em `freelancer_entries` + índice + trigger + ajuste em `promote_approved_checkins`.
- **`src/components/dashboard/BudgetsGerenciaisTab.tsx`**: badges de origem + bloquear edição de entries automáticos.
- **`src/components/EditFreelancerDialog.tsx`** e **`src/components/InlineBudgetEditor.tsx`**: respeitar origem ao permitir edição.
- **Backfill SQL**: gerar entries para escalas existentes.

### Validação
- Escalar freela → confere entry novo no Budget com badge "Previsto".
- Mudar diária na escala → valor atualiza no Budget.
- Cancelar escala → entry some.
- Aprovar check-in → "Previsto" vira "Confirmado" sem duplicar.
- Editar entry manual antigo (`origem='manual'`) continua funcionando normalmente.

