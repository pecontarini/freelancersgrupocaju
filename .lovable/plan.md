
## Plano: Corrigir Horarios na Confirmacao D-1 + Confirmacao de Freelancers

### Problema 1: Horarios errados na pagina de confirmacao

**Causa raiz identificada:** A edge function `confirm-shift` e a pagina `ConfirmShift.tsx` buscam APENAS os horarios do turno padrao (`shifts.start_time/end_time`, ex: 08:00-16:00), ignorando os horarios individuais registrados na escala (`schedules.start_time/end_time`, ex: 12:00-00:00).

Dados reais confirmam o problema:
- Funcionario com escala 12:00-00:00, mas o turno padrao e 08:00-16:00
- Na pagina de confirmacao, aparece "08:00 as 16:00" em vez de "12:00 as 00:00"

### Problema 2: Freelancers sem confirmacao

Freelancers ja aparecem no painel D-1 e ja recebem o link de WhatsApp, mas a confirmacao funciona normalmente para eles. O pedido e garantir que o fluxo completo funcione tambem para freelancers (confirmacao registrada e visivel).

---

### Arquivos a editar

**1. `supabase/functions/confirm-shift/index.ts`**
- Adicionar `start_time, end_time` na query SELECT da tabela `schedules` (linha 31)
- Retornar esses campos junto com os dados do schedule para que a pagina use os horarios corretos

**2. `src/pages/ConfirmShift.tsx`**
- Alterar `parseSchedule()` (linhas 43-56) para usar os horarios individuais da escala com fallback para os do turno:
  ```text
  shift_start: data.start_time || shifts.start_time  (em vez de so shifts.start_time)
  shift_end:   data.end_time   || shifts.end_time     (em vez de so shifts.end_time)
  ```

**3. `src/components/escalas/D1SectorAccordion.tsx`**
- No `SectorWhatsAppButton` (linhas 192-196), incluir o horario de cada funcionario na mensagem do WhatsApp "Cobrar Setor", para que o lider veja os horarios corretos de cada pessoa

Nenhuma alteracao de banco de dados necessaria. Os horarios individuais ja estao salvos corretamente na tabela `schedules`.

---

### Detalhes tecnicos

**Edge Function - query atualizada:**
```text
SELECT:
  id, schedule_date, status, confirmation_status, confirmation_responded_at,
  employee_id, start_time, end_time,  <-- ADICIONAR estes 2 campos
  employees!schedules_employee_id_fkey ( name ),
  shifts!schedules_shift_id_fkey ( name, start_time, end_time ),
  sectors!schedules_sector_id_fkey ( name )
```

**ConfirmShift.tsx - parseSchedule corrigido:**
```text
shift_start: data.start_time?.substring(0,5) || shifts.start_time?.substring(0,5)
shift_end:   data.end_time?.substring(0,5)   || shifts.end_time?.substring(0,5)
```

**D1SectorAccordion.tsx - mensagem "Cobrar Setor" com horarios:**
```text
Para cada funcionario pendente:
  "👤 *Nome* (HH:MM-HH:MM)"
  "🔗 link_confirmacao"
```

### Resumo das mudancas
- 3 arquivos editados, nenhum arquivo novo
- Nenhuma migracao de banco
- A edge function precisa ser redeployada (automatico)
- Freelancers ja funcionam no fluxo atual, a correcao dos horarios beneficia todos (CLT e freelancers igualmente)
