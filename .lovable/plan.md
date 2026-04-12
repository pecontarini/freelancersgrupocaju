

# Plano: Setores Front/Back + Auto-populate na Contagem

## Resumo
Três mudanças: (1) simplificar setores de utensílios para apenas "Front" e "Back"; (2) ao abrir o link de contagem, criar automaticamente os `utensilios_items` para todos os utensílios do catálogo se a loja ainda não tiver configuração; (3) botão de toggle Front/Back em cada item na tela de contagem.

## Mudanças

### 1. `src/components/utensilios/SectorFilter.tsx` — EDITAR
- Alterar `SETORES_UTENSILIOS` de `["Todos", "Cozinha", "Bar", "Salão", "Parrilla", "Sushi"]` para `["Todos", "Front", "Back"]`
- Isso propagará automaticamente para todos os componentes que usam esse array (UtensiliosTab, ContagemSemanal, DashboardUtensilios, ControleBudget, BulkImportExport)

### 2. `src/hooks/useUtensilios.ts` — EDITAR
- Alterar default de `area_responsavel` de `"Salão"` para `"Front"` em todos os hooks (`useBulkCreateUtensiliosItems`, `useBulkImportUtensiliosItems`)
- Novo hook `useAutoProvisionItems()` — mutation que recebe `lojaId`, busca todo o catálogo ativo (`is_utensilio = true`), faz upsert em `utensilios_items` com `estoque_minimo = 0` e `area_responsavel = "Front"` para todos os itens, usando `onConflict` para não sobrescrever configurações existentes

### 3. `src/pages/ContagemUtensilios.tsx` — EDITAR
- **Auto-populate**: No `ContagemForm`, após carregar `catalog` e `storeItems`, se `storeItems` estiver vazio (loja sem configuração), disparar automaticamente o `useAutoProvisionItems` com o `lojaId` — isso cria todos os itens com estoque mínimo 0 e setor "Front", desbloqueando a contagem imediatamente
- **Toggle Front/Back**: Em cada card de item, ao lado do badge de setor, adicionar um botão/toggle que alterna entre "Front" e "Back", salvando via `useUpdateUtensilioItem` (que já existe no hook). O toggle será um botão compacto com as letras "F" e "B"
- Remover a dependência de `storeItem` existir no filtro — após auto-provision, todos os itens aparecem

### 4. `src/components/utensilios/BulkImportExport.tsx` — EDITAR
- Alterar fallback de `"Salão"` para `"Front"` no parser de import

### 5. `src/components/utensilios/UtensiliosTab.tsx` — EDITAR
- Alterar fallback de `"Salão"` para `"Front"` no dialog de estoque inicial

### 6. Demais componentes com fallback `"Salão"`
- `ContagemSemanal.tsx`, `DashboardUtensilios.tsx`, `ControleBudget.tsx` — trocar fallback `"Salão"` → `"Front"`

## Fluxo do auto-populate

```text
Usuário abre link → PIN → ContagemForm monta
  ↓
storeItems === [] ?
  ↓ SIM
  Dispara autoProvision(lojaId)
    → Busca catálogo (229 itens)
    → Upsert em utensilios_items com estoque_minimo=0, setor="Front"
    → Invalida query → storeItems recarrega → itens aparecem
  ↓ NÃO
  Exibe itens normalmente
```

## Arquivos

| Tipo | Arquivo |
|------|---------|
| Editar | `src/components/utensilios/SectorFilter.tsx` — setores Front/Back |
| Editar | `src/hooks/useUtensilios.ts` — hook autoProvision + defaults |
| Editar | `src/pages/ContagemUtensilios.tsx` — auto-populate + toggle F/B |
| Editar | `src/components/utensilios/BulkImportExport.tsx` — fallback |
| Editar | `src/components/utensilios/UtensiliosTab.tsx` — fallback |
| Editar | `src/components/utensilios/ContagemSemanal.tsx` — fallback |
| Editar | `src/components/utensilios/DashboardUtensilios.tsx` — fallback |
| Editar | `src/components/utensilios/ControleBudget.tsx` — fallback |

## O que NÃO será alterado
- Schema do banco (coluna `area_responsavel` já é varchar, aceita qualquer valor)
- Dados existentes no banco (itens já configurados com setores antigos serão exibidos como estão, mas o filtro só mostrará Front/Back/Todos)

