## Objetivo

Garantir que a importação em massa (PDF/Excel/CSV/Imagem) na aba Escalas → Importar Equipe **nunca crie pessoas duplicadas** dentro da unidade. Idênticos são ignorados sozinhos; só os parecidos pedem decisão.

## Regra de match

Para cada linha extraída do arquivo, comparar com os funcionários ativos da unidade nesta ordem:

1. **CPF (quando houver dos dois lados)** → match definitivo. Marca como "Já existe".
2. **Nome+cargo normalizados idênticos** (sem acento, espaços colapsados, minúsculo) → "Já existe".
3. **Similaridade de nome ≥ 0,85** (Levenshtein normalizado, via `src/lib/fuzzyMatch.ts`) → "Possível duplicado de **X**" (amarelo, requer decisão).
4. Nada bate → "Novo".

Também detecta duplicado **dentro do próprio arquivo** (mesma pessoa listada 2× no PDF) — primeira ocorrência vira "Novo", as demais viram "Já existe (no arquivo)".

## Comportamento padrão

- **"Já existe"** → ignorado automaticamente (checkbox desmarcado, cinza).
- **"Possível duplicado"** → linha em amarelo com select inline: **Mesclar com X** (não cria, futuro UPDATE) / **Criar mesmo assim** (xará legítimo) / **Ignorar**. Padrão: Ignorar.
- **"Novo"** → marcado para criar (verde).

Nesta primeira versão, "Mesclar" tem o mesmo efeito prático de "Ignorar" (não cria registro novo, mantém o existente). Atualizar telefone/cargo do existente fica como melhoria futura.

## Mudanças de UI no `BulkImportTab.tsx`

1. Após o parse, carregar `useEmployees(unitId)` e rodar `classifyImportRows()` antes de exibir a grade.
2. Header de resumo: `12 novos · 3 já cadastrados · 2 para revisar`.
3. Nova coluna **Status** com chip colorido + nome do candidato quando houver match parecido.
4. Nas linhas "Possível duplicado", select inline (Ignorar / Mesclar / Criar novo).
5. `handleConfirm` só insere as linhas marcadas como "Novo" ou "Criar novo"; pula "Já existe" e "Mesclar/Ignorar".
6. Toast final detalhado: `8 criados · 5 ignorados (já existiam) · 1 erro`.
7. Manter os warnings amarelos atuais de baixa confiança da IA (independentes do dedup).

## Detalhes técnicos

- Novo arquivo: `src/lib/escalas/employeeDedup.ts` — funções puras `normalizeName`, `normalizeCpf`, `classifyImportRows(parsed, existingEmployees)` retornando `{ row, status, candidate, decision }`. Permite teste isolado.
- Reaproveitar `src/lib/fuzzyMatch.ts` (já existe) para a similaridade.
- Usar `useEmployees(unitId)` (já existe) para buscar os ativos da unidade.
- Constraint `unique_active_employee_no_cpf` no banco continua como rede de segurança final — sem mudança de schema.
- Arquivos afetados:
  - `src/components/escalas/BulkImportTab.tsx` (UI + fluxo)
  - `src/lib/escalas/employeeDedup.ts` (novo)

## Fora de escopo

- Mesclar/atualizar dados de funcionários já existentes (telefone, cargo) — fica para próxima iteração.
- Limpeza de duplicados que já estão no banco hoje.
- Outros importadores (utensílios, freelancers via check-in, escalas Excel).
- Mudanças no schema do banco.
