
# Plano consolidado — Refatoração visual + Efetivos + Integração com IA de escalas

Três entregas integradas em uma única implementação:
1. Refatoração visual da tabela "Mínimo de Pessoas".
2. Cálculo automático de Pessoas Necessárias × Efetivas Contratadas (CLT) com Gap.
3. Integração das **dobras** (`extras_count`) no Chat IA gerador de escalas.

Sem mudanças de schema. Sem mexer em `pracas_plano_chao`. Sem mexer no filtro global nem nos painéis de Forecast/Rates.

---

## Parte 1 — Refatoração visual da tabela

Arquivo: `src/components/escalas/holding/HoldingStaffingPanel.tsx`

Layout novo:

```text
| Setor | Turno | SEG | TER | QUA | QUI | SEX | SAB | DOM | Necess. | Efet. | Dobras | Gap |
| (120) |  (56) | (76)| (76)| (76)| (76)| (76)| (76)| (76)|  (72)   | (72)  |  (72)  | (90)|
```

- Coluna **Setor**: `w-[120px]` sticky, `text-xs`, badge "Nazo" como ícone pequeno.
- Coluna **Turno**: `w-14`, `text-[10px] uppercase tracking-wide`.
- Colunas dos dias: `w-[76px]`, input `w-16 h-9 text-base tabular-nums font-semibold`, fundo `bg-background/50 backdrop-blur-sm`.
- Ordem dos dias passa para **SEG → DOM** (igual à imagem de referência). Mantemos `day_of_week` 0..6 internos, só reordena a renderização via `DAYS_OF_WEEK_DISPLAY` em `sectors.ts`.
- Linhas com `h-11`; zebra sutil entre setores.
- Cabeçalho das 4 colunas finais: `font-semibold uppercase text-[11px] tracking-wide bg-muted/40`.

---

## Parte 2 — Colunas calculadas (Necess. / Efet. / Dobras / Gap)

Cada uma das 4 colunas finais aparece **uma vez por setor** (`rowSpan={2}` igual à coluna Setor — métrica é por setor, não por turno).

### Necessárias
Pico semanal (turno crítico) por setor:
```
necessarias[setor] = max sobre os 7 dias de max(almoco_d, jantar_d)
```

### Dobras (somente leitura, derivada)
Soma das dobras planejadas no setor, considerando o turno mais carregado:
```
dobras[setor] = max sobre os 7 dias de max(extras_almoco_d, extras_jantar_d)
```
(Hoje os campos de extras na UI ficam zerados — por isso vamos também adicionar **um segundo input de extras opcional por célula** num modo expandido. Ver Parte 2b abaixo.)

### Efetivas (CLT contratados ativos)
Novo hook em `src/hooks/useHoldingConfig.ts`: `useEffectiveHeadcountBySector(unitId)`.

Cadeia de junções:
```
sectors (unit_id, name == SECTOR_LABELS[sector_key])
  ← sector_job_titles (sector_id → job_title_id)
  ← employees (job_title_id, active=true, worker_type='clt')
```
Retorna `Record<sector_key, number>`. Empregados com cargo vinculado a múltiplos setores contam apenas no primeiro setor (regra real é 1 cargo → 1 setor).

### Gap
```
gap = (necessarias + dobras) − efetivas
```
Render como `Badge`:
- `gap > 0` → `bg-destructive/15 text-destructive` — "Faltam N"
- `gap == 0` → `bg-emerald-500/15 text-emerald-600` — "OK"
- `gap < 0` → `bg-amber-500/15 text-amber-700` — "Excedente N"

### Parte 2b — Edição de dobras na própria grade (opcional, mas incluso)

Adiciono um **toggle "Mostrar dobras"** no header do card. Quando ligado, cada célula passa a mostrar 2 inputs empilhados:
```
[ 12 ]   ← required_count
[ +5 ]   ← extras_count (texto cinza, prefixo "+")
```
O extras_count salva via mesmo `useUpsertHoldingStaffing` (campo já está no upsert).

Quando desligado (default), só o input principal aparece e a coluna **Dobras** mostra o agregado.

---

## Parte 3 — Integração com o Chat IA gerador de escalas

### 3a. `src/hooks/useScheduleAIContext.ts`
- Estender o tipo `staffing` para incluir `extras_count: number`.
- Adicionar `extras_count` ao `select` da `staffing_matrix`.

### 3b. `supabase/functions/gerar-escala-ia/index.ts`
Editar `buildSystemPrompt` (linhas 173-177) para incluir dobras:
```ts
lines.push("### Tabela Mínima POP (cobertura obrigatória + dobras planejadas)");
for (const r of ctx.staffing) {
  const extras = r.extras_count > 0
    ? ` (+ até ${r.extras_count} dobra(s) se cobertura ficar comprometida)`
    : "";
  lines.push(`- ${dowName[r.day_of_week]} ${r.shift_type}: ${r.required_count} pessoa(s)${extras}`);
}
```
E acrescentar uma regra explícita em `POP_RULES` (`src/lib/escalas/popRulesText.ts`):
> "Dobras (extras_count) são reposições autorizadas. Use **apenas** se faltas/folgas comprometerem o `required_count` do turno. Nunca exceda `required_count + extras_count` no mesmo turno."

Após editar, fazer redeploy da função `gerar-escala-ia`.

### Fluxo end-to-end resultante

```text
COO digita mínimo + dobras em "Configuração Operacional — Holding"
          ↓ (UNIQUE: unit_id, sector_key, shift_type, day_of_week, month_year)
holding_staffing_config
          ↓ trigger mirror_holding_to_staffing_matrix
staffing_matrix (required_count + extras_count atualizados)
          ↓ useScheduleAIContext lê
Prompt da IA: "Qui almoco: 12 pessoa(s) (+ até 5 dobras se cobertura ficar comprometida)"
          ↓
gerar-escala-ia respeita o mínimo e usa dobras como cap superior em caso de falta
```

---

## Arquivos tocados (resumo)

| Arquivo | Tipo de mudança |
|---|---|
| `src/components/escalas/holding/HoldingStaffingPanel.tsx` | Refatoração visual + 4 colunas novas + toggle dobras |
| `src/hooks/useHoldingConfig.ts` | Novo `useEffectiveHeadcountBySector` |
| `src/lib/holding/sectors.ts` | Add `DAYS_OF_WEEK_DISPLAY` (SEG→DOM) sem quebrar `DAYS_OF_WEEK` |
| `src/hooks/useScheduleAIContext.ts` | Incluir `extras_count` em `staffing` |
| `supabase/functions/gerar-escala-ia/index.ts` | Prompt menciona dobras, redeploy |
| `src/lib/escalas/popRulesText.ts` | Regra de uso de dobras |

Memória a atualizar: `mem://features/escalas/holding-operational-config` — registrar que extras_count agora alimenta a IA via `staffing_matrix`.

## Não inclui
- Não muda schema (extras_count já existe em ambas as tabelas).
- Não toca em Forecast/Rates/filtro global.
- Não altera o trigger de espelhamento (já espelha extras_count).
