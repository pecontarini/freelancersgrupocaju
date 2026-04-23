

## Plano: unificar lançamentos (Escala + Budget Manual) → mesma pendência de Check-in

### Diagnóstico — respondendo direto à sua pergunta

**Os dois lançamentos vão pro mesmo lugar?**
- **SIM**, ambos terminam na **mesma tabela `freelancer_entries`** que abastece o **Budget Gerencial**.
- Mas eles têm origens diferentes:
  - Escala (Editor de Escalas) → `origem = 'escala'`, com `schedule_id` preenchido (195 entries hoje)
  - Formulário manual (aba Budget) → `origem = 'manual'`, sem `schedule_id` (6.616 entries hoje)

**Os dois ativam pendência de check-in?**
- **NÃO. Hoje nenhum dos dois está ativando — descoberta crítica:**
  - Os triggers que criariam o stub `pending_schedule` em `freelancer_checkins` **não existem no banco** (consultei `pg_trigger` agora — vazio para `schedules`, `freelancer_entries` e `freelancer_checkins`).
  - A função `create_pending_schedule_checkin()` foi criada na migração anterior, mas o `CREATE TRIGGER` não foi efetivado.
  - O lançamento **manual** (formulário do Budget) **nunca teve** essa ponte — só foi pensada para escala.

**Resultado prático hoje:** o card "Aguardando" na aba Presença não aparece nem para freelancer agendado, nem para freelancer lançado direto no Budget. Só aparece check-in real quando o freelancer abre o `/checkin` no celular.

### O que vou implementar

#### 1. Reativar os triggers que sumiram do banco
Recriar via migração:
- `trg_sync_schedule_to_freelancer_entry` em `schedules` (sync escala → budget)
- `trg_create_pending_schedule_checkin` em `schedules` (cria card "Aguardando" para escala)

Sem esses, nada do fluxo automático funciona.

#### 2. **Nova ponte: lançamento manual também cria card "Aguardando"**
Criar função SQL `create_pending_manual_checkin()` + trigger em `freelancer_entries`:

- Quando alguém lança freelancer pelo formulário do Budget Gerencial **com CPF válido** e `data_pop >= hoje`, o trigger:
  - Garante perfil em `freelancer_profiles` (lookup/insert por CPF)
  - Insere stub em `freelancer_checkins` com `status = 'pending_schedule'`, `valor_informado = valor lançado`, `loja_id`, `checkin_date = data_pop`
  - **Marca o stub com `entry_id`** (nova coluna nullable em `freelancer_checkins`) para amarrar de volta ao lançamento manual e permitir limpeza no DELETE
- Se o lançamento for editado (UPDATE de `valor` ou `data_pop`), o stub é atualizado.
- Se o lançamento for excluído, o stub `pending_schedule` correspondente é removido.

**Salvaguarda contra duplicidade:** se já existe um stub `pending_schedule` para o **mesmo CPF + mesma loja + mesma data** (vindo da escala), o trigger de manual **não cria outro** — apenas anexa o `entry_id` no stub existente, evitando "Aguardando" duplicado na aba Presença.

#### 3. Aba Presença passa a unir as duas fontes
Atualizar `useScheduledFreelancers` (ou criar `usePendingFreelancers`) para puxar **2 fontes** para a data selecionada:

- **(A)** Escalas em `schedules` (já funciona) — vira card "Aguardando" com horário e função
- **(B)** Lançamentos `freelancer_entries.origem='manual'` com CPF e `data_pop = data` — vira card "Aguardando" com etiqueta **"Lançamento manual — sem horário previsto"** e o valor

Ambos casam com check-in real via:
1. `schedule_id` (escala) ou `entry_id` (manual)
2. CPF normalizado (fallback)
3. Nome normalizado (último fallback)

#### 4. Quando o check-in real acontece
- O fluxo `/checkin` continua igual: `findPendingScheduleCheckin` busca por CPF/data, encontra o stub (seja de escala ou de manual) e atualiza com selfie/GPS/valor.
- **Após aprovação em lote**, `promote_approved_checkins` (já existente) precisa de um pequeno ajuste para **também limpar `freelancer_entries.origem='manual'`** quando o stub tinha `entry_id` preenchido — evita lançamento manual duplicado no Budget após o check-in virar definitivo.

### Resultado para o usuário

| Como o gerente lança | Vira no Budget | Vira na Presença | Quando freelancer faz check-in |
|---|---|---|---|
| Editor de Escalas (com CPF) | Previsto - Escala | Card "Aguardando" com horário | Card vira "Check-in realizado", aprova → "Via Check-in" |
| Formulário Budget (com CPF, data hoje/futuro) | Lançamento manual | Card "Aguardando — sem horário" | Card vira "Check-in realizado", aprova → "Via Check-in" (substitui o manual) |
| Formulário Budget (sem CPF ou data passada) | Lançamento manual | **Não aparece** (não há como casar) | N/A |
| Freelancer avulso só faz check-in | — | Aparece direto após check-in | Aprova normal |

### Mudanças técnicas

| Arquivo / objeto | Mudança |
|---|---|
| Migração SQL | `CREATE TRIGGER trg_sync_schedule_to_freelancer_entry` |
| Migração SQL | `CREATE TRIGGER trg_create_pending_schedule_checkin` |
| Migração SQL | Nova coluna `freelancer_checkins.entry_id uuid NULL` + FK + índice |
| Migração SQL | Nova função `create_pending_manual_checkin()` + trigger em `freelancer_entries` |
| Migração SQL | Ajuste em `promote_approved_checkins` para limpar `freelancer_entries.origem='manual'` quando `entry_id` existe |
| `useScheduledFreelancers.ts` | Unir entries manuais pendentes na lista |
| `CheckinManagerDashboard.tsx` | Matching adicional por `entry_id` + label "sem horário" para origem manual |

### O que **não** entra agora

- Mudanças visuais grandes na aba Presença (só o badge "sem horário" para lançamentos manuais)
- Mudanças no `/checkin` real (o lookup por CPF já encontra qualquer stub)
- Mudanças no `/checkin-demo`
- Mudanças no formulário de lançamento manual em si (mantém os mesmos campos)

### Validação

1. Lançar 1 freelancer pelo formulário do Budget com CPF e data = hoje → conferir "Aguardando" na Presença.
2. Lançar 1 freelancer pelo formulário com data = ontem → confirmar que **não** aparece na Presença (correto).
3. Editar o valor do lançamento manual → conferir que o stub atualizou `valor_informado`.
4. Excluir o lançamento manual → conferir que o stub `pending_schedule` sumiu.
5. Lançar pelo formulário um CPF que **já está agendado** na escala para o mesmo dia → conferir que aparece **um único** card "Aguardando" (sem duplicar).
6. Freelancer faz check-in real do CPF lançado manualmente → card vira "Check-in realizado", aprovação em lote substitui o lançamento manual por "Via Check-in".

