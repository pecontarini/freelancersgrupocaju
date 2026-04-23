

## Plano: ativar fluxo Escala → Presença → Pagamento de imediato

### Diagnóstico do estado atual (banco real)

| Métrica | Valor | Significado |
|---|---|---|
| Escalas freelancer (últimos 7d) | **287** | Editor de escalas funcionando |
| Lançamentos `origem='escala'` | **195** | Provisórios entrando no Budget |
| Check-ins reais (últimos 7d) | **0** | App `/checkin` ainda não usado em produção |
| Check-ins com `schedule_id` preenchido | **0** | Ponte escala→checkin nunca foi exercida |
| Lançamentos via check-in aprovado | **0** | Fluxo de assinatura ainda não rodou |
| Trigger `sync_schedule_to_freelancer_entry` ativo | **NÃO** | Sync de escala→budget está rodando por outro caminho (manual ou trigger removido) |

### O que já funciona hoje na aba **Presença de Freelancers** (`Quadro Operacional → Presença`)

A aba carrega 2 fontes para a data selecionada:

1. **`useScheduledFreelancers(unitId, date)`** → puxa `schedules` da loja + `employees.worker_type='freelancer'` com status `working`/`confirmed`/`scheduled`. Renderiza um card por agendado mostrando: nome, função, horário, valor combinado, e badge **"Aguardando"** ou **"Check-in realizado"**.
2. **`useFreelancerCheckins(lojaId, date)`** → puxa `freelancer_checkins` da loja para a data. Cada check-in vira `CheckinApprovalCard` com selfie, GPS, valor informado e botões **Aprovar Presença / Rejeitar / Confirmar Valor**.

O matching entre as duas listas hoje tenta **`schedule_id`** primeiro, depois cai para **normalização de nome**.

### Os 3 gaps que impedem 100% funcional imediato

**Gap 1 — Check-in real nunca grava `schedule_id`**
`createCheckin` em `useFreelancerCheckins.ts` insere sem `schedule_id`. O matching por nome funciona, mas é frágil (mudança de acento, abreviação). Resultado: o card "Aguardando" pode não virar "Check-in realizado" mesmo após o freelancer fazer check-in.

**Gap 2 — Não há "pré-criação" de checkin a partir da escala**
Hoje, agendar um freelancer na escala **não cria um stub** em `freelancer_checkins` com status `pending_schedule`. O código já espera esse stub (`findPendingScheduleCheckin` existe), mas nada o cria. Sem isso, o `schedule_id` nunca é amarrado no momento do check-in.

**Gap 3 — Trigger de sync escala→budget está desativado no banco**
Mesmo com 195 entries `origem='escala'` históricas, o trigger atual está ausente. Novas escalas inseridas agora **não estão alimentando o budget automaticamente** (a menos que outro caminho — manual ou edge function — esteja fazendo isso).

### O que vou implementar

#### 1. Reativar o trigger de sync escala→budget
Recriar o trigger em `schedules`:
```sql
CREATE TRIGGER trg_sync_schedule_to_freelancer_entry
AFTER INSERT OR UPDATE OR DELETE ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.sync_schedule_to_freelancer_entry();
```
Garante que **toda escala de freelancer** com `worker_type='freelancer'`, `status='working'` e `agreed_rate>0` cria/atualiza um `freelancer_entries` com `origem='escala'` aparecendo no Budget Gerencial como **"Previsto - Escala"**.

#### 2. Criar stub de check-in pendente ao agendar freelancer
Nova função SQL `create_pending_schedule_checkin()` + trigger em `schedules`. Quando uma escala de freelancer com CPF é criada/atualizada, insere um `freelancer_checkins` com:
- `schedule_id` = id da escala
- `freelancer_id` = perfil em `freelancer_profiles` (lookup por CPF)
- `checkin_date` = `schedule_date`
- `status = 'pending_schedule'`
- `valor_informado` = `agreed_rate`

Quando a escala é cancelada, o stub `pending_schedule` é deletado.

#### 3. App `/checkin` passa a vincular `schedule_id`
- `useFreelancerCheckins.findPendingScheduleCheckin` já busca pelo CPF/data.
- Ajustar `createCheckin` para aceitar `schedule_id` opcional.
- Em `FreelancerCheckin.tsx`, quando o lookup encontra um stub `pending_schedule`, o fluxo já atualiza esse registro (linhas 282-295). **Sem alteração de código aqui — só a criação do stub no passo 2 ativa esse caminho.**
- Quando NÃO há stub (freelancer "avulso", não agendado), o checkin novo entra sem `schedule_id` igual hoje.

#### 4. Reforçar matching no dashboard de presença
`CheckinManagerDashboard` já tenta `schedule_id` primeiro, depois nome. Adicionar fallback intermediário por **CPF normalizado** entre `freelancer_profiles.cpf` e `employees.cpf`, eliminando 100% dos casos de "Aguardando" indevido.

### Resultado prático após implementação

Para usar a aba Presença de forma 100% funcional **hoje**:

1. **Gerente agenda freelancers** no Editor de Escalas (com CPF) → aparece como **"Previsto"** no Budget e como card **"Aguardando"** na aba Presença do dia.
2. **Freelancer chega e faz check-in** em `/checkin?unidade=...` → o card vira **"Check-in realizado"** com selfie, GPS e valor.
3. **Gerente abre Presença** → vê todos os agendados + os checkins reais lado a lado, aprova presença, confirma valor.
4. **Aprovação em lote com senha** → roda `promote_approved_checkins` → entries provisórias `origem='escala'` somem do Budget e entram como **"Via Check-in"** definitivos.
5. **Gerar Ordem de Pagamento** em PDF a partir do Budget Gerencial.

Para freelancer **não agendado** (chegou de surpresa): faz check-in normal, aparece direto na aba Presença sem o card "Aguardando" prévio. Fluxo de aprovação idêntico.

### Mudanças técnicas resumidas

| Arquivo / objeto | Mudança |
|---|---|
| Migração SQL | Recriar trigger `trg_sync_schedule_to_freelancer_entry` |
| Migração SQL | Nova função `create_pending_schedule_checkin()` + trigger em `schedules` |
| `useFreelancerCheckins.ts` | `createCheckin` aceita `schedule_id?` opcional |
| `CheckinManagerDashboard.tsx` | Matching adicional por CPF normalizado |

### O que **não** entra agora

- Mudanças visuais na aba Presença
- Mudanças no fluxo `/checkin` real (UX intacto)
- Mudanças no `/checkin-demo`
- Mudanças no Editor de Escalas
- Mudanças no PDF de Ordem de Pagamento

### Validação

1. Agendar 1 freelancer (com CPF) na escala de hoje → conferir no Budget que aparece "Previsto" e na Presença que aparece "Aguardando".
2. Fazer check-in real desse CPF → card vira "Check-in realizado", aparece também o `CheckinApprovalCard` para aprovar.
3. Aprovar presença + valor + assinatura em lote → conferir que sumiu o "Previsto" e entrou "Via Check-in" no Budget.
4. Cancelar uma escala futura → conferir que o stub `pending_schedule` foi removido.
5. Freelancer sem agendamento prévio faz check-in → aparece só como `CheckinApprovalCard`, sem card "Aguardando".

