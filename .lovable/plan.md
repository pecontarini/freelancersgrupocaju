## Plano: Grade de Escalas estilo Excel

### Decisões confirmadas (defaults assumidos)

1. **Atalhos 1/2/3 → defaults de horário**: consultar `shifts` por `type` (T1/T2/T3) na unidade ativa; se não houver, usar fallback fixo: T1 = 11:00–15:20, T2 = 18:00–23:00, T3 = 11:00–23:00 (1h pausa). Sem abrir modal.
2. **Atalho `m` (Meia)**: criado em código como `shift_type = 'meia'` mapeando `schedule_type = 'working'`, jornada de 4h (11:00–15:00, sem pausa). Não altera schema.
3. **Paste cross-row/cross-unit**: o `sector_id` da célula colada é **sempre resolvido pela linha de destino** (cargo/setor do funcionário daquela row). Demais campos (`shift_type`, `start_time`, `end_time`, `break_duration`, `agreed_rate`, `praca_id`) vêm da origem.

---

### Arquitetura — onde vive cada coisa

Todo o trabalho fica dentro de `src/components/escalas/ManualScheduleGrid.tsx` + um pequeno hook auxiliar. **Nenhum componente de célula novo, nenhum schema alterado, nenhuma lib externa.**

Novos arquivos:
- `src/components/escalas/grid/useGridSelection.ts` — estado puro de seleção/clipboard/undo (React `useReducer`).
- `src/components/escalas/grid/gridShortcuts.ts` — mapa de atalhos → patches de schedule (defaults T1/T2/T3/m/f).

Modificações:
- `src/components/escalas/ManualScheduleGrid.tsx` — integra o hook, adiciona `tabIndex`, `onKeyDown`, classes de seleção, e overlay de "modo edição".

---

### Os 7 itens, em sequência

#### 1. Foco e célula ativa
- Container raiz do grid recebe `tabIndex={0}` + `ref` para foco programático.
- Cada célula `<td>` recebe `data-row={empIdx}` e `data-col={dayIdx}`; ao clicar, `setActiveCell({ row, col })`.
- Visual: célula ativa ganha ring `ring-2 ring-primary` (sem mudar cor de turno).

#### 2. Navegação por teclado
- `ArrowUp/Down/Left/Right`: move `activeCell` (clamp nos limites).
- `Tab` / `Shift+Tab`: avança/retrocede coluna; ao passar do último dia, vai para a próxima linha.
- `Enter`: abre o `ScheduleEditModal` da célula ativa (comportamento existente).
- `Esc`: limpa seleção/range.

#### 3. Seleção por range
- `Shift+Click` ou `Shift+Arrows`: define `selection.anchor` + `selection.head` formando retângulo.
- `Ctrl/Cmd+A`: seleciona linha do funcionário ativo; segundo `Ctrl+A` seleciona toda a grade.
- Classes: células dentro do retângulo recebem `bg-primary/10` (overlay, mantém a cor do turno).

#### 4. Atalhos de turno (apply rápido sem modal)
Sobre a célula ativa (ou todo o range selecionado), as teclas aplicam patches via `useUpsertSchedule`:

| Tecla | Patch resultante |
|---|---|
| `1` | `schedule_type='working'`, `shift_type='T1'`, horários T1 |
| `2` | `schedule_type='working'`, `shift_type='T2'`, horários T2 |
| `3` | `schedule_type='working'`, `shift_type='T3'`, horários T3 |
| `m` | `schedule_type='working'`, `shift_type='meia'`, 11:00–15:00 |
| `f` | `schedule_type='off'` (folga), limpa horários |
| `Delete`/`Backspace` | `useCancelSchedule` na(s) célula(s) |

Resolução de horário T1/T2/T3: query única `shifts WHERE unit_id = X AND type IN ('T1','T2','T3')` em cache (React Query, `staleTime: 5min`). Se faltar, usa fallback.

`sector_id` para cada célula é resolvido pela função existente `resolveSectorForEmployee` (já usada no modal).

#### 5. Copiar / Colar / Recortar
- `Ctrl/Cmd+C`: serializa o range selecionado num objeto `{ rows: number, cols: number, cells: Patch[][] }` em `clipboard` (state local — sem API do SO).
- `Ctrl/Cmd+X`: copia + cancela as células de origem.
- `Ctrl/Cmd+V`: a partir da `activeCell` como canto superior-esquerdo, repete o bloco. Para cada célula colada:
  - Mantém: `shift_type`, `start_time`, `end_time`, `break_duration`, `agreed_rate`, `praca_id`.
  - Recalcula: `sector_id` via `resolveSectorForEmployee(targetEmployee)`.
  - Recalcula: `employee_id` e `schedule_date` pelo destino.
- Se o destino estende além do grid, clipa silenciosamente.
- Toast curto: "12 turnos colados".

#### 6. Undo / Redo
- Stack em memória (`history: Action[]`, `cursor: number`) dentro do reducer.
- Cada operação (apply atalho, paste, cut, delete) empurra um `Action` com `before/after` por célula afetada.
- `Ctrl/Cmd+Z`: aplica `before` em batch via `useUpsertSchedule`/`useCancelSchedule`.
- `Ctrl/Cmd+Shift+Z` ou `Ctrl+Y`: re-aplica `after`.
- Limite: 50 ações. Limpa ao trocar de semana ou unidade.

#### 7. Navegação entre semanas
- `Ctrl/Cmd+ArrowLeft` / `Ctrl/Cmd+ArrowRight`: chama os handlers já existentes de "semana anterior / próxima semana" no `ManualScheduleGrid`.
- `Ctrl/Cmd+Home`: volta à semana atual (hoje).
- Foco da célula ativa é preservado por `(row, col)` na nova semana.

---

### Tratamento de borda

- **Modo edição inativo**: se foco está num `<input>` ou modal aberto, todos os atalhos são ignorados (`e.target` check).
- **Funcionário sem cargo/setor**: atalho exibe toast "Funcionário sem setor — abra o modal" e cancela a operação para aquela célula (não bloqueia o restante do range).
- **Conflitos de unique constraint** (já existente em `schedules`): erro do upsert exibe toast e o `Action` correspondente é revertido do histórico.
- **Mobile**: tudo é progressivo — em telas <768px o `MobileScheduler` continua o caminho principal e nada muda lá.

---

### Detalhes técnicos (resumo)

**Estado do hook `useGridSelection`:**
```ts
type Cell = { row: number; col: number };
type Patch = Partial<ManualSchedule>;
type Action = { affected: Cell[]; before: (ManualSchedule|null)[]; after: (Patch|null)[] };

interface State {
  active: Cell | null;
  selection: { anchor: Cell; head: Cell } | null;
  clipboard: { rows: number; cols: number; cells: (Patch|null)[][] } | null;
  history: Action[];
  cursor: number; // -1 = nada para desfazer
}
```

**Integração na grade**: o `ManualScheduleGrid` já mapeia `employees x days`. Adicionar:
- `useGridSelection(employees.length, days.length)` no topo.
- `onKeyDown` no container raiz fazendo dispatch para o reducer + chamadas `upsert.mutateAsync` em batch.
- `data-*` attributes em cada `<td>` para permitir `Shift+Click` sem prop drilling.

**Defaults de turno** (`gridShortcuts.ts`):
```ts
export const SHIFT_FALLBACKS = {
  T1: { start_time: '11:00', end_time: '15:20', break_duration: 0 },
  T2: { start_time: '18:00', end_time: '23:00', break_duration: 0 },
  T3: { start_time: '11:00', end_time: '23:00', break_duration: 60 },
  meia: { start_time: '11:00', end_time: '15:00', break_duration: 0 },
};
export function resolveShiftDefaults(type, shiftsFromDb) { /* db first, fallback second */ }
```

---

### O que NÃO será feito (escopo travado)

- Não recria células nem componentes visuais.
- Não altera schema, RLS, ou cria novas tabelas.
- Não muda cores de turno, layout ou tipografia.
- Não adiciona libs externas.
- Não toca em `MobileScheduler` nem em outras abas.

---

### Entrega

Ao fim, ficará disponível na grade existente:
- Edição estilo planilha com teclado.
- Aplicação de turnos em massa via 1/2/3/m/f.
- Copy/paste/cut com geometria preservada.
- Undo/Redo (50 níveis).
- Navegação Ctrl+← / Ctrl+→ entre semanas.

Arquivos finais modificados:
- `src/components/escalas/ManualScheduleGrid.tsx` (integração)
- `src/components/escalas/grid/useGridSelection.ts` (novo)
- `src/components/escalas/grid/gridShortcuts.ts` (novo)
