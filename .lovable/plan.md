# Board de Missões — Drag & Drop fluido e responsivo

Objetivo: deixar o quadro Kanban de missões mais "vivo" — pegada imediata no desktop, suporte real a touch no mobile, animações de reordenação suaves (FLIP), feedback tátil e visual mais refinado, e drop mais inteligente (entre cards, não só na coluna).

## O que muda na experiência

- **Pickup imediato no desktop**: drag começa após apenas 4px de movimento (hoje são 8px). Clique simples continua abrindo o card sem disparar drag.
- **Drag funcional no mobile**: hoje só desktop arrasta. Adiciona `TouchSensor` com long-press de 200ms + tolerância de 8px (não rouba scroll vertical).
- **Drop posicional**: hoje você só solta "na coluna". Passa a usar `SortableContext` por coluna — pode reordenar dentro da mesma coluna e inserir em qualquer posição na coluna alvo, com placeholder mostrando o slot exato.
- **Animação de reordenação (FLIP)**: cards vizinhos deslizam suavemente quando outro card entra/sai (via `useSortable` + `CSS.Transform`). Hoje os cards "pulam" instantaneamente.
- **Auto-scroll inteligente**: ao arrastar perto da borda da coluna ou da viewport, rola automaticamente (built-in do dnd-kit, hoje desligado implicitamente por config).
- **Overlay refinado**: rotação reduzida (-1.5°), escala 1.03, sombra mais limpa, e o cursor original "afunda" (scale 0.94 + blur leve) em vez do tracejado atual — sensação de "pegou na mão".
- **Feedback tátil mobile**: `navigator.vibrate(8)` no pickup e `vibrate([4,40,4])` no drop válido (quando suportado).
- **Drop inválido**: animação de "snap back" para a posição original em vez de simplesmente sumir.
- **Landing animation refinada**: substitui o `landingPulse` por um destaque sutil de borda (ring primary fade-out 600ms) — menos "bouncy", mais Apple.
- **Estado otimista + reconciliação**: enquanto o `update.mutate` roda, o card já aparece na nova posição/coluna; se falhar, volta com animação reversa.
- **Acessibilidade**: mantém `KeyboardSensor` do dnd-kit (setas + espaço) com anúncios em PT-BR via `accessibility.announcements`.

## Mudanças técnicas

**`MissoesBoardView.tsx`**
- Sensores: `PointerSensor` (distance: 4), `TouchSensor` (delay: 200, tolerance: 8), `KeyboardSensor` com `sortableKeyboardCoordinates`.
- Envolver o grid com lógica de colisão `closestCorners` (melhor para Kanban com sortables).
- Estado local `localGrouped` derivado de `grouped` para suportar update otimista (movimentação visual antes do round-trip ao Supabase).
- `handleDragOver` para mover o card entre colunas em tempo real (visual). `handleDragEnd` confirma e dispara `update.mutate`; em erro, reverte `localGrouped`.
- `accessibility={{ announcements: { onDragStart, onDragOver, onDragEnd, onDragCancel } }}` em PT-BR.

**Nova `SortableMissaoCard.tsx`** (wrapper)
- Usa `useSortable({ id: missao.id, data: { missao, status } })`.
- Aplica `transform`, `transition` do dnd-kit no wrapper (FLIP automático).
- Repassa props para `MissaoCardCompact` (mantém o componente atual sem regressão).

**`MissaoColumn.tsx`**
- Envolver os filhos com `<SortableContext items={ids} strategy={verticalListSortingStrategy}>`.
- `useDroppable` continua para coluna vazia (drop direto).
- Placeholder agora vem do próprio `useSortable` (gap reservado), removendo o `drop-placeholder` artificial.

**`MissaoCardCompact.tsx`**
- Remover o `useDraggable` interno (passa a vir do wrapper sortable).
- Manter `variant="overlay"` para o `DragOverlay`.
- `onClick` só dispara se `!isDragging` (já é o comportamento padrão do sortable).

**`src/index.css`**
- Refinar `.drag-overlay-card`: `rotate(-1.5deg) scale(1.03)`, sombra mais sutil.
- Substituir `.drag-ghost` por: `opacity: 0.5; transform: scale(0.94); filter: blur(1px);` sem borda tracejada.
- Substituir `landingPulse` por `landingGlow` (ring de cor primary que fade-out em 600ms).
- Remover `.drop-placeholder` (não usado mais — o gap vem do sortable).
- Manter media query `prefers-reduced-motion`.

**Hook utilitário** — `useHapticFeedback.ts` (3 linhas, opcional): wrapper para `navigator.vibrate` com guard de suporte.

## Fora de escopo

- Persistência de ordem dentro da coluna (ainda não há coluna `posicao` em `missoes`). A reordenação dentro da coluna funciona visualmente na sessão, mas não persiste — adicionar isso requer migração SQL (posso fazer em seguida se você quiser).
- Multi-seleção / drag em lote.

## Arquivos

- `src/components/agenda-lider/board/MissoesBoardView.tsx` (editar)
- `src/components/agenda-lider/board/MissaoColumn.tsx` (editar)
- `src/components/agenda-lider/board/MissaoCardCompact.tsx` (editar)
- `src/components/agenda-lider/board/SortableMissaoCard.tsx` (criar)
- `src/hooks/useHapticFeedback.ts` (criar)
- `src/index.css` (refinar bloco DRAG & DROP)
