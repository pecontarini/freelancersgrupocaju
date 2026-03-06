

# Aplicar Liquid Glass ao Aplicativo Real

## Por que não apareceu no app?

O simulador é uma página isolada (`/liquid-glass-simulator`) com seu próprio background escuro e componentes glass. O portal real (`/`) usa o design system padrão (Tailwind CSS variables, `bg-background`, `bg-card`, etc.) — são dois mundos separados. Para o glass funcionar, ele precisa de um fundo com cores/profundidade por trás dos elementos translúcidos.

## Estratégia: Glass Theme no Portal Real

Aplicar os efeitos glass **na interface real** sem quebrar o layout existente. O fundo permanece com as cores do tema (claro/escuro), mas os componentes ganham o tratamento glass.

### Mudanças Planejadas

**1. Background Sutil com Orbs (Index.tsx)**
- Adicionar uma versão suave dos orbs animados como fundo do app principal
- No tema claro: orbs com opacidade muito baixa (~0.08) em tons coral/gray
- No tema escuro: orbs mais visíveis (~0.25) em tons purple/blue
- Componente `AppGlassBackground` que respeita o tema atual

**2. Sidebar Glass (AppSidebar.tsx)**
- Aplicar `backdrop-filter: blur(20px)` e fundo semi-transparente na sidebar
- Menu items ativos com "glass pill" highlight (como no simulador)
- Bordas sutis com gradiente de opacidade (mais claro no topo)

**3. Cards Glass (CSS + componentes)**
- Substituir a classe `.glass-card` existente por propriedades glass reais
- Cards com `backdrop-filter: blur(16px)`, bordas semi-transparentes
- Hover lift com shadow aumentado
- Aplicar nos cards de KPI, FinancialHealthCard, SummaryCard

**4. Header Glass (PortalHeader.tsx)**
- Header com blur e transparência, estilo floating nav do simulador
- Borda inferior sutil com gradiente

**5. Bottom Navigation Glass (BottomNavigation.tsx - mobile)**
- Barra inferior com glass blur
- Ícone ativo com glow sutil na cor de destaque

**6. Novo componente: AppGlassBackground**
- Versão mais sutil do `LiquidBackground` que funciona com ambos os temas
- Orbs menores, mais transparentes, cores que combinam com o tema coral/terracotta

### Arquivos a Criar/Editar

| Arquivo | Ação |
|---------|------|
| `src/components/layout/AppGlassBackground.tsx` | Criar — background sutil com orbs |
| `src/index.css` | Editar — atualizar `.glass-card`, adicionar utilitários glass |
| `src/pages/Index.tsx` | Editar — adicionar AppGlassBackground |
| `src/components/layout/AppSidebar.tsx` | Editar — aplicar glass na sidebar |
| `src/components/layout/BottomNavigation.tsx` | Editar — glass na barra mobile |
| `src/components/layout/PortalHeader.tsx` | Editar — header com blur |
| `src/components/SummaryCard.tsx` | Editar — glass no card principal |
| `src/components/ui/card.tsx` | Editar — variante glass opcional |

### Resultado Esperado
O app inteiro terá a sensação de "vidro líquido" — sidebar, cards, header e navegação com blur e transparência — mantendo as cores da marca, a legibilidade e a funcionalidade existente intactas.

