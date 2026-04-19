

## Diagnóstico

O auto-preenchimento por CPF no editor de escalas usa o **mesmo hook** (`lookupUnifiedByCpf`) do Budget Gerencial. O fluxo está correto. O problema raiz é de **dados + permissão**:

1. **`freelancer_profiles`** (tabela "rica" com nome, telefone, PIX): pública para leitura, mas **a maioria dos freelancers cadastrados via Budget nunca foi escrita aqui**. Está vazia para esses CPFs.
2. **`employees`** (worker_type=freelancer): só tem freelancers que já foram escalados manualmente — ainda não cobre os CPFs em questão.
3. **`freelancer_entries`** (histórico de Budget Gerencial): tem milhares de registros, mas **bloqueado por RLS por loja**. Quando o gestor da Loja A tenta escalar um freelancer que só rodou nas Lojas B/C, o lookup volta vazio.

No Budget Gerencial o auto-preenchimento "funciona" porque o gestor sempre lança em sua própria loja, então só precisa do histórico local — a RLS deixa passar.

## Solução

Preciso de 2 mudanças combinadas para garantir paridade com o Budget e cobrir freelancers cross-loja:

### 1) Backfill: popular `freelancer_profiles` a partir de `freelancer_entries`

Migration única que copia para `freelancer_profiles` os dados consolidados (mais recentes) de cada CPF em `freelancer_entries`:
- Para cada CPF distinto, pega o registro mais recente: `nome_completo`, `chave_pix`.
- `INSERT ... ON CONFLICT (cpf) DO NOTHING` — não sobrescreve perfis já preenchidos manualmente.
- Como `freelancer_profiles` é público, isso resolve o lookup global.

### 2) RPC pública `lookup_freelancer_by_cpf`

Function `SECURITY DEFINER` que busca em `freelancer_entries` ignorando RLS, retornando apenas dados não-sensíveis (nome, função, gerência, chave_pix) do registro mais recente do CPF. O hook `useCpfLookup` passa a chamar essa RPC como **fallback** quando a busca direta retorna vazio. Isso cobre futuros CPFs novos lançados em outras lojas, sem depender do backfill.

### 3) Ajuste no `useCpfLookup`

No `lookupUnifiedByCpf`, adicionar 4ª camada (após as 3 atuais): chamar `supabase.rpc('lookup_freelancer_by_cpf', { p_cpf: cleanCpf })`. Mantém o mesmo formato de retorno (`UnifiedLookupResult`) com source `"freelancer_entries"`.

### 4) Garantir que novos cadastros via Budget também populem `freelancer_profiles`

No `createEntry` do `useFreelancerEntries`, fazer `upsert` simultâneo em `freelancer_profiles` com o CPF, nome e PIX (sem sobrescrever telefone se já existir). Assim, o cadastro futuro fica disponível globalmente para o editor de escalas sem depender de RLS.

## Arquivos

- **Migration nova**: backfill `freelancer_profiles` + criar RPC `lookup_freelancer_by_cpf` (SECURITY DEFINER, retorna registro mais recente).
- **`src/hooks/useCpfLookup.ts`**: adicionar 4ª camada de busca via RPC.
- **`src/hooks/useFreelancerEntries.ts`**: no `createEntry`, fazer upsert paralelo em `freelancer_profiles`.

## Validação

- Abrir editor de escalas → "+ Freelancer extra" → digitar CPF `086.942.831-40` (Gabriel) → nome, função e PIX devem preencher automaticamente.
- Cadastrar um freelancer novo via Budget Gerencial → ir ao editor de escalas em outra loja → o CPF deve ser reconhecido imediatamente.
- Confirmar que o destaque verde aparece nos campos preenchidos (mesma UX do Budget).

## Sem mudanças de UX

A interface não muda — só a busca passa a encontrar mais resultados.

