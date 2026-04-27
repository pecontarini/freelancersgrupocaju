# Plano: etiqueta de prioridade + glassmorphism na Agenda do Líder

Dois ajustes visuais coordenados, mantendo o sistema de design Apple Liquid Glass que já existe no projeto (`.glass-card`, `.glass-card-strong`, tokens `--glass-*`).

---

## 1. Etiqueta lateral colorida por prioridade

Hoje, o único indicador de prioridade nos cards é a tag `[ALTA]` no canto superior direito. Pouco visível à distância.

**Ideia:** adicionar uma **barra vertical colorida** (4px) na borda esquerda do card, na cor da prioridade — exatamente como Notion / Things / Linear marcam itens. A tag textual continua existindo, mas a leitura primária passa a ser a etiqueta lateral.

```text
┌──┬───────────────────────────────┐
│██│ TÍTULO DA MISSÃO       [ALTA] │   ← faixa vermelha = alta
│██│ descrição curta…              │
│██│ 👤 Responsável        📅 27/04│
└──┴───────────────────────────────┘

┌──┬───────────────────────────────┐
│██│ outra missão          [MÉDIA] │   ← faixa âmbar = média
└──┴───────────────────────────────┘

┌──┬───────────────────────────────┐
│██│ tarefa simples        [BAIXA] │   ← faixa verde = baixa
└──┴───────────────────────────────┘
```

**Cores (já usadas no `PRIORIDADE_MAP`):**
- Alta → `bg-destructive` (vermelho coral)
- Média → `bg-amber-500`
- Baixa → `bg-emerald-500`

**Onde aplicar a faixa:**
- `MissaoCardCompact.tsx` (board Kanban) — principal
- `MissoesPreviewCard.tsx` (chat IA) — espelha o board
- Cartões da `MeuPainelView.tsx` e `DiretoriaView.tsx` (se exibirem missão como card)
- Chips da agenda unificada (`CalendarChip`) — versão ultra-fina (2px) para não poluir o calendário

**Implementação técnica:**
- Novo helper em `shared/Badges.tsx`: `prioridadeAccent(prioridade)` que devolve a classe da cor (ex: `bg-destructive`, `bg-amber-500`, `bg-emerald-500`).
- No card: wrapper `relative overflow-hidden` + `<span className="absolute inset-y-0 left-0 w-1 {accent}" />` com padding-left ajustado.

---

## 2. Glassmorphism / Liquid Glass nos componentes da Agenda do Líder

O projeto já tem o sistema pronto em `index.css` (`.glass-card`, `.glass-card-strong`, `.glass-header`). Hoje a Agenda do Líder usa `Card` padrão sólido. Vou trocar pelos utilitários glass para alinhar com o resto da plataforma.

**Substituições:**

| Componente | Antes | Depois |
|---|---|---|
| Hero header da aba (`AgendaLiderTab`) | `Card border-primary/20 bg-gradient-to-r from-primary/5 ...` | `glass-card-strong` + leve gradient overlay coral |
| Cards do Kanban (`MissaoCardCompact`) | `bg-card/80` | `glass-card` + faixa de prioridade lateral + hover-lift |
| Colunas do board (`MissaoColumn`) | `border-2 border-dashed bg-...` | `glass-card` sutil (blur menor, border-subtle), drop-zone destacada com `ring-primary/40` |
| Header/controles da Agenda Unificada | `Card p-3` sólido | `glass-card-strong` |
| Grid Mês / Semana | `Card overflow-hidden p-0` | `glass-card` + cabeçalho dos dias com `bg-white/40 backdrop-blur` |
| Lista da agenda | `Card p-0` | `glass-card` |
| Chat IA (`MissoesChatView`) — bolhas de mensagem do assistente | sólidas | `glass-card` com blur sutil |

**Refinamentos visuais alinhados ao Apple LG:**
- Bordas com `border-top-color` mais claro (efeito de luz vinda de cima) — já está no `.glass-card`.
- `hover-lift` (utility já existente) nos cards do board para resposta de toque.
- Animação `fade-in` ao abrir cada aba (já existente).
- Manter `font-feature-settings` e `tabular-nums` para números (já no `body`).

---

## Arquivos a modificar

- `src/components/agenda-lider/shared/Badges.tsx` — exportar helper `prioridadeAccent()`
- `src/components/agenda-lider/board/MissaoCardCompact.tsx` — faixa lateral + `glass-card`
- `src/components/agenda-lider/board/MissaoColumn.tsx` — `glass-card` sutil
- `src/components/agenda-lider/board/MissoesBoardView.tsx` — espaçamentos
- `src/components/agenda-lider/chat/MissoesPreviewCard.tsx` — faixa lateral + `glass-card`
- `src/components/agenda-lider/chat/MissoesChatView.tsx` — bolhas glass
- `src/components/agenda-lider/agenda/AgendaUnificadaView.tsx` — header, grid e chips em glass + faixa fina nos chips de missão
- `src/components/agenda-lider/AgendaLiderTab.tsx` — hero `glass-card-strong`
- `src/components/agenda-lider/meu-painel/MeuPainelView.tsx` — cards em glass + faixa
- `src/components/agenda-lider/diretoria/DiretoriaView.tsx` — cards em glass + faixa

Sem mudanças de schema, sem novas dependências — apenas CSS/utilitários já existentes.

---

Posso aplicar?
