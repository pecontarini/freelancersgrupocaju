

# Plano: Alinhar Contagem de Pessoas ao POP de Escalas

## Problema
A contagem de pessoas nos turnos (tanto nos exports Excel/PDF quanto no app) não segue as regras do documento POP anexado. As três divergências principais:

1. **Janelas de pico erradas** — atual: Almoço 12:00–14:30, Jantar 19:30–22:00. POP define: Almoço **12h–15h**, Jantar **19h–22h**
2. **Regra de 2h consecutivas ignorada** — o POP exige que o colaborador trabalhe no mínimo **2h consecutivas** dentro da janela para ser contado naquele turno. Hoje qualquer sobreposição (mesmo 1 minuto) já conta
3. **Exports não separam por turno** — Excel e PDF mostram apenas "Efet / Ext / Total" por dia, sem distinguir Almoço vs Jantar. O POP exige preenchimento separado por turno

## Mudanças

### 1. `src/lib/peakHours.ts` — EDITAR
- Alterar janelas: `LUNCH_PEAK = { start: "12:00", end: "15:00" }` e `DINNER_PEAK = { start: "19:00", end: "22:00" }`
- Nova função `meetsMinimumOverlap(scheduleStart, scheduleEnd, peak, minMinutes = 120)` que calcula a sobreposição real em minutos e retorna `true` apenas se >= 120min
- Atualizar `calculateDailyMetrics` para usar `meetsMinimumOverlap` em vez de `intersectsPeak`
- Manter `intersectsPeak` exportada para compatibilidade, mas adicionar a nova função como padrão

### 2. `src/lib/scheduleMasterExport.ts` — EDITAR (Resumo por turno no Excel)
- Importar `meetsMinimumOverlap`, `LUNCH_PEAK`, `DINNER_PEAK` de `peakHours.ts`
- No bloco "RESUMO DO DIA" (linha ~297), substituir a contagem simples por contagem separada por turno:
  - Linha "Almoço": Efet / Ext / Total (apenas quem cumpre 2h entre 12–15h)
  - Linha "Jantar": Efet / Ext / Total (apenas quem cumpre 2h entre 19–22h)
- No "Resumo Geral", também separar por turno

### 3. `src/lib/scheduleMasterPdf.ts` — EDITAR (Resumo por turno no PDF)
- Mesma lógica: substituir a linha única "Efet / Ext / Total" por duas linhas "Almoço" e "Jantar" com contagem baseada na regra de 2h

### 4. `src/hooks/usePopCompliance.ts` — EDITAR
- Atualizar a lógica de contagem de `scheduled` para usar `meetsMinimumOverlap` em vez de contar qualquer `working` — garantindo que o Dashboard POP também siga a regra

### 5. `src/components/escalas/OperationalDashboard.tsx` — EDITAR
- Atualizar `sectorStats` para usar a nova lógica de contagem por turno com a regra de 2h mínimas

## Regra central (do POP)
```text
Considerar como presente somente quem trabalhar no mínimo:
  • 2h consecutivas entre 12h e 15h → conta para ALMOÇO
  • 2h consecutivas entre 19h e 22h → conta para JANTAR
```

## Arquivos

| Tipo | Arquivo |
|------|---------|
| Editar | `src/lib/peakHours.ts` — janelas + regra 2h |
| Editar | `src/lib/scheduleMasterExport.ts` — resumo por turno |
| Editar | `src/lib/scheduleMasterPdf.ts` — resumo por turno |
| Editar | `src/hooks/usePopCompliance.ts` — compliance com 2h |
| Editar | `src/components/escalas/OperationalDashboard.tsx` — contagem com 2h |

