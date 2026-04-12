

# Plano: Import/Export em Massa de Estoque Mínimo de Utensílios

## Resumo
Criar dois botões no `UtensiliosTab`: **Exportar Modelo** e **Importar Planilha**. O modelo Excel lista todas as unidades × todos os utensílios com colunas para estoque mínimo e setor. Ao importar, o sistema faz upsert em massa na `utensilios_items`.

## Estrutura do Excel

```text
| Unidade (não editar) | ID Unidade (oculto) | Código | Utensílio (não editar) | ID Item (oculto) | Setor | Estoque Mínimo | Valor Unitário |
|----------------------|---------------------|--------|------------------------|-------------------|-------|----------------|----------------|
| Caju Asa Norte       | uuid...             | UT001  | Garfo de mesa          | uuid...           | Salão | 50             | 2.50           |
| Caju Asa Norte       | uuid...             | UT002  | Faca de mesa           | uuid...           | Salão | 50             | 3.00           |
| Caju Lago Sul        | uuid...             | UT001  | Garfo de mesa          | uuid...           | Salão | 40             | 2.50           |
```

- Colunas de ID ficam ocultas (para o parser usar na importação)
- Colunas de nome ficam protegidas/cinza (só para referência)
- Colunas editáveis: **Setor**, **Estoque Mínimo**, **Valor Unitário**
- Se já existir configuração, o export preenche os valores atuais

## Mudanças

### 1. `src/hooks/useUtensilios.ts`
- Novo hook `useAllUtensiliosItems()` — busca `utensilios_items` de TODAS as lojas (sem filtro de `loja_id`), para pré-preencher valores existentes no export
- Novo hook `useBulkImportUtensiliosItems()` — recebe array de `{ catalog_item_id, loja_id, estoque_minimo, valor_unitario, area_responsavel }` e faz upsert em massa

### 2. Novo componente `src/components/utensilios/BulkImportExport.tsx`
- Botão **Exportar Modelo**: gera Excel com todas unidades × todos utensílios usando openpyxl-style (SheetJS), com formatação profissional
- Botão **Importar Planilha**: abre file input, parseia Excel, mostra modal de confirmação com resumo (X unidades, Y itens, Z alterações), e executa upsert
- Modal de revisão mostra preview dos dados antes de salvar

### 3. `src/components/utensilios/UtensiliosTab.tsx`
- Adicionar os botões de import/export ao lado do botão "Definir Estoque Inicial"
- Visível apenas para admins (gestão multi-unidade)

## Arquivos

| Tipo | Arquivo |
|------|---------|
| Novo | `src/components/utensilios/BulkImportExport.tsx` |
| Editar | `src/hooks/useUtensilios.ts` — hooks de fetch all + bulk import |
| Editar | `src/components/utensilios/UtensiliosTab.tsx` — integrar botões |

