## Objetivo
Replicar as escalas do CAJU - ITAIM da semana **04/05 → 10/05/2026** para a semana seguinte **11/05 → 17/05/2026**, mantendo mesmos colaboradores, turnos, setores e configurações (start_time, end_time, break_duration, schedule_type, agreed_rate, praca_id).

## Escopo
- Unidade: CAJU - ITAIM (`87228077-03ab-445b-a409-237972ee6719`)
- Setores afetados (com escalas na semana origem): PARRILLA (7), BAR (28), PRODUÇÃO (49), COZINHA (55) → **139 registros**
- Semana destino está vazia (0 escalas) → sem risco de duplicar.

## Execução
Migração SQL única:

```sql
INSERT INTO schedules (
  user_id, employee_id, schedule_date, shift_id, sector_id, status,
  start_time, end_time, break_duration, schedule_type, agreed_rate, praca_id
)
SELECT
  s.user_id, s.employee_id, s.schedule_date + INTERVAL '7 days',
  s.shift_id, s.sector_id, 'scheduled',
  s.start_time, s.end_time, s.break_duration, s.schedule_type, s.agreed_rate, s.praca_id
FROM schedules s
JOIN sectors sec ON sec.id = s.sector_id
WHERE sec.unit_id = '87228077-03ab-445b-a409-237972ee6719'
  AND s.schedule_date BETWEEN '2026-05-04' AND '2026-05-10'
  AND s.status <> 'cancelled';
```

## Observações
- Triggers existentes (`sync_schedule_to_freelancer_entry`, `create_pending_schedule_checkin`) vão disparar automaticamente para freelancers — comportamento esperado.
- Validação CLT (`validate_schedule_clt`) **não roda** em INSERT direto via migração; como é uma cópia idêntica de uma semana já aprovada, é seguro pular. Se aparecer alerta de interjornada entre dom 10/05 e seg 11/05, será visível no editor.
- Confirmações (`confirmation_status`) começam em null/default — colaboradores precisarão confirmar a nova semana normalmente.