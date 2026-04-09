

# Correção: Funcionário reaparece após exclusão da semana

## Problema

Quando você exclui um funcionário da semana, o sistema usa um estado local (`hiddenEmployeeIds`) para escondê-lo visualmente. Mas ao sair e voltar na tela, esse estado é resetado e o funcionário reaparece — mesmo sem escalas ativas — porque o filtro atual mostra **todos** os funcionários cujo cargo está vinculado ao setor, independentemente de terem escalas na semana.

## Solução

Alterar a lógica de filtragem em `ManualScheduleGrid.tsx` para distinguir CLTs de freelancers:

- **CLT**: Continua aparecendo se o cargo está vinculado ao setor (precisam estar visíveis para receber lançamentos)
- **Freelancer**: Só aparece se **já tiver pelo menos uma escala ativa** (não-cancelada) no setor/semana atual. Freelancers sem escalas não aparecem na grade — eles são adicionados sob demanda pelo botão "VAGA EXTRA"

Isso elimina a dependência do `hiddenEmployeeIds` para freelancers e resolve o bug de "fantasma" que volta ao recarregar.

## Mudança

### `src/components/escalas/ManualScheduleGrid.tsx`

Ajustar o `filteredEmployees` useMemo:

```typescript
return active.filter((emp) => {
  const hasActiveSchedule = schedules.some(
    (s) => s.employee_id === emp.id && s.sector_id === activeSectorId && s.status !== "cancelled"
  );
  
  // Freelancers: só mostrar se tiver escala ativa na semana
  if (emp.worker_type === "freelancer") {
    return hasActiveSchedule;
  }
  
  // CLT: mostrar se cargo vinculado ao setor OU se tiver escala ativa
  if (emp.job_title_id && sectorLinkedJobTitleIds.has(emp.job_title_id)) return true;
  return hasActiveSchedule;
});
```

O `hiddenEmployeeIds` permanece como otimismo visual (evita piscar), mas não é mais necessário para a correção fundamental.

| Arquivo | Ação |
|---------|------|
| `src/components/escalas/ManualScheduleGrid.tsx` | Ajustar filtro de employees |

