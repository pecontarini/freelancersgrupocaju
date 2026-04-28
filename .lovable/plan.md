
# Plano — Liquid Glass Vision Pro no Painel de Indicadores

Aplicar a estética glassmorphism imersiva (referência Apple Vision Pro Smart Home Dashboard) ao **Painel de Indicadores**, redesenhar os itens do grupo **Gestão** da sidebar com ícones arredondados em pílula de vidro, e tornar **todos os gráficos e barras de progresso interativos ao toque/hover**.

## 1. Sistema visual Liquid Glass (Vision Pro)

Novos tokens e classes em `src/index.css` + `tailwind.config.ts`:

- `--vision-glass-bg`, `--vision-glass-bg-strong`, `--vision-glass-border-top`, `--vision-glass-border-bottom`, `--vision-glass-shadow`.
- Classes utilitárias:
  - `.vision-glass` — superfície vidro escura translúcida com `backdrop-filter: blur(36px) saturate(190%)`, borda superior clara (highlight especular), borda inferior escura, sombra interna sutil, radius 28px.
  - `.vision-glass-strong` — variante mais opaca para cartões principais (KPIs, ranking).
  - `.vision-glass-pill` — pílula arredondada para chips/abas internas.
  - `.vision-glass-icon` — círculo 40px com glass + glow sutil para ícones (será usado na sidebar e dentro de KPIs).
- `.vision-aurora-bg` — pseudo-fundo do painel com 3 orbes coral/âmbar/azul difusos (usa as keyframes `aurora-drift-*` já existentes do sistema motion).
- Specular highlight (`::before`) sutil no topo de cada cartão glass para imitar o efeito vidro real da referência.

## 2. Painel de Indicadores — Reskin

Editar `src/components/dashboard/PainelMetasTab.tsx`:

- Wrapper externo do painel: container com `vision-aurora-bg` fixo atrás, conteúdo com `relative z-10`.
- Substituir todos `glass-card` **dentro do painel** por `vision-glass` (KPI cards, mapa de calor, NPS, conformidade, planos, holding) — mantendo o `glass-card` global intacto para o resto do app.
- `Tabs` internas (`Visão Geral`, `Diário`, `NPS`, `Conformidade`, `Planos`, `Holding`): TabsList vira pílula glass flutuante (`vision-glass-pill`), TabsTrigger ativo recebe pill sólida coral com leve glow.
- KPI cards: ícone passa para um `vision-glass-icon` no canto superior direito, número grande com leve text-shadow coral, helper sutil.
- Tabela "Mapa de Calor" e "Ranking": linhas com hover translúcido, badges de tier com gradient + blur leve.
- Banner crítico: variante glass destrutiva (vidro com tinge vermelho, em vez de Alert padrão).

## 3. Sidebar — Itens do grupo "Gestão" com ícone arredondado

Editar `src/components/layout/AppSidebar.tsx` (apenas o bloco `gestaoMenuItems`, conforme pedido):

- Cada item do grupo **Gestão** (hoje só "Painel de Indicadores", mas extensível):
  - Renderiza um wrapper customizado em vez do `SidebarMenuButton` padrão.
  - Ícone dentro de um círculo `vision-glass-icon` (40×40, borda superior clara, glow coral leve quando ativo).
  - Texto à direita do círculo, com peso médio.
  - Estado ativo: o círculo ganha fundo coral translúcido + ring coral suave; texto fica em `text-primary`.
  - No estado collapsed da sidebar, mostra apenas o círculo (sem texto), mantendo o tooltip.
- Os outros grupos (`Menu Principal`, `Administração`) continuam como estão para preservar consistência atual.

## 4. Gráficos e barras interativos ao toque

Padronizar interatividade nos charts existentes do painel (e estendido aos novos componentes):

- **Recharts Pie/Line/Bar/Area**:
  - Tooltip customizado `VisionGlassTooltip` (glass pill com sombra coral, número grande, label discreta) — funciona em hover e em toque (mobile via touch events nativos do Recharts).
  - Pie: setor sob hover ganha `outerRadius +6` + opacidade 100%, demais caem para opacidade 70%; clique destaca/seleciona um canal e filtra a tabela ao lado.
  - Line: dots maiores em `activeDot`, linha ganha `strokeWidth +1` no hover; toque no eixo X mostra crosshair vertical com tooltip.
  - Bar (onde houver): hover/touch acende a barra com cor primary e mostra o valor.
- **Barra de progresso (`Progress`)**: novo componente `InteractiveProgress` (wrapper) — hover/touch mostra tooltip com valor exato + meta, leve scale-y, e shimmer animado contínuo na faixa preenchida.
- **Tier badges**: clicáveis — abrem popover com explicação do tier (Ouro/Prata/Bronze/Aceitável) e quais critérios atingiu.
- Hooks: usar `onMouseEnter`/`onTouchStart` do Recharts e `useState` local para o estado de hover/seleção. Mobile: garantir `touch-action: manipulation` nos charts.

## Arquivos a criar
- `src/components/painel/VisionGlassTooltip.tsx` — tooltip Recharts unificado
- `src/components/painel/InteractiveProgress.tsx` — barra de progresso interativa
- `src/components/painel/VisionAuroraBackdrop.tsx` — fundo aurora exclusivo do painel
- `src/components/painel/VisionKpiCard.tsx` — substitui o `KpiCard` interno (estilo Vision)

## Arquivos a editar
- `src/index.css` — adicionar tokens e classes `.vision-glass*`
- `tailwind.config.ts` — sombras e easings adicionais (se necessário)
- `src/components/dashboard/PainelMetasTab.tsx` — trocar classes `glass-card` por `vision-glass`, usar novos componentes, aplicar interatividade nos charts e barras
- `src/components/layout/AppSidebar.tsx` — bloco `gestaoMenuItems` com renderização custom (ícone arredondado em glass)

## Detalhes técnicos
- Sem novas dependências (Recharts e Radix já cobrem tooltips/popovers).
- Compatível com light e dark mode — `vision-glass` usa overlays translúcidos sobre `--background` atual.
- Performance: `backdrop-filter` aplicado apenas a cards visíveis; aurora drift usa `transform`/`opacity` (GPU) e respeita `prefers-reduced-motion`.
- Mobile: cartões mantêm padding maior (≥16px) e ícones touch target ≥40px.
- Não altera lógica de dados, RLS ou queries — é puramente UI.

## Fora do escopo
- Reskin global de todos os módulos (escala, CMV, utensílios) — mantém-se Liquid Glass atual.
- Animação 3D do logo no header (ficou pra fase 2 da motion language).

Posso prosseguir com a implementação?
