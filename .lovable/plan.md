## Diagnóstico

A aba **Configurações** é renderizada por `src/components/dashboard/ConfiguracoesTab.tsx`, que envolve dois componentes:

1. `ConfigurationsTab` (`src/components/ConfigurationsTab.tsx`) — contém todos os blocos abaixo
2. `UserManagement` (`src/components/UserManagement.tsx`) — gestão de usuários

### Blocos atualmente renderizados em `ConfigurationsTab`

| # | Componente | Permissão | Ação |
|---|-----------|-----------|------|
| 1 | `ClearEntriesModal` (header) | Admin | Manter |
| 2 | `UnitPartnershipsSection` — Lojas Casadas | Admin/Operador | Manter |
| 3 | `OperationalBudgetSection` — Orçamento operacional | Admin/Operador | Manter |
| 4 | `CargosConfigSection` — Cargos V2 | Admin | Manter |
| 5 | `BonusConfigSection` — Regras de bônus legacy | Admin | Manter |
| 6 | `MetaSheetsLinker` — Vínculo planilha → meta do Painel | Admin | **Manter** (exceção pedida) |
| 7 | `GoogleSheetsSync` — Sync Sheets geral | Admin | **Remover** |
| 8 | `ChecklistImportSection` — Import Checklist Fácil | Admin/Gerente | **Remover** |
| 9 | `LegacySyncPanel` — PDF Miner / legado | Admin | **Remover** |
| 10 | `ConfigSection` × 3 — Lojas / Funções / Gerências | Todos | Manter |
| 11 | `UserManagement` (no wrapper) | conforme hook | Manter |

## Mudanças

### 1. Remoções em `src/components/ConfigurationsTab.tsx`

Remover imports e usos de:
- `GoogleSheetsSync` (`@/components/GoogleSheetsSync`)
- `ChecklistImportSection` (`@/components/ChecklistImportSection`)
- `LegacySyncPanel` (`@/components/LegacySyncPanel`)

Não remover os arquivos em si (podem ser referenciados em outros lugares — verifico antes). Apenas desplugar da tela de Configurações. Não há estados/funções locais associados a esses três blocos dentro de `ConfigurationsTab` (são auto-contidos), então a remoção é só dos JSX + imports.

### 2. Reorganização visual

Reescrever o JSX de `ConfigurationsTab` agrupando o que sobrou em **4 grupos** dentro de containers `glass-card`, na ordem:

```text
┌─ Header (título + ClearEntriesModal) ─────────┐
│                                                │
├─ GRUPO 1 · INTEGRAÇÕES (Plug)  ───────────────┤
│   • MetaSheetsLinker                           │
│                                                │
├─ GRUPO 2 · OPERAÇÃO & FINANCEIRO (Building2) ─┤
│   • UnitPartnershipsSection                    │
│   • OperationalBudgetSection                   │
│                                                │
├─ GRUPO 3 · CARGOS & BÔNUS (Briefcase) ────────┤
│   • CargosConfigSection                        │
│   • BonusConfigSection                         │
│                                                │
├─ GRUPO 4 · CADASTROS BÁSICOS (Settings2) ─────┤
│   grid 1 col mobile / 2 cols md / 3 cols lg    │
│   • Lojas · Funções · Gerências (ConfigSection)│
└────────────────────────────────────────────────┘
```

Padrão de cabeçalho de cada grupo:
```tsx
<div className="flex items-center gap-2 mb-4">
  <Icon className="h-4 w-4 text-primary" />
  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
    Nome do Grupo
  </h3>
</div>
```

Container do grupo: `glass-card p-6 rounded-2xl` com `space-y-6` interno.
Espaçamento entre grupos: `space-y-8` no container raiz.

Grupos 2 e 3 (sub-cards independentes) podem ir em `grid md:grid-cols-2 gap-6` quando os dois cards filhos forem renderizados — mas como cada subseção já é um Card próprio, manter empilhado dentro do glass-card mantém a leitura. Vou usar `grid md:grid-cols-1` (empilhado) porque cada subseção é larga (tabelas/forms) e quebraria mal em 2 cols. Apenas o grid de **Cadastros Básicos** (grupo 4) é `md:grid-cols-2 lg:grid-cols-3`.

### 3. Verificação fora do escopo

Antes de editar, conferir com `rg` se `GoogleSheetsSync`, `ChecklistImportSection`, `LegacySyncPanel` são importados em outros arquivos. Se forem só usados em `ConfigurationsTab.tsx`, a remoção da referência é suficiente (arquivos ficam órfãos, mas não quebram o build). Não excluo arquivos para evitar efeito colateral.

### Arquivos alterados
- `src/components/ConfigurationsTab.tsx` (único arquivo modificado)

### Restrições respeitadas
- Nenhuma rota tocada
- Nenhuma outra página alterada
- Sem reescrever do zero — apenas remover 3 blocos e reagrupar o restante
