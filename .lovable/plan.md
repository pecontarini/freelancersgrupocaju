

## Plano de correção 100% — Importação e Exportação de Escalas

### Diagnóstico

**Bug 1 — Importação `duplicate key value violates unique_active_schedule` (causa raiz real)**

O índice de proteção em `schedules` é **parcial**:
```
CREATE UNIQUE INDEX unique_active_schedule
ON schedules (employee_id, schedule_date, sector_id)
WHERE status <> 'cancelled'
```
O código usa `supabase.upsert(rows, { onConflict: "employee_id,schedule_date,sector_id", ignoreDuplicates: true })`. **PostgREST não envia o predicado `WHERE`** ao Postgres, então o `ON CONFLICT` **não consegue casar com índice parcial** e o erro 23505 vaza para o cliente — anulando todo o `ignoreDuplicates`. Por isso, mesmo com toda a dedup feita no front, qualquer linha que colida com algo já existente no banco quebra o batch inteiro.

Confirmei no banco que a semana 20–26/04 da unidade Nazo GO já tem dezenas de escalas ativas (ALEJANDRO, ANA, BRUNA, CLARA, etc.), e o usuário está reimportando uma planilha por cima. O fix anterior limpou homônimos, mas o `ignoreDuplicates` continua quebrado.

**Bug 2 — Mensagens de erro pouco acionáveis**

Quando o usuário vê "duplicate key", não tem onde clicar para resolver — não sabe quais linhas conflitaram nem como zerar a semana antes de reimportar.

**Bug 3 — Export Excel "Geral" pode falhar silenciosamente**

`scheduleMasterExport.ts` usa `import XLSX from "xlsx-js-style"` (default import). Em alguns bundlings ESM, esse pacote precisa de `import * as XLSX from "xlsx-js-style"` (como já fazemos em `scheduleExcel.ts`). Se a build atual estiver retornando `undefined` para `XLSX.utils`, o usuário vê erro genérico "Erro ao exportar escala". Mesmo padrão precisa ser aplicado em `scheduleMasterPdf.ts` se aplicável. Como o pacote está versionado (`^1.2.0`) e já existem relatos do problema, o fix preventivo é trivial.

---

### Correções

#### 1) Importação: trocar estratégia de `upsert` por **dedup completa via SELECT prévio + INSERT puro**

Em `src/components/escalas/ScheduleExcelFlow.tsx → handleConfirmImport`:

- **Manter** a dedup intra-batch atual (1, 1b — já feita).
- **Reforçar a dedup contra DB**: a query `existingSchedules` já busca por `(employee_id IN ..., date BETWEEN ...)` mas filtra `existingKeys` por `employee|date|sector`. Mudar para filtrar por **2 chaves**:
  - `employee|date|sector` (mesma que existe);
  - `employee|date` (independente de setor) — uma pessoa não está em 2 setores no mesmo dia operacionalmente, e o front já colapsa isso.
- **Trocar `upsert(ignoreDuplicates)` por `insert()` puro** já que a dedup no front é total.
- Em caso de erro 23505 mesmo assim (race condition rara), **fazer fallback automático**: refazer o SELECT, recalcular `newRows` e tentar 1 vez mais. Se ainda falhar, mostrar mensagem cirúrgica (vide item 2).

#### 2) Mensagens de erro acionáveis no toast

- Quando o erro for `23505/unique_active_schedule`, parsear `error.details` para extrair `(employee_id, date, sector_id)`, mapear para nome+data legíveis e listar **até 5 conflitos** no toast.
- Adicionar botão **"Zerar semana e reimportar"** no toast de erro (chama o mesmo fluxo do "Zerar Escalas" filtrado para a semana importada, mantém a planilha em memória e reexecuta o `handleConfirmImport`).
- Adicionar contador no sucesso: `"X importados, Y já existiam (ignorados), Z conflitos resolvidos"`.

#### 3) Export Excel: padronizar import do `xlsx-js-style`

- Em `src/lib/scheduleMasterExport.ts`: trocar `import XLSX from "xlsx-js-style"` → `import * as XLSX from "xlsx-js-style"` (mesmo padrão de `scheduleExcel.ts`).
- Verificar `src/lib/scheduleMasterPdf.ts` e qualquer outro consumidor de `xlsx-js-style` para o mesmo ajuste.
- Em `MasterExportButton.tsx`, capturar `console.error(err)` antes do toast genérico para dar visibilidade no DevTools quando o usuário relatar.

#### 4) (Opcional, defesa em profundidade) Trocar índice parcial por constraint completo

Migration: criar `unique_schedule_active_full` igual ao parcial, mas **sem o `WHERE`** — ou seja, incluindo `status` na chave: `(employee_id, schedule_date, sector_id, status)` quando `status<>'cancelled'`. Isso mantém o comportamento atual mas dá ao PostgREST um índice **não parcial** que ele consegue usar em `onConflict`. Vou avaliar se adiciona valor — se a correção 1+2 já resolverem 100%, **pulamos** essa migration para não mexer em índices em produção.

### Arquivos afetados

- **`src/components/escalas/ScheduleExcelFlow.tsx`** — remover `upsert/ignoreDuplicates`, usar `insert()` com fallback de retry; dedup adicional por `(employee|date)` contra DB; toast com lista de conflitos e botão "Zerar e Reimportar".
- **`src/lib/scheduleMasterExport.ts`** — ajustar import de `xlsx-js-style` para `* as XLSX`.
- **`src/lib/scheduleMasterPdf.ts`** — verificar/ajustar import similar se aplicável.
- **`src/components/escalas/MasterExportButton.tsx`** — adicionar `console.error` antes do toast genérico.

### Validação

- **Importação**:
  - Reimportar a planilha 20–26/04 da Nazo GO sobre escalas existentes → deve completar mostrando "X importados, Y já existiam (ignorados)", **zero erro 23505**.
  - Importar planilha completamente nova → todas as linhas entram, mensagem de sucesso normal.
  - Forçar conflito (criar manualmente schedule, depois importar planilha que o inclui) → toast claro "Conflito: João em 22/04 (BAR)", botão "Zerar semana e reimportar" funciona.
- **Export Excel**:
  - Clicar "Exportar Escala → Excel" em qualquer unidade → arquivo .xlsx baixa e abre no Excel/LibreOffice sem corrupção, com todas as abas de setores.
  - Clicar "Exportar Escala → PDF" → PDF baixa normalmente.

### Sem mudanças visuais

UI permanece igual; mudam apenas a robustez do INSERT, as mensagens de toast e a confiabilidade do download.

