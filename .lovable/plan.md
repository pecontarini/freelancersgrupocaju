

# Plano: Permitir Gerentes Gerar Links de Contagem de Utensílios

## Contexto
O plano anterior previa que apenas admins (sem unidade selecionada) veriam o dashboard global com os links de contagem. Porém, gerentes de unidade precisam gerar esses links para suas lojas diretamente da aba de utensílios.

## Solução
Adicionar um card/seção "Link de Contagem" dentro do `UtensiliosTab` visível para **admins** e **gerentes** quando uma unidade está selecionada. Esse card mostra o link público da loja ativa e permite copiar/compartilhar.

## Mudanças

### 1. `src/components/utensilios/UtensiliosTab.tsx` — EDITAR
- Importar `useUserProfile` para checar `isAdmin` e `isGerenteUnidade`
- Adicionar seção "Link de Contagem" acima das tabs quando `effectiveUnidadeId` existe e o usuário é admin ou gerente
- Botões: **Copiar Link** e **Compartilhar WhatsApp**
- O link será: `{productionUrl}/contagem-utensilios/{effectiveUnidadeId}`

### 2. `src/pages/ContagemUtensilios.tsx` — EDITAR
- Aceitar `lojaId` como URL param (`useParams`) além do contexto global
- Se vier do param, usar esse ID (rota pública)

### 3. `src/App.tsx` — EDITAR
- Adicionar rota pública `/contagem-utensilios/:lojaId` (sem ProtectedRoute)

### 4. PIN de segurança (da decisão anterior)
- Novo campo `pin_contagem` na tabela `lojas` via migration (varchar(4), nullable)
- Na `ContagemUtensilios`, se acessada via URL param, exibir tela de PIN antes de liberar a contagem
- No `UtensiliosTab`, campo para o gerente/admin definir o PIN da loja

## Arquivos

| Tipo | Arquivo |
|------|---------|
| Editar | `src/components/utensilios/UtensiliosTab.tsx` — seção de link + PIN config |
| Editar | `src/pages/ContagemUtensilios.tsx` — aceitar param + tela de PIN |
| Editar | `src/App.tsx` — rota pública |
| Migration | Adicionar coluna `pin_contagem` à tabela `lojas` |

