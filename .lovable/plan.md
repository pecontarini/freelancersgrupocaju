# Plano — Export CSV de Pagamento (consolidado por freelancer)

## Objetivo
Adicionar opção **"Gerar CSV de Pagamento (sistema)"** no mesmo `ExportReportButton` que hoje exporta PDF/Excel. O arquivo segue **100% fiel** ao template enviado para importação direta no ERP.

## Onde
- **Arquivo modificado:** `src/components/ExportReportButton.tsx` (já recebe `entries: FreelancerEntry[]` e `dateRange`).
  - Adicionar item ao `DropdownMenu`: "Gerar CSV de Pagamento (Sistema)".
  - Adicionar bot�o equivalente no variant `"button"` (segundo bot�o ao lado, mesmo estilo).
- **Arquivo novo:** `src/lib/paymentCsv.ts` — gerador puro do CSV (testável, isolado).

Como o componente já é renderizado em `BudgetDrillDownDialog` (drill-down de Freelancers) e em `BudgetsGerenciaisTab` (topo), o CSV passa a estar disponível **exatamente nos mesmos pontos do PDF de Ordem de Pagamento**.

## Layout fiel ao template

**Encoding:** Windows-1252 (Latin-1), separador `;`, EOL `\r\n`, **sem BOM**. Geração via `TextEncoder` não suporta Latin-1 nativo no browser → uso `Uint8Array` com map manual de caracteres (helper `toLatin1Bytes`) e fallback `?` para char fora da tabela. Nome do freelancer **sem acentos** (NFD + strip `\u0300-\u036f`) e em MAIÚSCULAS antes de gravar.

**Header (linha 1, idêntico ao template):**
```
CNPJ Empresa;Série Título;Nº Título;Nº Parcela;Nº Documento;CNPJ Fornecedor;Portador;Data Documento;Data Vencimento;Data Competência;Valor Desconto;Valor Multa Atraso;Valor Juros Dia; Valor Original ;Observações do Título;Cód Conta Gerencial;Cód Centro de Custo;Evento;RFP
```
(Replicado byte-a-byte do arquivo enviado, inclusive os espaços ao redor de " Valor Original " e os acentos.)

**Uma linha por freelancer** (agrupamento por `cpf`):

| Campo | Valor |
|---|---|
| CNPJ Empresa | `config_lojas.cnpj` da unidade do drill-down (formatado XX.XXX.XXX/XXXX-XX). Se vazio → bloqueia export com toast. |
| Série Título | vazio |
| Nº Título | vazio |
| Nº Parcela | `1` |
| Nº Documento | vazio |
| CNPJ Fornecedor | `entry.cpf` formatado `XXX.XXX.XXX-XX` (igual exemplo) |
| Portador | `2` |
| Data Documento | **primeiro dia do período filtrado** (`dateRange.start`) em `DD/MM/YYYY` |
| Data Vencimento | idem (mesma data) |
| Data Competência | idem (mesma data) |
| Valor Desconto | `0` |
| Valor Multa Atraso | `0` |
| Valor Juros Dia | `0` |
| Valor Original | soma de `entry.valor` do freelancer no período, formato `123,45` (vírgula decimal, sem separador de milhar — igual exemplo `100`) |
| Observações do Título | `FREELANCER {NOME_SEM_ACENTO} - {N} DIA(S) {DD/MM} A {DD/MM}` |
| Cód Conta Gerencial | `272` |
| Cód Centro de Custo | `3` |
| Evento | vazio |
| RFP | vazio |

## Lógica de consolidação
```ts
// agrupar por CPF (normalizado: só dígitos)
// somar valor, contar dias distintos (Set de data_pop)
// pegar nome do primeiro registro
// ordenar por nome ASC
```

## Validações antes do download
- `entries.length > 0` (já bloqueado no componente).
- `dateRange.start` presente → senão toast "Selecione um período para gerar o CSV".
- Todas as entries têm a mesma `loja_id` → senão toast "Selecione uma unidade específica para exportar o CSV" (ERP exige CNPJ único por arquivo). No drill-down isso já é garantido.
- CNPJ da loja presente em `config_lojas` → senão toast "Cadastre o CNPJ da unidade {nome} antes de gerar o CSV". Lookup via `supabase.from('config_lojas').select('cnpj').eq('id', lojaId).single()`.
- Toda entry tem CPF válido (11 dígitos) → entries inválidas são listadas em toast de aviso e **puladas** (não bloqueiam o restante).

## Nome do arquivo
`PAGAMENTO_FREELANCERS_{UNIDADE_SANITIZADA}_{YYYYMMDD_inicio}_{YYYYMMDD_fim}.csv`

## Detalhes técnicos
- Helper `toLatin1Bytes(str: string): Uint8Array` em `paymentCsv.ts` — itera codepoints, mapeia 0x00-0xFF direto, demais via tabela mínima de acentos PT-BR; fallback `0x3F` (`?`).
- Download via `Blob([bytes], { type: 'text/csv;charset=windows-1252' })` + `URL.createObjectURL` (mesmo padrão do `downloadWorkbook`).
- `formatCpfMask`, `formatCnpjMask`, `stripAccents`, `formatBrlPlain` — helpers puros no mesmo arquivo.
- `formatBrlPlain(100)` → `"100"`, `formatBrlPlain(123.45)` → `"123,45"`, `formatBrlPlain(1500)` → `"1500"` (sem milhar, vírgula só se tiver decimal — fiel ao exemplo `100`).

## Fora de escopo
- Não altera schema do banco.
- Não toca em PDF, Excel ou WhatsApp existentes.
- Não cria edge function — geração 100% client-side (formato textual simples).

## Teste manual de aceitação
1. Filtrar 16/05 a 21/05, unidade Parrilla, no drill-down de Freelancers → "Exportar" → "Gerar CSV de Pagamento (Sistema)".
2. Abrir CSV no Excel/Bloco de Notas → header idêntico ao template, datas todas `16/05/2025`, valores consolidados por CPF.
3. Importar no ERP → aceitar sem erro de encoding/coluna.
4. Sem filtro de data → toast de erro.
5. Filtro "todas as lojas" → toast pedindo unidade específica.
