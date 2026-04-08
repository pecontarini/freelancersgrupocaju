

# Plano: Exibir funcionários escalados mesmo com cargo divergente

## Problema

O filtro do grid de escalas (`ManualScheduleGrid`) filtra funcionários pelo `job_title_id` vinculado ao setor ativo. Se a Letícia tem cargo "cross barman" mas foi escalada no setor que aceita "auxiliar de bar", ela não aparece na lista visual — mas como o POP conta direto dos `schedules`, o contador funciona normalmente.

## Solução

Alterar o filtro `filteredEmployees` para incluir também funcionários que **já possuem escala ativa na semana** para o setor selecionado, independente do cargo. Isso garante que qualquer funcionário já escalado sempre aparece no grid.

## Mudança

### `ManualScheduleGrid.tsx` — Filtro de funcionários (linhas 152-158)

Adicionar ao filtro: se o funcionário tem pelo menos um schedule no `activeSectorId` durante a semana atual, incluí-lo na lista mesmo que seu `job_title_id` não bata com os cargos do setor.

```
// Lógica atual:
active.filter(emp => emp.job_title_id && sectorLinkedJobTitleIds.has(emp.job_title_id))

// Nova lógica:
active.filter(emp => {
  // Cargo vinculado ao setor
  if (emp.job_title_id && sectorLinkedJobTitleIds.has(emp.job_title_id)) return true;
  // Já tem escala no setor esta semana
  return schedules.some(s => s.employee_id === emp.id && s.sector_id === activeSectorId);
})
```

## Arquivo impactado

| Arquivo | Ação |
|---------|------|
| `src/components/escalas/ManualScheduleGrid.tsx` | Ajustar filtro para incluir funcionários já escalados |

