
# Conectar Gerador IA ao Editor de Escalas

## Objetivo
Quando o Gerador IA terminar de gerar uma escala, os horários propostos passam a aparecer **dentro do Editor de Escalas** como linhas de "Vaga Aberta" (uma linha por slot/quantidade), com os horários T1/T2/break já preenchidos em todos os dias da semana. O operador apenas:
1. Marca dias de folga em cada vaga.
2. Vincula a vaga a uma pessoa ativa do quadro.

Ao vincular, a linha "Vaga" some e a escala vira escala normal daquela pessoa, idêntica visualmente a tudo o que já existe hoje no Editor.

## Decisões confirmadas
- **Modelo**: linhas "Vaga aberta" no próprio grid (mesma visualização atual).
- **Persistência**: vagas vivem só em memória/sessão até a vinculação. Nada de novo status no banco.
- **MVP Itaim**: removido por completo (aba e componente `EscalasItaimSection`).

## Fluxo do usuário
1. Em **Gestão de Pessoas → Gerador IA**, usuário seleciona setor + semana + modelo de folga e clica "Gerar".
2. IA retorna o template (já existe). Aparece um botão **"Enviar para o Editor de Escalas"**.
3. Ao clicar, o usuário é levado ao Editor já com:
   - Unidade/setor/semana corretos.
   - Linhas "Vaga aberta" injetadas no topo do grid (uma linha por slot×quantidade).
   - Cada célula dia já mostra o horário sugerido (T1/T2, break, mesmo visual de uma escala normal).
   - Dias sugeridos como folga aparecem com chip "FOLGA".
4. Operador edita folgas se quiser e, em cada vaga, abre um menu "Vincular a…" → escolhe um funcionário ativo.
5. Ao confirmar a vinculação, todos os turnos daquela vaga são salvos via `useUpsertSchedule` para o `employee_id` selecionado, a linha-vaga desaparece, e a escala da pessoa aparece preenchida igual a qualquer outra.

## Arquitetura técnica

### 1. Estado compartilhado (memória)
Criar `src/hooks/useAIDraftSlots.ts` — store global leve (Zustand já presente, ou módulo simples com `useSyncExternalStore`):
```ts
type DraftSlot = {
  id: string;                 // uuid local
  unit_id: string;
  sector_name: string;        // setor do template (string)
  sector_id?: string;         // resolvido na hora de salvar
  week_start: string;         // YYYY-MM-DD
  label: string;              // ex: "Vaga Garçom T1 ★"
  tipo: string;               // "abridor"|"fechador"|...
  responsavel: boolean;
  days: Record<string,         // YYYY-MM-DD
    | { kind: "work"; start_time: string; end_time: string; break_min: number; shift_type: "T1"|"T2"|"meia" }
    | { kind: "off" }
    | { kind: "double"; t1: {...}; t2: {...} }
  >;
};
```
- API: `setDraftSlots(slots)`, `removeDraftSlot(id)`, `useDraftSlotsFor(unitId, weekStart, sectorId|null)`.
- Sem persistência. Ao recarregar a página, descarta.

### 2. Gerador IA → enviar para o Editor
Em `GeradorEscalaIA.tsx`:
- Botão **"Enviar para o Editor"** após `resultado` válido.
- Converter `EscalaResponse.dias[*].slots` em `DraftSlot[]`:
  - Expandir `quantidade` em N vagas separadas.
  - Para cada dia da semana: gerar `work` (com T1/T2/break do slot) ou `off` se o dia está em `dias_folga_sugeridos` ou ausente em `dias`.
  - `label` = `"Vaga {tipo}{responsavel?' ★':''}"`.
- Chamar `setDraftSlots(...)` e navegar para `/?tab=escalas&subtab=scheduler` (rota atual do Editor) com `setor` selecionado via querystring/contexto.

### 3. Editor de Escalas exibindo as vagas
Em `ManualScheduleGrid.tsx`:
- Ler `useDraftSlotsFor(unitId, weekStart, sectorId)`.
- Renderizar as vagas como linhas extras **acima** das linhas de funcionários, usando exatamente o mesmo componente de célula (`ScheduleCell`/equivalente) — passando os horários sintéticos. Visualmente idênticas.
- Coluna nome: badge "VAGA" + label do slot. Botão `Vincular` (Popover com lista de `useEmployees` ativos do setor, filtrável).
- Permitir editar células da vaga: clicar numa célula abre o `ScheduleEditModal` no modo "draft" (onChange grava no store, não no banco).
- Permitir alternar dia para FOLGA na vaga (mesma UI de "off" usada hoje).

### 4. Vinculação → persistência
Função `linkDraftToEmployee(slotId, employeeId)`:
- Para cada `day.work` do slot: `upsertSchedule({ employee_id, schedule_date, sector_id, shift_type, start_time, end_time, break_min, schedule_type: "working" })`.
- Para cada `day.off`: `upsertSchedule({ schedule_type: "off" })` (mesmo helper já usado hoje pelo botão "Folga").
- Após sucesso → `removeDraftSlot(slotId)`. React Query invalida → grid recarrega com a pessoa real preenchida.
- Validação CLT: já roda via `useUpsertSchedule` (o trigger DB `validate_schedule_clt` continua valendo).

### 5. Resolução do `sector_id`
Templates da IA usam `setor` como string (`turno_config.setor`). Antes de injetar no grid, mapear para `sectors.id` da unidade pelo nome. Se não houver match, mostrar toast pedindo para criar/escolher o setor correspondente.

### 6. Remoção do MVP Itaim
- `EscalasTab.tsx`: tirar import, `isItaim`, `TabsTrigger value="ia-mvp"`, `TabsContent` e o `useEffect` de fallback.
- Apagar arquivos: `src/components/escalas/EscalasItaimSection.tsx`, `EscalaVinculacaoBuilder.tsx`, `EscalaApprovalPanel.tsx`, `CooApprovalLinkBox.tsx` se não usados em outro lugar (verificar grep antes de deletar).
- Manter as edge functions `escala-aprovacao-*` e a tabela `escala_template` por enquanto (podem ser limpas depois). Sem mudança de schema neste PR.

## Visual
Tudo reaproveita os componentes do `ManualScheduleGrid` atuais:
- Mesma `Table`, mesma célula, mesmo `PracaBadge`, mesmo `ScheduleEditModal`, mesma fonte uppercase, mesmas cores.
- A única diferença visível é o nome da linha ("Vaga {tipo}") e um botão `Link2 Vincular` no fim da linha. Quando vinculado, a linha vira a linha normal da pessoa.

## Fora de escopo
- Persistir vagas como rascunho em banco.
- Sugestão automática de pessoas pela IA.
- Mudanças no `escala_template` e fluxo de aprovação COO.

## Entregáveis
1. `src/hooks/useAIDraftSlots.ts` (novo store).
2. `GeradorEscalaIA.tsx`: botão + conversão + navegação.
3. `ManualScheduleGrid.tsx`: render das linhas-vaga, ações editar/folga/vincular, função `linkDraftToEmployee`.
4. `EscalasTab.tsx`: remoção da aba MVP.
5. Limpeza de arquivos do MVP Itaim não mais usados.
