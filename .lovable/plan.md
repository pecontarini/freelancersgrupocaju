## Problema

Hoje o drag & drop do board (Kanban) usa apenas `opacity-50` no card sendo arrastado e um `ring` simples na coluna alvo. Não há `DragOverlay` (o card "voa" sem peso visual), nem feedback de drop, nem reordenação suave. Visual fraco para um portal com identidade Liquid Glass.

## Objetivo

Transformar o arrasto numa interação fluida estilo Apple/Linear: o card "destaca" do board, ganha sombra/glow coral, gira levemente, a coluna de destino "respira" e os outros cards "abrem espaço". Ao soltar, animação de encaixe satisfatória.

## O que será feito

### 1. `DragOverlay` (dnd-kit) no `MissoesBoardView`
Substituir o transform local do card original por um `<DragOverlay>` que renderiza uma cópia "flutuante" do card durante o arrasto:
- Card original fica como "fantasma" (opacidade 0.35, escala 0.97, blur leve, borda tracejada coral) — marca o lugar de origem.
- Overlay renderiza o card em escala 1.05, com `rotate(-2deg)`, sombra coral forte (`--shadow-primary`), glass-card-strong, cursor grabbing.
- Animação suave de entrada/saída do overlay (`scale-in` 200ms easing Apple).

### 2. Coluna alvo (`MissaoColumn`) com feedback "respiração"
Quando `isOver = true`:
- Background ganha tint coral suave (`bg-primary/[0.04]`), borda coral pulsante.
- Barra de status lateral expande de 3px para 5px com transição.
- Aparece um **placeholder ghost** (linha tracejada animada) onde o card será inserido — usando um div que se expande de altura 0 → ~92px com `cubic-bezier(0.16, 1, 0.3, 1)`.
- Sutil shadow inset coral para indicar "zona de drop".

### 3. Cards vizinhos cedem espaço
Adicionar transição `transition-transform duration-200` em cada card da coluna. Como a placeholder ghost ocupa altura ao entrar, os cards abaixo deslizam naturalmente para baixo (efeito gratuito do layout flex + transição).

### 4. Animação de "drop / encaixe"
Ao soltar (`onDragEnd`), o card aterrissa na nova coluna com:
- Animação `landingPulse`: scale 1.06 → 1.0 com bounce suave (250ms), borda coral piscando uma vez.
- Pequeno destaque do priority accent bar (largura 4px → 6px → 4px).

### 5. Ajustes visuais durante drag global
- `body` ganha classe `is-dragging` (cursor grabbing forçado, `user-select: none`).
- Demais colunas reduzem opacidade levemente para 0.85 (foca atenção na coluna alvo).
- Sensor com `activationConstraint: { distance: 8 }` para não disparar em clicks acidentais.

### 6. Novos keyframes em `src/index.css`
- `@keyframes landingPulse` — bounce de aterrissagem.
- `@keyframes dropZonePulse` — borda coral pulsante na coluna alvo.
- `@keyframes ghostShimmer` — placeholder com shimmer suave.
- Utilities: `.drag-ghost`, `.drop-zone-active`, `.drag-overlay-card`, `.is-dragging`.

## Arquivos a modificar

- `src/components/agenda-lider/board/MissoesBoardView.tsx` — adicionar `DragOverlay`, estado `activeMissao`, listeners `onDragStart` / `onDragCancel`, classe `is-dragging` no body.
- `src/components/agenda-lider/board/MissaoCardCompact.tsx` — modo `ghost` (origem) vs `overlay` (flutuante) vs normal; aplicar landing pulse via key remount após drop.
- `src/components/agenda-lider/board/MissaoColumn.tsx` — placeholder ghost animado, expansão da barra lateral, tint coral, shadow inset.
- `src/index.css` — novos keyframes e utilities listados acima.

## Notas técnicas

- `DragOverlay` do dnd-kit já posiciona automaticamente seguindo o cursor — não precisamos calcular `transform` manual no card original.
- Placeholder ghost é renderizado **só quando** `isOver && activeMissao && activeMissao.status !== status` (não mostra na coluna de origem).
- Todas as transições usam `cubic-bezier(0.16, 1, 0.3, 1)` (easing Apple já presente no projeto) para coerência.
- Respeitar `prefers-reduced-motion`: animações de pulse/shimmer ficam estáticas se o usuário preferir.
- Sem mudanças em hooks, dados ou RLS — puramente visual/UX.

## Resultado esperado

Arrastar um card vai parecer "destacar uma etiqueta de papel encerada": o card sobe com sombra coral e leve rotação, as outras colunas recuam de foco, a coluna alvo "respira" e abre uma fenda tracejada, e ao soltar o card "aterrissa" com um pulse satisfatório. Coerente com o restante do Liquid Glass do portal.
