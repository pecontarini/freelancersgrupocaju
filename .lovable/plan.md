

# Plano: Novo formato de planilha de escala (3 colunas por dia + cargo)

## Contexto

As planilhas que a operação já usa seguem este formato:

```text
| NOME       | CARGO        | SEGUNDA       |         |       | TERÇA         |         |       | ...
|            |              | ENTRADA       | INTERV. | SAÍDA | ENTRADA       | INTERV. | SAÍDA | ...
| Fulano     | Barman       | 12:00         | 3h      | 0:00  | FOLGA         |         |       | ...
```

O sistema atual gera um modelo diferente (1 coluna por dia, formato "HH:MM - HH:MM", aba `__meta__` obrigatória). Isso força a operação a usar dois formatos distintos.

## Objetivo

Fazer o sistema gerar e importar no formato real da operação, eliminando a necessidade de retrabalho.

## Mudanças

### 1. Reescrever `generateScheduleTemplate()` em `src/lib/scheduleExcel.ts`

**Novo formato do template gerado:**
- Aba "Instruções": instruções de preenchimento (já existe, atualizar texto)
- Aba "ESCALA": tabela com estrutura:
  - Linha 1: `{SETOR} — {UNIDADE} — SEMANA {dd/MM} a {dd/MM}`
  - Linha 2: `NOME | CARGO | SEGUNDA | (vazio) | (vazio) | TERÇA | ...`
  - Linha 3: `(vazio) | (vazio) | ENTRADA | INTERV. | SAÍDA | ENTRADA | INTERV. | SAÍDA | ...`
  - Linhas de dados: nome do funcionário + cargo pré-preenchidos, células de horário vazias
- Aba `__meta__` (oculta): mantida para vincular employee_id ao nome (compatibilidade com importação)
- 3 colunas por dia (ENTRADA, INTERV., SAÍDA) em vez de 1

### 2. Reescrever `parseScheduleFile()` em `src/lib/scheduleExcel.ts`

**Dois modos de parsing:**
- **Modo legacy**: se detectar aba `__meta__` + marcador `__CAJU_SCHEDULE_META__`, usar parser atual
- **Modo novo (padrão)**: se detectar cabeçalho com ENTRADA/INTERV./SAÍDA:
  - Ler linha de título para extrair setor + unidade + semana
  - Mapear dias por posição (cada dia = 3 colunas)
  - Para cada funcionário: ler NOME, CARGO, e para cada dia ler ENTRADA/INTERV./SAÍDA
  - Aceitar: FOLGA, FÉRIAS, FDS MÊS, BANCO DE HORAS como tipos de folga
  - Usar ENTRADA e SAÍDA como horários, INTERV. como duração do intervalo
  - Vincular funcionário por nome (fuzzy match contra employees do banco) quando não houver `__meta__`

### 3. Ajustar `ScheduleExcelFlow.tsx`

- Adicionar parâmetros `unitName` nas props para o template
- Quando não houver `__meta__`, mostrar uma etapa extra de reconciliação de nomes (semelhante ao que já existe no StaffingMatrixImporter)
- Aceitar arquivos no novo formato sem rejeitar

### 4. Aceitar formato externo (sem `__meta__`)

Para quando a planilha foi criada fora do sistema (formato idêntico mas sem aba `__meta__`):
- Buscar employees do banco pela unidade selecionada
- Fazer match por nome normalizado
- Mostrar avisos para nomes não encontrados

## Arquivos impactados

| Arquivo | Ação |
|---------|------|
| `src/lib/scheduleExcel.ts` | Reescrever template e parser |
| `src/components/escalas/ScheduleExcelFlow.tsx` | Aceitar novo formato, adicionar unitName prop |
| `src/components/escalas/ManualScheduleGrid.tsx` | Passar unitName para ScheduleExcelFlow |

## Resultado

- O modelo baixado será visualmente idêntico às planilhas que a operação já usa
- O sistema aceita tanto planilhas geradas por ele quanto planilhas externas no mesmo formato
- Compatibilidade com formato antigo mantida

