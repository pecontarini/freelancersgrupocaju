

# Plano: Diária fixa R$120 + Integração Escala → Presença de Freelancer

## Resumo

Duas mudanças: (1) pré-fixar o valor da diária em R$120,00 ao lançar extras, e (2) ao salvar um freelancer na escala, criar automaticamente um registro pendente no sistema de presença (checkin), amarrando ponta a ponta.

## Problema atual

- O valor padrão da diária está em R$200 — precisa ser R$120
- Ao escalar um freelancer, o gestor precisa esperar que ele faça o check-in manualmente via QR Code. Não há registro pendente automático no painel de presença
- A ponte entre `employees` (escalas) e `freelancer_profiles` (checkins) é feita por normalização de nome — frágil e sem vínculo direto

## Solução

### 1. Pré-fixar valor da diária em R$120,00

**Arquivos**: `FreelancerAddModal.tsx`, `ScheduleEditModal.tsx`

- Alterar o estado inicial de `rate` de `"200"` para `"120"`
- Alterar o valor default de `agreedRate` no ScheduleEditModal para `"120"` quando for freelancer sem valor existente

### 2. Adicionar coluna `schedule_id` na tabela `freelancer_checkins`

**Migração SQL**

- Adicionar coluna opcional `schedule_id uuid REFERENCES schedules(id)` à tabela `freelancer_checkins`
- Isso permite vincular diretamente um checkin a uma escala específica

### 3. Auto-criar registro de presença pendente ao escalar freelancer

**Arquivo**: `src/hooks/useManualSchedules.ts` (dentro do `useUpsertSchedule`)

Após gravar a escala com sucesso para um freelancer:

1. Buscar o `employee` para pegar o CPF
2. Com o CPF, buscar o `freelancer_profile` correspondente
3. Se encontrar o perfil, criar automaticamente um registro em `freelancer_checkins` com:
   - `freelancer_id` = id do perfil encontrado
   - `loja_id` = unit_id da escala
   - `checkin_date` = data da escala
   - `status` = "pending_schedule" (novo status para distinguir de check-ins manuais)
   - `checkin_selfie_url` = placeholder (ex: foto do perfil existente)
   - `valor_informado` = agreed_rate (R$120)
   - `schedule_id` = id da escala recém-criada
4. Se NÃO encontrar perfil por CPF, não criar (o freelancer fará o cadastro via QR Code)

### 4. Melhorar a ponte no Dashboard de Presença

**Arquivo**: `src/components/checkin/CheckinManagerDashboard.tsx`

- Usar `schedule_id` para vincular checkins a escalas em vez de normalização de nome
- Manter fallback por nome para registros antigos sem `schedule_id`

### 5. Ajustar o fluxo de check-in do freelancer (QR Code)

**Arquivo**: `src/pages/FreelancerCheckin.tsx`

- Ao fazer check-in, verificar se já existe um registro pendente (criado pela escala) para aquele CPF/loja/data
- Se existir, atualizar esse registro (adicionar selfie, horário real) em vez de criar um novo
- Isso evita duplicidade e mantém o vínculo com a escala

## Arquivos impactados

| Arquivo | Ação |
|---------|------|
| `src/components/escalas/FreelancerAddModal.tsx` | Mudar valor default de R$200 → R$120 |
| `src/components/escalas/ScheduleEditModal.tsx` | Mudar valor default para R$120 em freelancers |
| Migração SQL | Adicionar `schedule_id` em `freelancer_checkins` |
| `src/hooks/useManualSchedules.ts` | Auto-criar checkin pendente ao escalar freelancer |
| `src/components/checkin/CheckinManagerDashboard.tsx` | Vincular por `schedule_id` |
| `src/pages/FreelancerCheckin.tsx` | Reutilizar registro pendente da escala |

## Resultado

- Valor da diária sempre começa em R$120
- Ao lançar um extra na escala, ele já aparece como "Pendente" no painel de presença
- O freelancer, ao fazer check-in via QR Code, atualiza o registro existente (com selfie e horário real)
- O gestor vê tudo amarrado: escala → presença → aprovação → pagamento

