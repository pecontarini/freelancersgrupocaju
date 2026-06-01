# Plano Fase B — Lote B3 + B6

Premissa: B1 (remap dos 643) e B2 (trigger guardião) já rodaram via SQL fora do Lovable. Este lote é puramente frontend defensivo + UX. Sem mudanças de schema, sem deploy, sem commits.

---

## B3 — Hardening do `useDailyRoster`

### a) Arquivo e linhas

- `src/hooks/useDailyRoster.ts` (linhas 22–79) — **Modify**.
- Único consumidor que importa o hook: `IntervalosDrawer` e `scheduleDailyControlPdf` (via prop). Não altero a assinatura `DailyRosterRow` nem a ordem dos campos.

### b) Natureza da mudança

Modify pontual em duas partes da `queryFn`:

1. Apertar o JOIN com `employees` para descartar inativos.
2. Adicionar passo de dedup defensivo no array final, antes do `sort`.

### c) Estratégia (snippet conceitual)

**Filtro inner restritivo no select**: trocar o relacionamento embutido para inner + filtro `active=true`, usando a sintaxe PostgREST que o projeto já usa em outros hooks:

```ts
.select(`
  id, schedule_date, employee_id, sector_id,
  start_time, end_time, break_duration, schedule_type,
  shifts!schedules_shift_id_fkey ( start_time, end_time ),
  employees!schedules_employee_id_fkey!inner (
    id, name, job_title, worker_type, cpf, active
  )
`)
.eq("employees.active", true)
```

Com `!inner`, qualquer schedule cujo `employee_id` aponte pra inativo é descartado pelo Postgres — defesa em profundidade caso o trigger B2 falhe ou alguém reative um órfão manualmente.

**Dedup defensivo no client** (após o `map`, antes do `sort`):

```ts
const seen = new Map<string, DailyRosterRow>();
for (const r of mapped) {
  const cpfDigits = (r as any)._cpf ? String((r as any)._cpf).replace(/\D/g, "") : "";
  const identity = cpfDigits.length >= 11
    ? `cpf:${cpfDigits}`
    : `name:${r.employee_name.trim().toUpperCase()}`;
  const key = `${r.sector_id}::${identity}::${r.start_time ?? ""}`;
  const prev = seen.get(key);
  if (!prev) {
    seen.set(key, r);
  } else {
    // mantém o que tem horário explícito; empate → mantém o primeiro
    if (!prev.start_time && r.start_time) seen.set(key, r);
    if (typeof console !== "undefined") {
      console.warn("[useDailyRoster] duplicata defensiva descartada", { key, kept: seen.get(key)?.schedule_id, dropped: r.schedule_id });
    }
  }
}
const rows = Array.from(seen.values());
```

O `cpf` entra no `select` só para servir de chave; **não vaza no shape público** (`DailyRosterRow` continua exatamente igual). Uso um campo interno `_cpf` no objeto mapeado ou faço o cálculo da chave dentro do mesmo `map`/loop para nem expor — vou pelo loop único pra não criar campo descartável.

### d) Não se aplica a B3.

### e) Riscos de regressão

- **PDF de controle (`scheduleDailyControlPdf`) e `IntervalosDrawer**`: ambos consomem `DailyRosterRow` por nome de campo. Shape preservado → zero impacto.
- **Inativos legítimos no histórico**: o hook já é "operacional do dia" (controle de intervalos e folha de assinatura). Mostrar inativos numa folha de hoje não faz sentido — alinhado com o uso. Se algum dia surgir necessidade de relatório histórico com inativos, isso vai por outro hook.
- **Performance**: `!inner` + `eq` empurra filtro pro Postgres, tende a ficar igual ou melhor. Dedup é O(n) num conjunto de no máximo ~150 schedules/dia.

### f) Decisões que preciso de você

- Confirmar que **inativos não devem aparecer nem para fins de "tinha escala mas saiu da empresa hoje"** na folha de intervalos. Se quiser permitir esse caso edge, troco `!inner` por `!left` mantendo o filtro só no client. Default do plano: **inner restritivo** (mais seguro).

---

## B6 — UX do Quadro Base do Setor

### a) Arquivo e linhas

- `src/components/escalas/ManualScheduleGrid.tsx` (linhas 2006–2064) — **Modify**.
- Sem deletar componentes filhos. Sem tocar em `handleCellClick`/`handleSingleClickToggleOff` (só remapeio quem chama).

### b) Natureza da mudança

Modify localizado no bloco "Collapsible base section for CLTs not scheduled":

1. Renomear título + subtítulo.
2. Trocar `opacity-60` por `opacity-95` (legível, mas ainda visualmente subordinado ao quadro principal).
3. Inverter handlers: single-click abre editor; folga vira ação dentro do editor (já existe lá).
4. Toast educativo de primeiro uso, gated por `localStorage["cajupar:first_use_b6"]`.

### c) Não se aplica a B6.

### d) Proposta de copy + decisão sobre folga

**Título atual:**

> Quadro base do setor — sem escala nesta semana

**Proposta (vou usar esta, salvo objeção):**

> **Disponíveis no setor** — clique para escalar
> *(funcionários do setor sem escala nesta semana)*

Estrutura: linha-cabeçalho mantém ícone `Users` + Badge com count; muda só o texto. O subtítulo cinza explica a condição.

**Folga: dentro do editor** (não botão dedicado).

- O `EditScheduleDialog` já tem a opção "folga" como tipo de schedule.
- Botão dedicado na linha quebraria o padrão visual da tabela (oito colunas alinhadas com o quadro principal) e duplicaria caminho.
- Menos disruptivo: 1 clique abre editor, gestor escolhe "Escalar" ou "Folga" no mesmo lugar onde já escolhe pro quadro principal.

**Toast educativo (primeira interação após o deploy):**

```ts
const KEY = "cajupar:first_use_b6";
if (!localStorage.getItem(KEY)) {
  toast.info("Folga agora é uma opção dentro do editor", {
    description: "Clique no funcionário do quadro base para escalar ou marcar folga.",
    duration: 6000,
  });
  localStorage.setItem(KEY, new Date().toISOString());
}
```

Disparado dentro do novo `onClick` da célula, antes de chamar `handleCellClick`. Uso `toast` do `sonner` (já importado no arquivo — vou confirmar com grep antes; se for `useToast`, uso o que estiver lá, conforme regra da sessão).

**Handlers — diff conceitual:**

```tsx
<TableCell
  className="text-center p-1 cursor-pointer hover:bg-primary/5 transition-colors"
  title="Clique para escalar ou marcar folga"
  onClick={() => {
    maybeShowFirstUseToast();
    handleCellClick(emp, dateStr);
  }}
>
```

Removo `onDoubleClick`, removo o `setTimeout` de 220ms, removo `cancelPendingClick`. Não toco em `clickTimerRef`/`handleSingleClickToggleOff` porque ainda são usados no quadro principal (linhas anteriores) — só desconecto deste bloco.

### e) Riscos de regressão

- **Atalho "1 clique = folga" some neste bloco específico.** Quadro principal (linhas dos já escalados) continua com o comportamento atual — não toco nele. Risco: gestor que aprendeu o atalho antigo no quadro base reclama. Toast educativo mitiga; se quiser, escalo a duração ou viro `toast.message` persistente. 
- **Acessibilidade**: `cursor-pointer` + `title` já existem. Sem regressão.
- `**opacity-95` vs `opacity-60**`: contraste melhor, fica mais perto do quadro principal. Risco baixo de confundir com "já escalado" porque a célula continua mostrando `—` em vez de horário.

### f) Decisões que preciso de você

1. **Copy do título**: aceita "Disponíveis no setor — clique para escalar" ou prefere outra? (Alternativa: "Funcionários do setor sem escala — clique para escalar".)
2. **Folga dentro do editor** (default do plano) ou botão dedicado na linha? Plano segue com "dentro do editor".
3. **Duração do toast**: 6s ok ou prefere persistente (`duration: Infinity` + `dismissible`)?

---

## Ordem de execução (após aprovação)

1. Editar `useDailyRoster.ts` (B3).
2. Editar `ManualScheduleGrid.tsx` bloco 2006–2064 (B6).
3. Grep de validação:
  - `rg "useDailyRoster" src` → confirmar consumidores intactos.
  - `rg "handleSingleClickToggleOff" src/components/escalas/ManualScheduleGrid.tsx` → confirmar que continua usado no quadro principal.
  - `rg "first_use_b6"` → só na nova chamada.
4. Reportar arquivos tocados + saída dos greps + descrição visual da mudança do bloco base.

## Restrições respeitadas

- Não toco em `useEmployees`, `useSchedulableEmployees`, `useD1Schedules`.
- Não crio hook novo.
- Não modifico schema.
- Não commito nem faço deploy.  
  
Plano aprovado com 2 ajustes pequenos.  
  
DECISÕES:  
  
D1 — Inner restritivo: aprovado. Inativos não devem  
aparecer na folha de intervalos.  
  
D2 — Copy do título: aprovar "Disponíveis no setor —  
clique para escalar" + subtítulo "(funcionários do  
setor sem escala nesta semana)".  
  
D3 — Folga dentro do editor: aprovado.  
  
D4 — Toast: 8 segundos + action button "Não mostrar  
mais" que grava localStorage. Equilibra atenção  
com não-agressividade.  
  
AJUSTE NO DEDUP DEFENSIVO DO B3:  
  
Normalizar o nome antes de virar identity_key:  
  name.normalize('NFD')  
      .replace(/[\u0300-\u036f]/g,'')  
      .toUpperCase()  
      .trim()  
      .replace(/\s+/g,' ')  
  
Cobre acentuação inconsistente entre cadastros  
("JOSÉ  DA SILVA" vs "Jose da Silva" → mesma key).  
  
Custo: 1 linha. Ganho: dedup mais robusto.  
  
Pode executar B3 + B6 em lote único agora. Reporte:  
  • Arquivos tocados  
  • Greps de validação que você listou  
  • Descrição visual da mudança no Quadro Base  
    (antes/depois do bloco)  
  
Não commitar — eu commito ao final.