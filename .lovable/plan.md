

# Plano: Parser dedicado para planilhas "Listagem de Funcionários" (Rel090N2)

## Contexto

As 3 planilhas enviadas seguem o mesmo layout padrao do sistema de RH da empresa (relatorio "Rel090N2"):
- Colunas: Matrícula, Nome do Funcionário, Cargo, Escala, Data Nasc., Data Adm., **Data Desl.**, Horário
- Linhas de ruído: "Tomador:", "Setor:", "Total no Setor:", "Total no Tomador:", cabeçalhos repetidos, linhas vazias
- Funcionários com **Data Desl.** preenchida são **desligados** e devem ser excluídos
- Formato .xls (binário legado), que o SheetJS consegue ler

O parser local atual (`parseSpreadsheetLocally`) falha porque:
1. Procura headers na primeira linha, mas neste layout os headers estão na linha 5-6
2. Não filtra linhas de totais e seções
3. Não exclui desligados

## Solução

Criar uma função `parseRel090N2` no `BulkImportTab.tsx` que detecta e processa este layout específico. O fluxo existente (`parseSpreadsheetLocally`) tentará primeiro o parser padrão; se falhar (coluna de nome não encontrada), tentará o parser Rel090N2 antes de cair no fallback de IA.

## Mudanças em `src/components/escalas/BulkImportTab.tsx`

### 1. Nova função `parseRel090N2(workbook)`
- Percorre todas as linhas procurando o header que contém "Matrícula" + "Nome do Funcionário" + "Cargo"
- Identifica os índices das colunas: nome, cargo, data desligamento
- Itera as linhas seguintes, ignorando:
  - Linhas com "Total no", "Tomador:", "Setor:" 
  - Linhas vazias ou com nome < 3 caracteres
  - **Funcionários com Data Desl. preenchida** (desligados)
- Normaliza nomes com Capitalize Each Word
- Retorna `ParsedEmployee[]`

### 2. Atualizar `parseSpreadsheetLocally`
- Após o `XLSX.read`, antes de tentar o parser genérico, checar se alguma linha contém "LISTAGEM DE FUNCIONÁRIOS" ou "Rel090N2"
- Se sim, desviar para `parseRel090N2(workbook)` 
- Se não, manter o fluxo genérico atual

### 3. Zero mudanças no backend
- Não precisa de IA nem Edge Function — o SheetJS lê .xls localmente
- Não precisa de migração de banco

## Lógica de filtragem de desligados

```text
Se coluna "Data Desl." tem valor → funcionário desligado → IGNORAR
Se coluna "Data Desl." vazia → funcionário ativo → IMPORTAR
```

## Resultado esperado
- Usuário faz upload do .xls no "Importação em Massa" nas Escalas
- O sistema detecta o formato Rel090N2, extrai apenas os ativos com nome e cargo
- Exibe a tabela de revisão normalmente, pronta para confirmar

## Arquivos editados
| Arquivo | Mudança |
|---------|---------|
| `src/components/escalas/BulkImportTab.tsx` | Adicionar `parseRel090N2` e integrar na detecção de formato |

