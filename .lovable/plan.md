## Plano: Scaffolding do "Painel de Metas"

Implementação **estritamente cirúrgica** — apenas estrutura visual e roteamento da nova tab. Zero lógica de dados, zero queries Supabase.

### 1. `src/components/dashboard/PainelMetasTab.tsx` (NOVO)

Componente novo, isolado:

- Props: `{ selectedUnidadeId: string | null }` (recebida mas ainda não consumida).
- shadcn `Tabs` com `defaultValue="visao-geral"` e 4 `TabsTrigger`:
  - `visao-geral` — "Visão Geral" — ícone `LayoutDashboard`
  - `nps` — "NPS" — ícone `MessageSquare`
  - `conformidade` — "Conformidade" — ícone `ClipboardCheck`
  - `planos` — "Planos de Ação" — ícone `ListChecks`
- Cada `TabsContent` renderiza um `Card` com classe `glass-card` contendo o texto **"[Nome da aba] — em construção"**.
- Sem imports de Supabase, sem hooks de dados.

### 2. `src/pages/Index.tsx` (3 alterações pontuais)

- **Import** (após o import do `EstoqueTab`, linha 25):  
  `import { PainelMetasTab } from "@/components/dashboard/PainelMetasTab";`
- **`tabConfig`** (adicionar entrada antes do fechamento `};` na linha 85):
  ```ts
  painel: {
    title: "Painel de Metas",
    subtitle: "Resultados e metas operacionais da rede",
  },
  ```
- **`renderTabContent` switch** (adicionar novo `case` antes do `default`, perto da linha 266):
  ```ts
  case "painel":
    return <PainelMetasTab selectedUnidadeId={selectedUnidadeId} />;
  ```

Nada mais é alterado em `Index.tsx`.

### 3. `src/components/layout/AppSidebar.tsx`

- Adicionar import de `BarChart2` no bloco de ícones do `lucide-react`.
- Em `adminMenuItems`, inserir **antes** do item `configuracoes`:
  ```ts
  {
    title: "PAINEL DE METAS",
    id: "painel",
    icon: BarChart2,
    description: "Resultados e metas da rede",
  },
  ```
- **Visibilidade** (`admin`, `operator`, `gerente_unidade`; ocultar para `chefe_setor` e `employee`):  
  Como `adminMenuItems` hoje só renderiza dentro de `{isAdmin && ...}`, isolaremos o item `painel` em uma renderização adicional para que `operator` e `gerente_unidade` também o vejam:
  - Manter `adminMenuItems` apenas com `cx`, `configuracoes`, `rede`.
  - Criar uma constante separada `painelItem` e renderizar um `SidebarGroup` extra (com label "Gestão") visível quando `isAdmin || isOperator || isGerenteUnidade`, **antes** do bloco de admin.
  - `chefe_setor` continua caindo no filtro existente que limita o menu a "escalas" — nada a alterar nessa lógica.
  - `employee` não verá pois não é admin/operator/gerente.

Os itens existentes (`menuItems`, `adminMenuItems` restantes) permanecem **intactos**.

### 4. `src/components/layout/BottomNavigation.tsx`

- Adicionar `BarChart2` ao import do `lucide-react`.
- Adicionar ao final de `navItems`:
  ```ts
  { id: "painel", label: "Metas", icon: BarChart2 },
  ```
- Nenhuma tab existente é removida ou reordenada.
- A regra existente para `chefe_setor` (filtro para apenas "escalas") já oculta automaticamente o novo item para esse perfil.

### Restrições respeitadas

- `App.tsx`, `useUserProfile`, `useUnidade`, `AuthContext` — **não tocados**.
- Nenhum componente fora de `src/components/dashboard/` (exceto os 3 arquivos explicitamente listados) é modificado.
- Zero queries Supabase neste passo.
- Design system existente (`glass-card`, primary coral, radius 1rem) é reutilizado tal qual.

### Resultado visual esperado

- Sidebar (desktop) mostra novo item "PAINEL DE METAS" com ícone de gráfico de barras para admin/operator/gerente, posicionado antes de "CONFIGURAÇÕES".
- Bottom nav (mobile) ganha um 6º ícone "Metas".
- Ao clicar, header muda para "Painel de Metas / Resultados e metas operacionais da rede" e o conteúdo exibe 4 sub-abas com cards placeholder "em construção".
