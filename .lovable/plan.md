## Problema

A tabela `utensilios_items` do Caju Itaim **já está zerada** (0 vínculos). Os 250 itens "UT-ADJD-*" que aparecem na tela com badge "Sem mínimo" vêm do `items_catalog` (catálogo global compartilhado pelas 16 lojas).

A tela `ContagemSemanal` (aba ativa na captura) lista **todo o catálogo** independentemente da loja ter configurado mínimo, então sempre mostra os 250 itens.

## Solução

Filtrar a lista de Contagem Semanal para mostrar **apenas itens vinculados à loja atual** (que têm registro em `utensilios_items` com `estoque_minimo > 0`), com um toggle opcional "Mostrar todos os itens do catálogo" para o caso de admin precisar configurar novos itens.

### Mudanças

**`src/components/utensilios/ContagemSemanal.tsx`**
- Adicionar estado `showCatalogOnly` (default: `true` = só itens da loja).
- No `useMemo` `displayItems` (linha 67-87), adicionar filtro: se `showCatalogOnly`, manter apenas itens onde `storeMap[c.id]` existe E `estoque_minimo > 0`.
- Adicionar Switch na barra de filtros: "Mostrar itens não configurados" (off por padrão).
- Mostrar contador: "X itens configurados nesta loja" vs "Y no catálogo global".

### Resultado

- **Caju Itaim agora**: lista vazia (0 vínculos) → mensagem "Nenhum utensílio configurado nesta loja. Importe o PDF para começar."
- **Após upload do PDF**: itens reconhecidos pela IA são vinculados em `utensilios_items` e aparecem normalmente.
- **Outras lojas**: continuam vendo apenas seus itens configurados (sem regressão).

### Não muda

- Banco de dados (catálogo global preservado, conforme escolhido).
- Outras telas (Dashboard, Controle de Compras, Histórico, contagem pública via PIN).
- Dialog "Definir Estoque Inicial" da `UtensiliosTab` — esse continua mostrando o catálogo completo (correto: é onde você configura).
