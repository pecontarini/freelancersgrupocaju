## Por que não apareceu

Naquele plano anterior eu **construí toda a Agenda do Líder** (o componente, as sub-abas Chat IA / Board / Meu Painel / Diretoria, os hooks, as tabelas no banco e a edge function de IA), mas **esqueci de plugar no menu**. O componente `AgendaLiderTab.tsx` está pronto e funcional, só está órfão — nenhuma página o renderiza, nenhum item de menu navega até ele.

Em outras palavras: faltou o **último passo de 5 minutos** — adicionar um item no sidebar e um `case` no switch da página principal.

## O que vou fazer (3 edições pequenas)

### 1. Adicionar "AGENDA DO LÍDER" no menu lateral
Arquivo: `src/components/layout/AppSidebar.tsx`

Novo item no `menuItems`, logo abaixo de "AGENDA":

```text
title: "AGENDA DO LÍDER"
id: "agenda-lider"
icon: ShieldCheck
description: "Chat IA, missões e planos de ação"
```

### 2. Renderizar a aba na página principal
Arquivo: `src/pages/Index.tsx`

- Importar `AgendaLiderTab`
- Adicionar `case "agenda-lider": return <AgendaLiderTab />;` no switch
- Adicionar entrada em `tabConfig` para o título/breadcrumb

### 3. Adicionar também na navegação inferior mobile (se houver espaço)
Arquivo: `src/components/layout/BottomNavigation.tsx`

Verificar se cabe — se não couber, fica só no sidebar (acessível pelo menu mobile expandido).

## Como vou validar

Depois de aplicar:
1. Abro `/` no app
2. Clico em **"AGENDA DO LÍDER"** no menu
3. Confirmo que renderiza as 4 sub-abas: **Chat IA**, **Board**, **Meu Painel**, **Diretoria**
4. Testo o Chat IA: digito "Crie uma missão de limpeza geral para amanhã" e confirmo que a IA responde via `agenda-lider-chat`
5. Confirmo no Board que a missão aparece como card

## O que NÃO precisa ser refeito

Tudo isso já existe e está deployado, não vou tocar:
- Tabelas `missoes`, `missao_membros`, `missao_atualizacoes`, `missao_anexos`
- RLS policies (`is_missao_member`, `user_can_see_missao`, etc.)
- Edge function `agenda-lider-chat` (Lovable AI Gateway)
- Hooks (`useMissoes`, `useMissaoDetalhe`, `useUnidadeMembros`)
- Sub-componentes (board, cards, chat view, diretoria, meu-painel)

## Tempo estimado

Funcional em poucos minutos após você aprovar — são apenas 2 a 3 arquivos pequenos para conectar peças que já existem.

Aprova que eu já aplico?