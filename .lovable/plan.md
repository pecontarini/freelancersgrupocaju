

# Plano: Corrigir Importação em Massa de Escalas para Todos os Setores e Unidades

## Diagnóstico

Identifiquei 3 problemas concretos no código:

### Problema 1: Botões de Download/Importação não aparecem
Em `ManualScheduleGrid.tsx` linha 324, os botões de Excel só renderizam quando `sortedScheduled.length > 0` — ou seja, somente se já houver funcionários escalados naquele setor na semana. Em setores ou unidades sem escala prévia, os botões simplesmente não existem.

### Problema 2: Template gera apenas com funcionários já escalados
O template Excel é gerado com `sortedScheduled` (pessoas já lançadas) em vez dos funcionários do **quadro base do setor** (`sectorBaseEmployees`). Isso significa que o modelo baixado para um setor novo vem vazio.

### Problema 3: Importação só salva no setor ativo
Na função `handleConfirmImport` (`ScheduleExcelFlow.tsx` linhas 286-303), o `resolvedSectorId` tenta usar `sector_job_titles` para mapear o cargo ao setor correto, mas se o cargo não estiver vinculado, tudo cai no `sectorId` ativo. Não há suporte real para importar para múltiplos setores de uma vez.

## Solução

### 1. Mostrar botões sempre que houver setor ativo

**Arquivo:** `ManualScheduleGrid.tsx`

Mudar a condição de renderização do `ScheduleExcelFlow` de:
```
activeSectorId && sortedScheduled.length > 0
```
Para:
```
activeSectorId
```

### 2. Usar funcionários do quadro base no template

**Arquivo:** `ManualScheduleGrid.tsx`

Mudar a prop `employees` do `ScheduleExcelFlow` para usar **todos os funcionários vinculados ao setor** (base + escalados), em vez de apenas os escalados:

```text
Antes: employees={sortedScheduled.map(...)}
Depois: employees={sectorEmployeesForTemplate} 
        (= funcionários com job_title vinculado ao setor via sector_job_titles)
```

Isso garante que ao clicar "Baixar Modelo", o Excel vem com todos os CLTs do setor, mesmo que nenhum esteja escalado ainda.

### 3. Melhorar resolução de setor na importação

**Arquivo:** `ScheduleExcelFlow.tsx`

Aprimorar a lógica de `handleConfirmImport` para que, quando o cargo do funcionário está vinculado a um setor específico da unidade (via `sector_job_titles`), o lançamento vá para o setor correto em vez de cair sempre no setor ativo como fallback.

### 4. Proteger o download contra lista vazia

**Arquivo:** `ScheduleExcelFlow.tsx`

Remover o bloqueio `if (employees.length === 0)` no `handleDownloadTemplate`. Se não houver funcionários, gerar o modelo com cabeçalhos vazios (o gestor preencherá manualmente e o sistema registrará via fluxo de "funcionários não encontrados").

## Arquivos impactados

| Arquivo | Mudança |
|---------|---------|
| `src/components/escalas/ManualScheduleGrid.tsx` | Mudar condição de renderização + prop employees |
| `src/components/escalas/ScheduleExcelFlow.tsx` | Remover bloqueio de download vazio |

## Resultado esperado

- Botões "Baixar Modelo" e "Importar Planilha" visíveis em todos os setores, mesmo sem escalas prévias
- Template baixado com todos os funcionários do quadro base do setor
- Importação funcional para qualquer setor e unidade
- Download garantido mesmo sem funcionários cadastrados (modelo em branco com cabeçalhos)

