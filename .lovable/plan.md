# Otimização Mobile + Bottom Nav Vision Glass

## Objetivo
Aplicar o mesmo idioma "Apple Vision Pro / Liquid Glass" usado na sidebar do Painel de Indicadores na **barra inferior mobile** e fazer uma passada de **otimização responsiva** nas telas mais críticas do app, garantindo que tudo respeite a largura de 375–414px sem overflow, com tipografia legível e áreas de toque ≥44px.

---

## 1. Bottom Navigation — Vision Glass Floating Dock

Refatorar `src/components/layout/BottomNavigation.tsx` para um **dock flutuante arredondado**, fiel ao estilo da `PainelSidebar`.

**Mudanças visuais:**
- Trocar a barra colada na borda por um **dock flutuante** com margens laterais (`mx-3 mb-3`), `rounded-full`, usando `.vision-glass` (blur 36px + specular highlight + sombra cinematográfica).
- Cada item vira um **ícone circular** estilo `.vision-glass-icon` (44×44, atende touch target). 
- Ativo: glow coral (`shadow-[0_0_20px_hsl(var(--primary)/0.5)]`), ícone em `text-primary`, fundo `bg-primary/15`.
- Label só aparece no item ativo (animação de width/opacity com `cubic-bezier(0.65,0,0.35,1)`), igual ao padrão "rail expansível" da sidebar — economiza espaço horizontal.
- Badge de notificações (`escalaPending`) ganha estilo glass com ring branco para destacar sobre o blur.
- Header mobile (topo) também recebe `.vision-glass` no lugar de `glass-header` para consistência.

**Comportamento:**
- Manter mesma API (`activeTab`, `onTabChange`).
- Adicionar `safe-area-inset-bottom` no padding do wrapper externo, não dentro do dock.
- Sheet de Perfil mantida, mas o trigger vira ícone circular igual aos outros.

---

## 2. Otimização Mobile Geral

Auditoria e correções em telas que hoje quebram ou ficam apertadas em 390px:

### 2.1 Tabs e cabeçalhos (`PainelMetasTab`, `BudgetsGerenciaisTab`, `RemuneracaoVariavelTab`, `EstoqueTab`, `UtensiliosTab`, `CMVTab`)
- TabsList com `overflow-x-auto scrollbar-none` + `snap-x` no mobile, ao invés de quebrar em grid apertado.
- Triggers com `text-xs` no mobile, `text-sm` em sm:+, padding reduzido.
- Títulos de página: `text-xl md:text-2xl`, subtítulo `text-xs md:text-sm`.

### 2.2 Cards e KPIs
- Padronizar grids: `grid-cols-2 md:grid-cols-3 xl:grid-cols-4` (nunca 1 coluna em mobile para KPIs pequenos; usar `grid-cols-2`).
- `VisionKpiCard` ganha variante compacta no mobile (ícone menor, valor `text-xl` ao invés de `text-3xl`).
- Cards de listas (FreelancerCard, MaintenanceList, etc.) revisados para evitar `truncate` sem `min-w-0` no parent flex.

### 2.3 Tabelas (`EntriesTable`, `MaintenanceList`, `EstoqueTab/CatalogoItens`, `Movimentacao`, `Inventarios`)
- Em mobile usar o padrão já adotado no app: `useIsMobile()` → renderiza lista de cards; desktop mantém `<Table>`.
- Onde ainda houver `<Table>` exposta no mobile, envolver em `overflow-x-auto` com sombra de scroll.

### 2.4 Formulários e diálogos
- `Dialog`/`Sheet`: garantir `max-h-[90vh] overflow-y-auto` e `w-[calc(100vw-1rem)] max-w-md` no mobile.
- Inputs com `h-11` (44px) para conforto de toque.
- Botões de ação primários: `w-full sm:w-auto` em footers de modal.

### 2.5 PainelSidebar (mobile)
- Quando renderizada dentro do `Sheet` mobile, garantir scroll vertical e fechar o sheet automaticamente ao trocar de meta.

### 2.6 Espaçamento global
- Padding do conteúdo principal: `px-3 md:px-6` (hoje varia entre componentes).
- Bottom padding do `<main>` mobile: `pb-24` para não ficar atrás do dock flutuante (hoje é `pb-20`, insuficiente com o novo dock flutuante + safe-area).

---

## 3. CSS / Tokens (`src/index.css`)

Adicionar utilitários:
- `.vision-dock` — wrapper flutuante (`rounded-full`, `vision-glass`, `px-2 py-2`).
- `.vision-dock-item` — botão circular 44×44 com transição de width quando ativo.
- `.vision-dock-item-active` — glow coral + bg `primary/15`.
- `.scrollbar-none` — `scrollbar-width: none; &::-webkit-scrollbar { display:none }` (caso ainda não exista) para tabs roláveis.

---

## 4. Arquivos afetados

**Editar:**
- `src/index.css` — tokens do dock + utilitários.
- `src/components/layout/BottomNavigation.tsx` — refatoração completa.
- `src/pages/Index.tsx` — `pb-24` no main mobile.
- `src/components/dashboard/PainelMetasTab.tsx` — tabs roláveis, KPIs 2-col.
- `src/components/dashboard/BudgetsGerenciaisTab.tsx` — idem.
- `src/components/dashboard/RemuneracaoVariavelTab.tsx` — idem.
- `src/components/estoque/EstoqueTab.tsx` + filhos — tabs/grid mobile.
- `src/components/utensilios/UtensiliosTab.tsx` + `DashboardUtensilios.tsx` — grid 2-col.
- `src/components/cmv/` — grids e tabs.
- `src/components/painel/VisionKpiCard.tsx` — variante compacta.

**Sem alteração:** PainelSidebar (já está fiel ao Vision Pro), AppSidebar desktop, lógica de negócio.

---

## 5. Validação visual
Após implementar, verificarei via screenshots em 375px e 414px:
- Dock flutuante sem cortar nas bordas.
- Item ativo com label visível sem empurrar os outros.
- Painel de Indicadores, Budgets, Pessoas, Auditoria e Estoque sem overflow horizontal.

Posso prosseguir com a implementação?
