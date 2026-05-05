# Painel de Indicadores — Redesign Light/Dark com Glassmorphism Senior

## Diagnóstico

O Painel `/painel/metas` foi construído pensando apenas no tema escuro: usa cores travadas (`text-white`, `bg-white/5`, `ring-white/10`, `from-emerald-500/15`) em ~20 arquivos do diretório `painel-metas/`. No tema light isso resulta em:

- Texto branco sobre fundo claro (ilegível ou invisível)
- Glass plano, sem o brilho/blur característico do estilo Apple
- KPIs e heatmap com contraste insuficiente
- Sidebar de métricas e drawer perdem hierarquia visual

O design system já tem tokens prontos (`--glass-bg`, `--glass-border`, `--vision-glass-*`, `.glass-card`, `.vision-glass`) com variantes light e dark — só não estão sendo usados consistentemente.

## Objetivo

Entregar uma visualização moderna, profissional e bonita do Painel de Indicadores que funcione com excelência **nos dois temas**, com glassmorphism real (blur, saturate, borda superior luminosa, sombras coloridas suaves) e hierarquia tipográfica clara.

## Escopo

### 1. Tokens & utilidades (src/index.css)

Adicionar/refinar utilidades reutilizáveis baseadas nos tokens já existentes:

- `.kpi-glass` — card KPI com gradiente sutil de status (emerald/amber/orange/red), funcionando em ambos temas via `color-mix` ou variáveis CSS dedicadas por status (`--status-excelente-bg`, `--status-redflag-bg`, etc.).
- `.kpi-status-dot-{excelente|bom|regular|redflag}` — pontinhos de status com glow.
- `.heatmap-cell-{status}` — células do heatmap com contraste adequado em light/dark.
- `.glass-divider` — separador fino, refletido nos dois temas.
- Refinar `.vision-glass` com `border-image` opcional para criar a borda luminosa de topo característica do Vision Pro.

### 2. Componentes compartilhados (`shared/`)

Substituir cores hardcoded por tokens semânticos:

| Antes | Depois |
|---|---|
| `text-white`, `text-white/60`, `text-white/40` | `text-foreground`, `text-muted-foreground`, `text-foreground/60` |
| `bg-white/5`, `bg-white/[0.03]` | `bg-foreground/5`, `bg-muted/40` ou `.glass-card` aninhado |
| `ring-white/10`, `ring-white/15` | `ring-border`, `ring-foreground/10` |
| `from-emerald-500/15` em gradientes de status | utilidades `.kpi-glass` ou variáveis `--status-*` |

Arquivos a refatorar:
- `MetricKpiCard.tsx` — adotar `.kpi-glass`, ícone com bolha de vidro circular, valor em `text-foreground` com `display-number`, delta com `bg-emerald-500/10 text-emerald-700 dark:text-emerald-300`.
- `MetricHeatmap.tsx` — header e siglas em tokens semânticos; células usando utilidades de status; linha em hover com `bg-muted/50`.
- `MetricDrawer.tsx` — fundo `.glass-card-strong`, header com gradiente coral suave, métricas em cards aninhados.
- `PainelFilters.tsx` — pills `.vision-glass-pill` consistentes nos dois temas.
- `PainelSidebar.tsx` — já é razoável; ajustar hovers (`hover:bg-foreground/5` em vez de `bg-white/40`) e indicador ativo.
- `RankingCard.tsx`, `KpiByStoreGrid.tsx`, `SixMonthsCard.tsx`, `MetaPageHeader.tsx` — mesma migração.

### 3. Views (`views/`)

Aplicar a mesma migração em:
- `ExecutiveOverviewView.tsx` — header (h2 + p), seções "Pódio" e "Red Flags Ativos", textos vazios ("Nenhum red flag ativo"), botões da lista. Adicionar fundo aurora muito sutil (`<VisionAuroraBackdrop>` já existe) atrás dos KPIs.
- `NpsReclamacoesView.tsx`, `KdsConformidadeView.tsx`, `CmvDetailView.tsx`, `ConformidadeDetailView.tsx`, `RankingView.tsx`, `ComparativoView.tsx` — substituir todas as classes hardcoded.
- `MetricDetailView.tsx`, `VisaoGeralCompactView.tsx`, `VisaoGeralView.tsx` — mesmo tratamento.

### 4. Página `Metas.tsx`

- Trocar `bg-white/5` da `NpsSyncBar` por `.vision-glass-pill` ou um mini card glass.
- Garantir que o `<main>` use o `AppGlassBackground` corretamente atrás de tudo.
- Texto "Esta seção está disponível…" em `text-muted-foreground`.

### 5. Microrrefinamentos visuais

- KPIs com `motion.div` + entrada escalonada (já existe), adicionar `hover-lift`.
- Heatmap: pequeno gradient overlay no topo das células para reforçar o efeito vidro.
- Tipografia: títulos de seção em `font-display` (Space Grotesk) com `tracking-tight`, números grandes com `display-number`.
- Sombras coloridas suaves nos KPIs (sombra coral primária para o card "ativo").

## Fora do escopo

- Mudanças funcionais (hooks, lógica de cálculo, agregações).
- Novas seções/abas — apenas redesenho do que já existe.
- Banco de dados / RLS / edge functions.

## Estrutura técnica resumida

```text
src/index.css
  └─ +utilidades: .kpi-glass, .heatmap-cell-*, --status-*-bg/border (light+dark)

src/components/dashboard/painel-metas/
  ├─ shared/      → tokens semânticos em todos os arquivos
  └─ views/       → tokens semânticos em todos os arquivos

src/pages/painel/Metas.tsx → NpsSyncBar refinada
```

## Validação

Após implementação, abrir `/painel/metas` em ambos os temas (toggle no header) e verificar:
1. Todo texto legível.
2. Cards com efeito glass real (blur perceptível sobre o aurora background).
3. Status colors (verde/âmbar/laranja/vermelho) consistentes e acessíveis.
4. Hover/active states visíveis nos dois modos.
