

# Plano: Refatorar Importação em Massa de Estoque Mínimo

## Problemas Atuais
1. O fallback de setor no export ainda usa `"Salão"` (linha 66) em vez de `"Front"`
2. O modal de revisão é básico — não agrupa por unidade, não mostra resumo por loja, não permite edição inline
3. Sem feedback de progresso durante a importação (batches de 500)
4. Sem validação de IDs contra catálogo/lojas reais antes de confirmar
5. Os botões ficam pequenos e pouco visíveis na interface

## Mudanças

### 1. `src/components/utensilios/BulkImportExport.tsx` — REESCREVER
- **Export melhorado**: corrigir fallback `"Salão"` → `"Front"`, adicionar formatação condicional (highlight colunas editáveis), proteção nas colunas de ID
- **Import com validação robusta**: validar `loja_id` e `catalog_item_id` contra dados reais do banco; separar linhas válidas de inválidas
- **Modal de revisão profissional**:
  - Resumo por unidade (cards com nome da loja, quantidade de itens, badge novo/atualizado)
  - Tabela agrupada por unidade com accordion/collapse
  - Indicador visual de registros novos vs. atualizados (comparando com `existingMap`)
  - Contadores: novos, atualizados, ignorados (min=0), inválidos (ID não encontrado)
  - Barra de progresso durante o upsert
- **Aceitar linhas com estoque mínimo = 0** também (para zerar estoques intencionalmente), removendo a restrição atual que ignora min ≤ 0

### 2. `src/hooks/useUtensilios.ts` — EDITAR
- `useBulkImportUtensiliosItems`: adicionar callback de progresso para reportar batch atual/total ao componente
- `useAllUtensiliosItems`: sem mudanças necessárias

### 3. `src/components/utensilios/UtensiliosTab.tsx` — EDITAR
- Dar mais destaque visual à seção de importação em massa (Card dedicado em vez de botões inline)
- Mover `BulkImportExport` para dentro de um Card com título "Gestão em Massa" visível apenas para admins

## Fluxo Revisado

```text
Admin clica "Exportar Modelo"
  → Excel com todas unidades × todos utensílios
  → Colunas editáveis destacadas em amarelo
  → IDs ocultos para integridade

Admin preenche e clica "Importar Planilha"
  → Parser lê o arquivo
  → Valida IDs contra banco (lojas + catálogo)
  → Classifica: válidos, inválidos, novos, atualizados
  → Abre modal de revisão agrupado por unidade
  → Admin confirma
  → Progress bar durante upsert em batches
  → Sucesso com resumo final
```

## Arquivos

| Tipo | Arquivo |
|------|---------|
| Reescrever | `src/components/utensilios/BulkImportExport.tsx` |
| Editar | `src/hooks/useUtensilios.ts` — progresso no bulk import |
| Editar | `src/components/utensilios/UtensiliosTab.tsx` — layout do Card |

