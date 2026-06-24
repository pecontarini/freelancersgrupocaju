## Mudanças propostas

### 1. CSV de pagamento — Data de Vencimento = data de geração

**Arquivo:** `src/lib/paymentCsv.ts`

Hoje, em `buildPaymentCsv`, os três campos de data (`Data Documento`, `Data Vencimento`, `Data Competência`) recebem o mesmo valor: `ymdToBr(startDate)` (data inicial do período do filtro).

Mudança:
- Adicionar uma constante `dataHoje` calculada no momento da geração:
  ```ts
  const today = new Date();
  const dataHoje = `${String(today.getDate()).padStart(2,"0")}/${String(today.getMonth()+1).padStart(2,"0")}/${today.getFullYear()}`;
  ```
- Substituir apenas o campo **Data Vencimento** por `dataHoje`.
- **Data Documento** e **Data Competência** continuam usando `dataDoc` (data inicial do período), pois representam a competência do serviço, não o vencimento.

Resultado: toda vez que o CSV for gerado, o vencimento sairá com a data do dia da geração — independente do período filtrado.

---

### 2. Filtro de Cargo (Funções) — habilitar scroll completo

**Arquivo:** `src/components/ui/multi-select.tsx`

Hoje o popover usa:
```tsx
<ScrollArea className="max-h-[300px]">
```

O Radix `ScrollArea` precisa de altura definida no Viewport para a barra de rolagem renderizar corretamente. Com `max-h` apenas, em muitas situações o conteúdo cresce além de 300px sem ativar scroll, ou a barra fica oculta e o usuário não consegue ver/scrollar todas as opções de cargo (quando a lista tem >10 itens).

Mudança:
- Trocar `<ScrollArea className="max-h-[300px]">` por um wrapper com altura explícita quando há overflow, ex.:
  ```tsx
  <ScrollArea className="h-[280px]">
  ```
  ou condicionar: `className={cn(options.length > 8 ? "h-[280px]" : "max-h-[300px]")}`.
- Garantir que o `PopoverContent` não corte a barra (já tem `p-0`, ok).
- Não mexer no estilo do trigger nem no comportamento de seleção/multi-select.

Resultado: o dropdown de Funções (cargo) passa a rolar e exibir todas as opções, mesmo com listas longas.

---

### 3. Validação

- Gerar um CSV manualmente em qualquer período e abrir no Excel: confirmar que a coluna `Data Vencimento` mostra a data de hoje e as colunas `Data Documento`/`Data Competência` mostram a data inicial do filtro.
- Abrir o filtro de Funções com a lista cheia (>10 cargos) e validar que a rolagem funciona até o último item.

Sem alterações em SQL, hooks, ou outros componentes.