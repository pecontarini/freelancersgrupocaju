## Plano: Sub-aba "Visão Geral" do Painel de Metas

**Escopo restrito**: alterações apenas em `src/components/dashboard/PainelMetasTab.tsx`. Nenhum outro arquivo será tocado. Nenhuma dependência nova.

### Verificações prévias (concluídas)

- `leadership_store_scores`: contém `loja_id`, `month_year` (text, formato `YYYY-MM`), `front_score`, `back_score`, `general_score`, `front_tier`, `back_tier`, `general_tier`, `total_audits`, `total_failures` ✅
- `reclamacoes.referencia_mes`: text no formato `YYYY-MM` ✅
- `supervision_audits.audit_date`: date — usar filtro `gte/lte` no intervalo do mês (mais robusto que LIKE)
- `config_lojas`: `id`, `nome` ✅
- RLS já isola lojas por usuário automaticamente

### Estrutura do componente refatorado

**Novos imports** (mesmo arquivo):
- `useState`, `useMemo` do React
- `useQuery` do `@tanstack/react-query`
- `supabase` de `@/integrations/supabase/client`
- `Table, TableBody, TableCell, TableHead, TableHeader, TableRow` de `@/components/ui/table`
- `Skeleton` de `@/components/ui/skeleton`
- `Progress` de `@/components/ui/progress`
- `Badge` de `@/components/ui/badge`
- `Alert, AlertDescription` de `@/components/ui/alert`
- Ícones extras: `ChevronLeft`, `ChevronRight`, `TrendingUp`, `TrendingDown`, `AlertTriangle`, `Trophy`, `MessageCircle`
- `Button` de `@/components/ui/button`

### BLOCO 1 — Seletor de mês

- State `mes: string` (formato `YYYY-MM`), inicializado com mês atual via `new Date().toISOString().slice(0,7)`
- Botões `ChevronLeft` / `ChevronRight` para navegar prev/next mês (manipulação por Date local, sem timezone shift)
- Label central exibe mês formatado em PT-BR (`new Date(`${mes}-01T00:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })`)
- Layout: flex centralizado dentro de `glass-card` compacto

### BLOCO 2 — 4 KPI Cards

Uma única query agregada via `useQuery(['painel-overview', mes])` que dispara 3 queries em paralelo:

1. `leadership_store_scores` filtrado por `month_year = mes` → calcular AVG de `back_score`, `front_score`, `general_score` no client (com base nos rows retornados)
2. `reclamacoes` filtrado por `referencia_mes = mes` → `count: 'exact', head: true`
3. `supervision_audits` filtrado por `audit_date >= ${mes}-01` AND `audit_date <= ${mes}-31` → AVG de `global_score`

Cards (grid `grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4`):

- **Card 1 — Back Score Médio** (ícone `TrendingDown` neutro): valor grande (`text-3xl font-bold`), `Progress` value=score%, cor por faixa (≥90 verde, ≥75 amber, <75 red via `[&>div]:bg-*`)
- **Card 2 — Front Score Médio** (`TrendingUp`): mesma estrutura
- **Card 3 — Reclamações no Mês** (`MessageCircle`): valor inteiro, sem progress bar (texto auxiliar "registradas")
- **Card 4 — Auditoria Supervisão** (`Trophy`): AVG global_score com Progress bar mesma escala

Loading: `Skeleton h-24` dentro de cada Card

### BLOCO 3 — Mapa de Calor (tabela)

Query `useQuery(['painel-heatmap', mes])`:

```ts
const { data: lojas } = await supabase.from('config_lojas').select('id, nome').order('nome');
const { data: scores } = await supabase
  .from('leadership_store_scores')
  .select('loja_id, front_score, back_score, general_score, general_tier, front_tier, back_tier')
  .eq('month_year', mes);
const { data: reclamCounts } = await supabase
  .from('reclamacoes')
  .select('loja_id')
  .eq('referencia_mes', mes);
```

Combinar no client em `useMemo`: para cada `loja`, achar score correspondente e contar reclamações por `loja_id`.

Tabela shadcn dentro de `Card glass-card`:
| Unidade | Front Score | Back Score | Score Geral | Reclamações | Tier |

- Cada célula de score: badge colorido pelo tier do respectivo campo (`front_tier`, `back_tier`, `general_tier`)
- Coluna Tier: badge do `general_tier`
- Mapa de cores (helper `getTierClasses(tier: string | null)`):
  - `ouro` → `bg-amber-100 text-amber-800`
  - `prata` → `bg-gray-100 text-gray-700`
  - `bronze` → `bg-orange-100 text-orange-800`
  - `aceitavel` → `bg-red-100 text-red-700`
  - `null/undefined` → `bg-muted text-muted-foreground` + texto "—"
- Loading: 5 linhas de `Skeleton` na tabela
- Empty state: "Nenhuma unidade disponível para este mês"

### BLOCO 4 — Banner de Alerta

- Renderizado **acima dos KPIs** se algum row de scores tiver `general_tier === 'aceitavel'`
- Componente `Alert` com `variant="destructive"`, ícone `AlertTriangle`
- Texto: `"Atenção: {N} unidade(s) com performance crítica este mês: {nomes separados por vírgula}"`

### BLOCO 5 — Sub-abas restantes

- `nps`, `conformidade`, `planos`: continuam com `<PlaceholderCard />` (sem alteração)
- Estrutura `Tabs` mantida intacta

### Padrões respeitados

- ✅ Nenhum cálculo de tier no frontend — todos lidos diretamente da tabela
- ✅ Datas tratadas como string `YYYY-MM` (memory: date-handling-standard)
- ✅ Sem novas libs
- ✅ `glass-card` em todos os wrappers
- ✅ Coral primary herdado pelo design system
- ✅ Sem emojis (lucide-react)
- ✅ RLS faz o filtro automático por loja
- ✅ Mobile-first: grid responsivo nos KPIs, tabela com `overflow-auto` herdado de `Table`

### Validação pós-implementação

1. Trocar mês → todas as queries reagem (queryKey inclui `mes`)
2. Mês sem dados → KPIs mostram "0" / "—", tabela mostra "—" nos badges
3. RLS: gerente_unidade vê só sua loja; admin vê todas
4. Banner aparece somente se houver `aceitavel`
