# Plano — Controle de Intervalos no Editor de Escalas

## Visão geral

Adicionar, no header do **Editor de Escalas** (`ManualScheduleGrid.tsx`), um botão **"Intervalos do dia"** que abre um drawer com:
1. Lista de todos os escalados do dia (por setor) com horário previsto.
2. Botão **"Imprimir folha de controle"** que gera PDF com colunas em branco para preenchimento manual.
3. Para cada escala, ações **"Iniciar intervalo" / "Encerrar intervalo"** (cronômetro) + opção **"Editar horários"** (registro retroativo HH:MM).
4. Suporte a **múltiplos intervalos** por escala (padrão visual = 1, botão "+ adicionar intervalo" para extras).

---

## 1. Banco de dados (1 migration)

Nova tabela `public.schedule_breaks`:

```sql
CREATE TABLE public.schedule_breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  schedule_date date NOT NULL,
  started_at timestamptz,            -- nullable: pode ser registrado depois
  ended_at timestamptz,              -- nullable: enquanto aberto
  planned_minutes int,               -- opcional (vem de schedules.break_duration)
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_schedule_breaks_schedule ON public.schedule_breaks(schedule_id);
CREATE INDEX idx_schedule_breaks_unit_date ON public.schedule_breaks(unit_id, schedule_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_breaks TO authenticated;
GRANT ALL ON public.schedule_breaks TO service_role;

ALTER TABLE public.schedule_breaks ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão das políticas de schedules: admin global + operador da unidade
CREATE POLICY "Acesso por unidade" ON public.schedule_breaks
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.user_has_unit_access(auth.uid(), unit_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.user_has_unit_access(auth.uid(), unit_id)
  );

-- Trigger updated_at (reusar função existente do projeto)
CREATE TRIGGER trg_schedule_breaks_updated_at
  BEFORE UPDATE ON public.schedule_breaks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

Verificar antes da execução: nomes exatos de `has_role`, função `user_has_unit_access` (ou equivalente), e `set_updated_at` no schema atual. Se diferirem, ajustar.

---

## 2. Novos arquivos

### `src/hooks/useDailyRoster.ts`
Hook que retorna todos os schedules `working` do dia para uma unidade (lookup setor → nome, employee → nome/cargo), reusando o padrão do `useD1Schedules` mas para qualquer data, sem dedup pesado (apenas lista).

### `src/hooks/useScheduleBreaks.ts`
- `useScheduleBreaks(unitId, date)` → lista de breaks do dia.
- Mutations: `startBreak(schedule_id)`, `endBreak(break_id)`, `upsertManualBreak({ schedule_id, started_at, ended_at, notes })`, `deleteBreak(id)`.
- Invalida `["schedule-breaks", unitId, date]`.

### `src/lib/scheduleDailyControlPdf.ts`
PDF A4 paisagem, agrupado por setor, reusando `PDF_COLORS`/`PDF_LAYOUT` e `LOGO_BASE64`. Colunas:

| # | Nome | Cargo | Entrada | Saída | Interv. previsto | Saída p/ intervalo | Retorno | Assinatura |

Cabeçalho com unidade + data por extenso. Rodapé padrão do projeto (`addPageFooter`).

### `src/components/escalas/IntervalosDrawer.tsx`
`Sheet` (shadcn) acionado pelo botão. Contém:
- Cabeçalho: data (com `<Input type="date">` default = hoje) + botão "Imprimir folha".
- Lista agrupada por setor, cada linha:
  - Nome / cargo / horário previsto / intervalo previsto.
  - **Status do intervalo**: badge "Aguardando" / "Em intervalo (cronômetro mm:ss)" / "Concluído (HH:MM → HH:MM, total Xmin)".
  - Ações: `Iniciar` (vira `Encerrar` quando aberto), menu kebab com `Editar horários` (popover com 2 `<Input type="time">`), `Adicionar outro intervalo`, `Excluir`.
- Toast de sucesso/erro.
- Re-render do cronômetro com `setInterval` 1s enquanto houver breaks abertos.

### `src/components/escalas/IntervalosButton.tsx`
Botão pequeno (ícone `Coffee` do `lucide-react`) que abre o drawer. Recebe `unitId`, `unitName`.

---

## 3. Integração no `ManualScheduleGrid.tsx`

Inserir o `<IntervalosButton>` logo após o `<MasterExportButton>` (linha ~1146), apenas quando `canManage && selectedUnit`. Nenhuma outra mudança no grid.

---

## 4. Regras / detalhes

- **Cronômetro**: `started_at = now()` no clique; ao encerrar, `ended_at = now()`. Duração calculada em runtime.
- **Edição manual**: usuário digita HH:MM; combinamos com `schedule_date` da escala para montar `timestamptz` no fuso local (segue padrão de datas do projeto — só essas duas colunas são `timestamptz` porque precisam de hora; data permanece `YYYY-MM-DD` em `schedule_date`).
- **Múltiplos intervalos**: cada linha mostra o intervalo "principal" (o último ou o aberto); botão "+ intervalo" cria nova row. Histórico expansível por linha (collapsible).
- **PDF** imprime apenas o **previsto** + colunas em branco (a folha física é a fonte de verdade no chão; o painel é o registro digital, opcional).
- **Sem realtime** — refetch a cada 30s e on-focus, suficiente para o caso de uso.
- **Memória**: data tratada como string `YYYY-MM-DD` para o filtro; timestamps mantêm padrão Postgres.

---

## 5. Detalhes técnicos

- Drawer: `Sheet` (shadcn) lateral direita, largura `sm:max-w-2xl`.
- Cronômetro: hook local `useTick(1000)` que força re-render.
- PDF: `jspdf` + `jspdf-autotable` (já no projeto).
- Sem novas deps.

---

## 6. Arquivos tocados

**Criados (5):**
- `supabase/migrations/<timestamp>_schedule_breaks.sql`
- `src/hooks/useDailyRoster.ts`
- `src/hooks/useScheduleBreaks.ts`
- `src/lib/scheduleDailyControlPdf.ts`
- `src/components/escalas/IntervalosDrawer.tsx`
- `src/components/escalas/IntervalosButton.tsx`

**Editados (1):**
- `src/components/escalas/ManualScheduleGrid.tsx` (1 linha de import + 1 bloco `<IntervalosButton>`)

**Memória nova:** `mem://features/escalas/break-control` resumindo a feature.

---

## 7. Fora de escopo

- Notificações automáticas de "voltou tarde" (pode virar fase 2).
- Integração com ponto Secullum.
- Relatório histórico de cumprimento de intervalo (pode virar gráfico no Dashboard POP futuramente).

---

Aguardando **"aprovado"** para entrar em modo execução. Caso queira ajustar algo (ex.: drawer → aba; manter apenas cronômetro sem edição manual; usar `interval` no lugar de duas colunas timestamp), respondo com novo plano.
