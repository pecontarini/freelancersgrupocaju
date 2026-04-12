

# Plano: Template Excel por Setor com Funcionários Vinculados

## Problema
Atualmente o "Baixar Modelo" gera uma planilha única com todos os funcionários do setor ativo. O usuário quer um Excel com **uma aba por setor**, onde cada aba lista apenas os funcionários cujos cargos estão vinculados àquele setor (via `sector_job_titles`). O import também precisa detectar múltiplas abas e vincular ao setor correto.

## Mudanças

### 1. `src/lib/scheduleExcel.ts` — nova função `generateMultiSectorTemplate`
- Recebe `sectors: { id, name }[]`, `allEmployees`, `sectorJobTitles` e `weekDays`
- Para cada setor, filtra funcionários cujo `job_title_id` está vinculado ao setor
- Gera uma aba por setor com o nome do setor (ex: "COZINHA", "BAR")
- CLTs primeiro, depois linhas vazias para extras/freelancers
- Aba `__meta__` atualizada: inclui mapeamento setor→aba + employees
- Aba "Instruções" mantida
- A função `generateScheduleTemplate` atual (setor único) permanece para retrocompatibilidade

### 2. `src/lib/scheduleExcel.ts` — atualizar parser para multi-aba
- `parseScheduleFile`: detectar se o Excel tem múltiplas abas com nomes de setores
- Para cada aba que corresponda a um setor, parsear e marcar `sector_id` nos entries
- Tipo `ParsedScheduleEntry` ganha campo opcional `sector_id`
- Retrocompatível: se for aba única, comportamento atual mantido

### 3. `src/components/escalas/ScheduleExcelFlow.tsx`
- Botão "Baixar Modelo" vira dropdown com 2 opções: "Só este setor" e "Todos os setores"
- "Só este setor" = comportamento atual
- "Todos os setores" = chama `generateMultiSectorTemplate` passando todos os setores da unidade
- No import, se multi-aba detectada, usa `sector_id` do parse em vez de `sectorId` fixo

### 4. `src/components/escalas/ManualScheduleGrid.tsx`
- Passar `sectors` e `sectorJobTitles` como props ao `ScheduleExcelFlow` para viabilizar o template multi-setor

## Arquivos impactados

| Arquivo | Mudança |
|---------|---------|
| `src/lib/scheduleExcel.ts` | Nova `generateMultiSectorTemplate` + parser multi-aba |
| `src/components/escalas/ScheduleExcelFlow.tsx` | Dropdown de download + import multi-aba |
| `src/components/escalas/ManualScheduleGrid.tsx` | Passar sectors e job title mappings |

## O que NÃO será alterado
- Schema do banco
- Outros módulos
- Formato de aba única continua funcionando (retrocompatível)

