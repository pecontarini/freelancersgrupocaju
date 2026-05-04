## Objetivo
Aplicar as réguas reais da empresa para CMV Carnes e CMV Salmão, ajustar labels/sufixos dos cards, e regravar o seed do `metas_snapshot` com valores realistas. KDS passa a ser "% pratos black target" (menor é melhor).

## Mudanças

### 1. `src/lib/metasUtils.ts`
Adicionar duas novas funções puras (sem alterar as existentes):

```ts
/** CMV Carnes — % de desvio sobre valor transferido (menor é melhor) */
export function calcCmvCarnesStatus(value): MetaStatus {
  if (value <= 0.6)  return "excelente";
  if (value <= 1.0)  return "bom";
  if (value <= 2.0)  return "regular";
  return "redflag"; // > 2.0
}

/** CMV Salmão — kg por R$1k vendido (menor é melhor) */
export function calcCmvSalmaoStatus(value): MetaStatus {
  if (value <= 1.55) return "excelente";
  if (value <= 1.65) return "bom";
  if (value <= 1.90) return "regular";
  return "redflag"; // > 1.90
}
```

### 2. `src/pages/painel/Metas.tsx`
- Importar `calcCmvCarnesStatus` e `calcCmvSalmaoStatus`.
- Atualizar specs dos cards:
  - **CMV Carnes**: `titulo: "CMV Carnes"`, `tipo: "% desvio s/ transferido"`, `meta: 0.6`, `redFlag: 2.0`, `unidadeSufixo: "%"`.
  - **CMV Salmão**: `titulo: "CMV Salmão"`, `tipo: "kg por R$1k vendido"`, `meta: 1.55`, `redFlag: 1.90`, `unidadeSufixo: "kg"`.
  - **KDS**: marcar como `polarity: "lower"`, `meta: 5`, `redFlag: 10`, `tipo: "% pratos black target"` (menor é melhor agora).
- Roteamento de status no `useMemo`: usar `calcCmvCarnesStatus` para CMV Carnes e `calcCmvSalmaoStatus` para CMV Salmão (mantém `calcNpsStatus`/`calcConformidadeStatus`/`calcMetaStatus` para os demais).

### 3. `src/components/dashboard/painel-metas/shared/mockLojas.ts`
Atualizar `METRIC_META` para alinhar normalização do ranking:
- `cmv-salmao`: `meta: 1.55`, `redFlag: 1.90`.
- `cmv-carnes`: `meta: 0.6`, `redFlag: 2.0`.
- `kds`: `polarity: "lower"`, `meta: 5`, `redFlag: 10`, label `"KDS Black Target (%)"`.

### 4. `src/components/metas/RedFlagBanner.tsx`
Atualizar entradas do array `METRICS`:
- `cmv_salmao`: `meta: 1.55`, `redFlag: 1.90`, status `calcCmvSalmaoStatus`.
- `cmv_carnes`: `meta: 0.6`, `redFlag: 2.0`, status `calcCmvCarnesStatus`.
- `kds`: `polarity: "lower"`, `meta: 5`, `redFlag: 10`.

### 5. Seed Supabase (via insert tool)
Executar `DELETE FROM metas_snapshot;` seguido do `INSERT` com os 10 registros de `2026-05` fornecidos pelo usuário.

## Validação
- NZ_GO deve aparecer como red flag (carnes 2.24 > 2.0; salmão 2.11 > 1.90; kds 11.2 > 10).
- Cards exibem "0,41%" e "1,31kg" com labels corretos.
- Ranking e RedFlagBanner refletem a nova régua.
