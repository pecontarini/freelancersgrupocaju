# Otimização Mobile — Agenda do Líder

## Problemas observados nos prints

**Print 1 — aba Diretoria (`DiretoriaView.tsx`)**
- A tabela "Todas as missões" é renderizada com `overflow-x-auto`, mas no mobile colapsa em colunas estreitíssimas: "MISSÃO" trunca cedo, "UNIDADE" empilha letra-por-letra (`MULT 02 - NAZO GO`) e as colunas Responsável/Prioridade/Status/Prazo ficam escondidas atrás de scroll horizontal pouco descobrível.
- Os cards "Execução por unidade/responsável" funcionam mas barras de progresso são muito finas (h-2) e e-mails longos quebram o alinhamento.

**Print 2 — aba Agenda → Semana (`AgendaUnificadaView.tsx`)**
- Vista "Semana" força 7 colunas num viewport de 440px → cada coluna fica com ~50px e os títulos das missões/eventos viram letras verticais (`P / C / 0`, `S / F / D / I / E / N…`) — completamente ilegíveis.
- Vista "Mês" tem o mesmo problema (7 colunas × `min-h-[110px]`), com chips compactos cortados.
- Header de controles (Hoje/Mês/Semana/Lista/Atualizar) quebra em 2-3 linhas e ocupa muito espaço acima do conteúdo.
- Botões de navegação (chevrons) têm 28px — abaixo do mínimo de toque (44px) da memória "Portal mobile optimization".

## Estratégia

Princípio: **no mobile, calendário em grid de 7 colunas não funciona** — substituir por padrões nativos mobile (single-day com swipe + agenda agrupada). Tabelas viram cards. Tudo respeitando `useIsMobile()` e o liquid-glass design system.

---

## Mudanças

### 1. `AgendaUnificadaView.tsx` — vistas responsivas

**Header de controles (mobile)**
- Compactar em **uma linha**: chevron ←, label do período (truncável), chevron →, e um botão "Hoje" pequeno à direita.
- Trocar o `Tabs` Mês/Semana/Lista por um **segmented control** abaixo do título, em largura cheia, com touch targets de 44px.
- Botão "Atualizar" vira ícone-only no mobile (44×44).
- Legenda (bolinha Missão / Google) e badge "Conecte sua conta" continuam, mas em chips menores.

**Vista "Mês" no mobile**
- Manter grid 7×N, mas:
  - Reduzir células para `min-h-[64px]` mostrando **apenas o número do dia + pontinhos coloridos** (até 4 dots: laranja=missão, azul=google) em vez de chips com texto.
  - Tap na célula → abre **bottom sheet** com a lista do dia (reusa o componente `CalendarChip` em modo `large`).
  - Hoje fica destacado como hoje em apps nativos (círculo preenchido).

**Vista "Semana" no mobile**
- Substituir o grid 7-col por **vista de UM dia por vez** com swipe horizontal:
  - Header com ←  `Sex, 02/05` (dia atual da semana)  →  e indicador de pontos abaixo (7 dots para os 7 dias).
  - Conteúdo: lista vertical dos itens daquele dia em chips `large` (full-width), com hora, ícone, prioridade.
  - Suporte a swipe via gesto horizontal (`framer-motion` drag) — já é dependência do projeto.
- Em ≥`md` mantém o grid 7×col atual.

**Vista "Lista"**
- Já é a melhor pra mobile. Apenas:
  - Aumentar padding vertical dos chips para 12px (touch target).
  - Header do dia sticky dentro do scroll.

### 2. `DiretoriaView.tsx` — cards no lugar de tabela

**Cards "Execução por unidade/responsável"**
- Aumentar barras de `h-2` → `h-2.5` e adicionar contagem grande à direita.
- Truncar e-mails longos com `truncate` + `title`.

**"Todas as missões"**
- No desktop: manter tabela atual.
- No mobile (`useIsMobile()`): renderizar **lista de cards**, cada um com:
  - Linha 1: título da missão (font-semibold, 2 linhas máx)
  - Linha 2: chips de Prioridade + Status + Prazo formatado (`02/05`)
  - Linha 3: unidade · responsável (text-xs muted)
  - Card inteiro clicável → abre `MissaoDetailDialog` (mesma ação atual).
- Header da seção mostra contador e um filtro rápido por status (Todas / Em andamento / Concluídas) num segmented control horizontal scrollável.

### 3. `AgendaLiderTab.tsx` — TabsList

- A `TabsList` (Chat IA / Board / Agenda / Meu Painel / Diretoria) usa `flex-wrap` e empilha em 2 linhas no mobile.
- Trocar para **scroll horizontal** com snap (sem wrap), 44px de altura, ícone+label sempre visíveis. Padrão "tabs sliding" usado em apps nativos.

### 4. Detalhes técnicos compartilhados

- Usar `useIsMobile()` (já existe em `src/hooks/use-mobile.tsx`) como gate.
- Bottom sheets: usar `Sheet` do shadcn (`side="bottom"`) — já presente em `components/ui/sheet.tsx`.
- Touch targets ≥44px conforme memória `portal-mobile-optimization`.
- Sem emojis (memória `iconography-and-status-standard`) — já está limpo.

---

## Arquivos a editar

- `src/components/agenda-lider/agenda/AgendaUnificadaView.tsx` — refator de header + `MesView` + `SemanaView` mobile + chip touch sizes.
- `src/components/agenda-lider/diretoria/DiretoriaView.tsx` — cards mobile + filtro rápido + barras maiores.
- `src/components/agenda-lider/AgendaLiderTab.tsx` — TabsList scroll horizontal mobile.

## Sem mudanças

- Lógica de dados (hooks `useMissoes`, `useGoogleCalendarEvents`).
- Comportamento desktop — todas as melhorias são gated por breakpoint mobile.
- `MissaoDetailDialog`, `CalendarChip` (apenas reuso).

## Critérios de pronto

1. Em 390px de largura, a vista "Semana" mostra **um dia por vez** com títulos legíveis, navegação por swipe + chevrons.
2. Vista "Mês" mobile mostra calendário com pontinhos, e tap abre bottom sheet do dia.
3. Aba "Diretoria" no mobile mostra missões como cards (sem scroll horizontal escondido).
4. TabsList do Agenda do Líder não quebra em duas linhas; rola horizontalmente.
5. Todos os botões de toque ≥44px.
