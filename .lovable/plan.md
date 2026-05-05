## Objetivo

Quando o usuário clicar em "Painel de Indicadores" (na sidebar desktop e na bottom navigation mobile), abrir diretamente a nova experiência construída em `/painel/metas`, ignorando o `PainelMetasTab` antigo que hoje é renderizado inline em `Index.tsx`.

## Sobre uma "Fase 3"

As Fases 1 e 2 entregaram: Executive Overview, Heatmap interativo, KPI cards, Drawer de drill-down, e views especializadas (NPS/Reclamações, CMV Salmão, CMV Carnes, KDS, Conformidade). Uma Fase 3 opcional poderia incluir: deep-linking via URL params (`?metric=&periodo=&loja=`), exportação CSV/PNG dos rankings, e mini-sparklines históricos nos KPI cards. **Nada disso é necessário para esta tarefa** — só sinalizo como evolução futura caso queira priorizar depois.

## Mudança proposta (mínima e cirúrgica)

Arquivo único: `src/pages/Index.tsx`

1. No `handleTabChange` (perto da linha 126-130, onde já existe um caso especial para `agenda` que faz `navigate("/agenda")`), adicionar caso análogo para `painel`:

```ts
if (tab === "painel") {
  navigate("/painel/metas");
  return;
}
```

2. Remover o `case "painel"` do `renderTabContent` (linha ~275) e o import de `PainelMetasTab` no topo do arquivo, já que ele não será mais renderizado inline. O componente `PainelMetasTab.tsx` em si fica preservado no codebase (sem uso) para evitar regressões em outros pontos — pode ser removido em uma limpeza futura.

## O que NÃO muda

- A rota `/painel/metas` em `App.tsx` continua igual.
- Toda a lógica de role/filtros do `MetasPage` permanece intacta.
- Sidebar (`AppSidebar.tsx`) e `BottomNavigation.tsx` continuam com o mesmo item `painel` — apenas o destino do clique muda.
- Nenhuma alteração em `/painel/metas` ou nos componentes da Fase 1/2.

## Resultado

Clicar em "Painel" (mobile ou desktop) navega direto para `/painel/metas` com o Executive Dashboard novo, sem passar pelo `PainelMetasTab` antigo.