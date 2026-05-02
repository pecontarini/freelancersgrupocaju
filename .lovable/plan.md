## Substituir BarChart por LineChart na aba Comparativo

Arquivo único afetado: `src/components/dashboard/painel-metas/views/VisaoGeralView.tsx`

### 1. Imports do recharts (linhas 44–53)

Trocar:
```ts
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend, ResponsiveContainer } from "recharts";
```
Por:
```ts
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
```
(`Dot` não é necessário — `dot`/`activeDot` aceitam objeto direto.)

### 2. Componente `ComparisonChart` (linhas 900–947)

Manter `chartData` igual (eixo X: Front / Back / Geral, com chave por unidade).

Substituir o JSX do card pelo novo layout:

- **Cabeçalho**: título "Comparativo de performance" (11px, `#666`, uppercase, letter-spacing 0.06em) + subtítulo em amber listando os nomes das unidades comparadas (separados por `·`).
- **ResponsiveContainer**: `width="100%"` `height={320}`.
- **LineChart**: `margin={{ top: 20, right: 30, left: 0, bottom: 0 }}`.
- **CartesianGrid**: `strokeDasharray="3 3"`, `stroke="rgba(255,255,255,0.04)"`, `vertical={false}`.
- **XAxis**: `dataKey="metric"`, `tick={{ fontSize: 11, fill: "#666" }}`, `axisLine={false}`, `tickLine={false}`.
- **YAxis**: `domain={[50, 100]}`, `tick={{ fontSize: 11, fill: "#555" }}`, `tickLine={false}`, `axisLine={false}`.
- **ReferenceLine**: `y={85}`, `stroke="rgba(16,185,129,0.2)"`, `strokeDasharray="4 4"`, label `{ value: "meta 85%", fill: "#10B981", fontSize: 10, position: "right" }`.
- **Tooltip** (`RTooltip`): `contentStyle={{ background: "#161616", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px" }}`, `labelStyle={{ color: "#888", marginBottom: "6px" }}`, formatter mostrando `"<valor>%"` + nome da unidade.
- **Legend**: `wrapperStyle={{ fontSize: "11px", color: "#666", marginTop: "12px" }}`, `iconType="circle"`, `iconSize={6}`.
- **Line por unidade**: `type="monotone"`, `strokeWidth={2}`, `stroke={COMPARE_COLORS[i % n]}`, `dot={{ r: 4, fill: cor, strokeWidth: 0 }}`, `activeDot={{ r: 6, strokeWidth: 0 }}`, `animationDuration={600}`.

Remover completamente o wrapper `div.h-[360px]`, o ícone `BarChart3` do header antigo e qualquer referência a `<BarChart>`/`<Bar>`.

### 3. Verificação dos logs (sem mudança de código)

Os logs `=== RAW CSV [base_avaliacoes] ===` e `=== RAW CSV [nps_dashboard] ===` já foram adicionados em `useSheetData` em prompts anteriores. Após o deploy, abra Preview → F12 → Console e confirme que os dois logs aparecem (a busca atual por "RAW CSV" retornou vazio, o que sugere que a página do Painel ainda não foi montada na sessão atual ou o usuário não está logado naquela rota — basta navegar até o Painel de Indicadores para disparar o `useSheetData`).

Nada além disso será alterado no componente.
