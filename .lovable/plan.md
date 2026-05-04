
# Painel de Metas — Experiência Completa

Transformar `src/pages/painel/Metas.tsx` numa experiência com sidebar lateral de métricas + view detalhada por métrica (header + ranking + abas por cargo). Reaproveita sidebar e views já existentes em `src/components/dashboard/painel-metas/`.

## Estrutura de arquivos

```
src/pages/painel/Metas.tsx                 (refator: estado da view + render switch)
src/components/dashboard/painel-metas/
  shared/
    cargosConfig.ts                        (NOVO — hardcoded role→meta→peso R$)
  views/
    MetricDetailView.tsx                   (NOVO — header + ranking + tabs cargo)
    VisaoGeralCompactView.tsx              (NOVO — 5 cards atuais + mini-pódio 🥇🥈🥉)
    RankingView.tsx                        (existe — ajuste: tabela full + export CSV)
    ComparativoView.tsx                    (existe — adicionar tabela de delta abaixo do radar)
```

Não cria tabela nova no Supabase. Reutiliza `metas_snapshot` via `useMetasSnapshot`.

## 1. Novo estado em `Metas.tsx`

Substituir o grid único por:

```text
[ AppSidebar global ]  [ PainelHeader ]
                       [ Container ]
                          ┌─────────┬───────────────────────────┐
                          │ Painel  │  Render condicional       │
                          │ Sidebar │   visao-geral → VisaoGeralCompactView
                          │ (rail)  │   nps|cmv-*|kds|conformidade → MetricDetailView
                          │         │   ranking → RankingView
                          │         │   comparativo → ComparativoView
                          └─────────┴───────────────────────────┘
```

Estado: `const [view, setView] = useState<MetaKey>("visao-geral")`.

## 2. `cargosConfig.ts` (hardcoded — sem DB)

```ts
export interface CargoMeta {
  cargoKey: string;
  cargoLabel: string;
  pesoReais: number;
  faixas: { excelente: number; bom: number; regular: number; redflag: number };
}
export const METAS_CARGO_CONFIG: Record<RankingMetric, CargoMeta[]> = {
  nps:           [{cargo:"gerente_front",label:"Gerente de Front",peso:1500,...},
                  {cargo:"gerente_back", label:"Gerente de Back", peso:1500,...}],
  "cmv-carnes":  [{...gerente_back, peso:2000}, {...chefe_parrilla, peso:1000}],
  "cmv-salmao":  [{...gerente_back, peso:2000}, {...chefe_sushi, peso:1000}],
  kds:           [{...chefe_cozinha, peso:1000},{...chefe_parrilla, peso:500},
                  {...chefe_sushi, peso:500}],
  conformidade:  [{...gerente_front, peso:1500},{...gerente_back, peso:1500}],
};
```

Faixas em R$ por status (ex.: NPS Salão Excelente=R$1500, Bom=R$1000, Regular=R$500, RedFlag=R$0). Valores são as faixas atuais do bonus (proporcional ao peso). Confirmar com o usuário se quer outra escala — caso contrário, derivar como `peso × {1.0, 0.66, 0.33, 0}`.

## 3. `MetricDetailView` (componente principal)

Recebe `metricKey: RankingMetric` e renderiza 3 seções verticais:

### 3.1 Header da métrica
- Título, descrição (de `META_DEFINITIONS`), unidade
- Badge mês de referência (`currentMesRef()` formatado pt-BR)
- Linha resumo: "Rede: X excelentes · Y boas · Z regulares · W red flags"
  (calculado contando `statusFor(metric, value)` em todas as lojas)

### 3.2 Tabela ranking (full)
Reutiliza lógica visual de `RankingView` mas removendo a tabBar (já filtrado para a métrica atual). Colunas:
- `#` posição · `Loja` (badge bandeira CP/NZ/CJ/FB) · `Valor atual` · `Meta` · `Status` (badge colorido) · `Δ vs mês anterior` (↑↓)
- Barra horizontal proporcional colorida por status (`width: normalizeMetric()%`)
- Linha red flag: classe `animate-pulse` + bg vermelho

### 3.3 Tabs por cargo
```tsx
<Tabs>
  <TabsList>
    {METAS_CARGO_CONFIG[metric].map(c =>
      <TabsTrigger value={c.cargoKey}>
        {c.cargoLabel} · R$ {c.pesoReais}
      </TabsTrigger>)}
  </TabsList>
  {/* TabsContent para cada cargo */}
</Tabs>
```

Conteúdo de cada aba:
- **Faixas de pontuação**: 4 cards horizontais (Excelente / Bom / Regular / Red Flag) com valor R$ correspondente
- **Status por loja**: tabela compacta mostrando, para cada loja, o status atual nessa métrica + o valor R$ que aquele cargo recebe naquela loja

## 4. `VisaoGeralCompactView` (nova tela inicial)

- 5 `MetaCard` atuais (rede/média) — preserva código existente do `Metas.tsx`
- Abaixo: grid de 5 mini-cards "Top 3" — para cada métrica, mostrar 🥇 🥈 🥉 com nome curto + valor formatado, ordenado pela polaridade

## 5. `RankingView` — ajustes mínimos
- Já tem ranking por métrica em tabs; manter
- Adicionar botão "Exportar CSV" no header (gera CSV in-browser via `Blob` — sem nova lib)

## 6. `ComparativoView` — adicionar tabela de delta
- Manter radar existente
- Adicionar `<Table>` abaixo: linhas = métricas, colunas = lojas selecionadas + coluna `Δ máx-mín`

## 7. Permissões / sidebar

`PainelSidebar` já filtra por `showAdmin` / `showManagerPlus`. Em `Metas.tsx`, derivar das `roles`:
- `showAdmin = roles.includes("admin") || roles.includes("operator")`
- `showManagerPlus = showAdmin || roles.includes("gerente_unidade")`

Itens irrelevantes para esta página (`diario`, `holding`, `red-flag`, `planos`) — esconder via prop `hiddenKeys` opcional, OU ignorar `onSelect` para esses (preferência: passar lista filtrada). Adicionar prop `allowedKeys?: MetaKey[]`.

## 8. Design system
- Mantém `glass-card`, dark theme, cores semafóricas (`emerald/amber/orange/red`), tipografia Sora/DM_Sans
- Layout responsivo: sidebar `vision-glass` rail à esquerda em md+; em mobile, vira `Sheet` (já suportado por `forceExpanded`)

## Detalhes técnicos

- Status por loja×cargo: como não há `cargoScore` em `metas_snapshot`, usamos o mesmo `statusFor(metric, value)` da loja → todos cargos da métrica compartilham o status; o R$ exibido é o `peso × multiplicador(status)` configurado em `cargosConfig.ts`
- Não tocar em `useMetasSnapshot.ts`, `metasUtils.ts`, `MetaCard.tsx`, `mockLojas.ts` (apenas adicionar import de `RankingMetric`)
- Sem novas tabelas Supabase, sem migrations
- `currentMesRef()` continua sendo o mês corrente (default do hook)

## Pergunta antes de implementar

As faixas R$ por status (Excelente/Bom/Regular/RedFlag) por cargo — você tem valores específicos por cargo, ou posso usar a regra proporcional `{100%, 66%, 33%, 0%}` do peso total da variável?
