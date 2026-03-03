

# Simulador Interativo de Liquid Glass UX

## Objetivo
Criar uma pagina simuladora pratica que mostra como o Liquid Glass se aplica a padroes reais de UX de aplicativo -- nao apenas componentes isolados, mas cenarios reais que o usuario interage no dia a dia.

## Pagina: `/liquid-glass-simulator`

Uma pagina com o mesmo background animado, mas agora com **cenas interativas** que o usuario pode navegar. Cada cena demonstra um padrao UX real com glass morphism aplicado.

### Cenas do Simulador

**1. Tela de Login/Auth**
- Formulario de login centralizado em GlassPanel com inputs glass
- Campos de email e senha com estilo translucido
- Botao "Entrar" com glass strong + hover glow
- Animacao de entrada com scale + fade

**2. Dashboard com Cards KPI**
- Grid de 4 cards KPI (Vendas, CMV, Auditoria, Equipe) em GlassPanel
- Cada card com icone colorido, valor numerico grande, e variacao %
- Mini sparkline simulado dentro de cada card
- Hover lift em cada card

**3. Lista/Feed de Notificacoes**
- Stack vertical de 3-4 notificacoes em glass pills
- Cada uma com icone, titulo, timestamp
- Click para expandir detalhes (animacao accordion glass)
- Badge de contagem no canto

**4. Modal/Dialog Glass**
- Botao que abre um modal overlay com GlassPanel
- Backdrop blur escurecido
- Conteudo do modal com titulo, texto, e botoes de acao glass
- Animacao de entrada scale + fade

**5. Bottom Sheet Mobile**
- Simula um bottom sheet arrastavel (estilo iOS)
- Conteudo com opcoes de menu em glass pills
- Handle bar no topo

### Navegacao entre Cenas
- Dock inferior (ja existe) adaptado para navegar entre as 5 cenas
- Indicador visual da cena ativa
- Transicao suave entre cenas com AnimatePresence

### Estrutura de Arquivos

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/LiquidGlassSimulator.tsx` | Pagina principal do simulador |
| `src/components/liquid-glass/scenes/LoginScene.tsx` | Cena de login |
| `src/components/liquid-glass/scenes/DashboardScene.tsx` | Cena de dashboard KPI |
| `src/components/liquid-glass/scenes/NotificationsScene.tsx` | Cena de feed |
| `src/components/liquid-glass/scenes/ModalScene.tsx` | Cena de modal |
| `src/components/liquid-glass/scenes/BottomSheetScene.tsx` | Cena de bottom sheet |
| `src/components/liquid-glass/SceneNavigator.tsx` | Dock de navegacao entre cenas |
| `src/App.tsx` | Adicionar rota `/liquid-glass-simulator` |

### Interatividade
- Todos os inputs sao funcionais (digitaveis, clicaveis)
- Modal abre/fecha com animacao
- Cards respondem a hover
- Bottom sheet arrasta para expandir/recolher
- Tudo usa o `GlassPanel` existente como base

### Resultado
O usuario podera ver exatamente como cada padrao de UX fica com Liquid Glass aplicado, interagindo com elementos reais em vez de apenas observar componentes estaticos.

