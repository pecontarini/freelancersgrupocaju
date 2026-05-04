# Aplicabilidade de Métricas por Loja

Adicionar `LOJA_METRICS` + `lojaHasMetric()` em `src/lib/lojaUtils.ts` e aplicar nas views do `/painel/metas` para que métricas que não se aplicam a uma loja apareçam como `—` (sem status colorido) e não contem para Top 3 nem Red Flag.

## 1. `src/lib/lojaUtils.ts`

Acrescentar (sem remover nada existente):

```ts
export const LOJA_METRICS: Record<string, {
  nps: boolean; cmv_carnes: boolean; cmv_salmao: boolean; kds: boolean; conformidade: boolean;
}> = {
  CJ_AN: { nps: true, cmv_carnes: false, cmv_salmao: false, kds: true, conformidade: true },
  CJ_SG: { nps: true, cmv_carnes: false, cmv_salmao: false, kds: true, conformidade: true },
  CP_AC: { nps: true, cmv_carnes: true,  cmv_salmao: false, kds: true, conformidade: true },
  CP_AN: { nps: true, cmv_carnes: true,  cmv_salmao: false, kds: true, conformidade: true },
  CP_AS: { nps: true, cmv_carnes: true,  cmv_salmao: false, kds: true, conformidade: true },
  CP_SG: { nps: true, cmv_carnes: true,  cmv_salmao: false, kds: true, conformidade: true },
  NZ_AC: { nps: true, cmv_carnes: false, cmv_salmao: true,  kds: true, conformidade: true },
  NZ_AS: { nps: true, cmv_carnes: false, cmv_salmao: true,  kds: true, conformidade: true },
  NZ_GO: { nps: true, cmv_carnes: false, cmv_salmao: true,  kds: true, conformidade: true },
  NZ_SG: { nps: true, cmv_carnes: false, cmv_salmao: true,  kds: true, conformidade: true },
};

export type LojaMetricKey = keyof (typeof LOJA_METRICS)[string];

export function lojaHasMetric(loja_codigo: string, metric: LojaMetricKey): boolean {
  return LOJA_METRICS[loja_codigo]?.[metric] ?? false;
}
```

Como as views usam `RankingMetric` com hífen (`"cmv-salmao"`, `"cmv-carnes"`) e o map usa underscore, exportar também um helper que aceita o `RankingMetric`:

```ts
const RANKING_TO_LOJA_METRIC: Record<string, LojaMetricKey> = {
  "nps": "nps",
  "cmv-salmao": "cmv_salmao",
  "cmv-carnes": "cmv_carnes",
  "kds": "kds",
  "conformidade": "conformidade",
};

export function lojaHasRankingMetric(loja_codigo: string, metric: string): boolean {
  const k = RANKING_TO_LOJA_METRIC[metric];
  return k ? lojaHasMetric(loja_codigo, k) : true;
}
```

## 2. `RankingView.tsx` — matriz

Na célula de cada métrica (loop `RANKING_METRICS.map`): se `!lojaHasRankingMetric(loja.code, m)`, renderizar uma célula neutra com `—` (sem `STATUS_CELL`, sem suffix). Caso contrário, comportamento atual.

Red Flag da linha permanece como `loja.redFlag` do snapshot (já filtrado pela regra do item 5 abaixo via banco; visualmente nada muda aqui além das células N/A).

## 3. `MetricDetailView.tsx` — view por métrica

No cálculo de `rows` (ranking ordenado), separar lojas N/A:

- Lojas onde `!lojaHasRankingMetric(loja.code, metric)` → entrada com `value=null`, `status` neutro (não colorir), exibidas no fim da tabela com `—` em Valor / Δ / Status (sem badge, texto cinza) e sem barra de desempenho.
- Não contam em `counts[status]`.
- No bloco "Variável por Cargo", essas lojas mostram `—` em Status e `R$ —` em Variável recebida (não recebem zero nem nota).

Implementação: adicionar flag `naMetric` em cada row; nas células de status/badge/barra/cargo checar essa flag.

## 4. `VisaoGeralCompactView.tsx` — Top 3 / Worst

No `useMemo` de `podiums`, antes do `sort`, filtrar também por aplicabilidade:

```ts
.filter((l) => l.values[m] !== null && lojaHasRankingMetric(l.code, m))
```

Resultado: `cmv-carnes` só lista lojas CP; `cmv-salmao` só lojas NZ; demais métricas inalteradas. `worst` segue a mesma lista filtrada.

Cards agregados (média da rede) também devem ignorar lojas sem aplicabilidade — ajustar `avg(data.map(spec.pick))` para usar somente registros onde `lojaHasRankingMetric(r.loja_codigo, spec.key)`.

## 5. Red Flag por aplicabilidade

`loja.redFlag` vem do snapshot e é global; não dá pra alterar no banco aqui. Solução só visual: no momento de exibir Red Flag em cada linha (Ranking matricial e MetricDetail), usar `redFlag && lojaHasRankingMetric(loja.code, metric)` quando estamos no contexto de uma métrica específica. No `RankingView` (matriz multi-métrica) manter o `loja.redFlag` original — o usuário pediu carnes apenas em CP / salmão apenas em NZ, o que já é coberto pelas células `—` (N/A não recebe red flag visual de carnes/salmão automaticamente porque a célula é neutra).

Em `MetricDetailView`, `r.isRed` passa a ser:
```ts
isRed: !naMetric && (status === "redflag" || loja.redFlag)
```
Para `cmv-carnes`/`cmv-salmao`, isso já filtra: NZ não dispara red flag de carnes; CP não dispara de salmão.

## Escopo

Tocar somente em:
- `src/lib/lojaUtils.ts`
- `src/components/dashboard/painel-metas/views/RankingView.tsx`
- `src/components/dashboard/painel-metas/views/MetricDetailView.tsx`
- `src/components/dashboard/painel-metas/views/VisaoGeralCompactView.tsx`

Sem mudanças em hooks, banco, ou demais views (`ComparativoView`, `VisaoGeralView`).
