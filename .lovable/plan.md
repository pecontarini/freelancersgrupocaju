## Objetivo
Tornar o formulário "Novo Lançamento Freela" funcional com **Setor** e **Cargo** (baseados nos setores/cargos já cadastrados por unidade) e **remover o campo Gerência**.

## Mudanças

### 1. Banco de dados (migration)
- Adicionar coluna `setor TEXT` em `public.freelancer_entries` (a coluna `funcao` já existe e será reutilizada para o cargo).
- Nenhuma alteração em RLS/GRANTs (tabela já configurada).

### 2. Formulário `src/components/FreelancerForm.tsx`
- **Remover** o campo Gerência (label, Select, validação, auto-fill via CPF).
- **Adicionar** dois selects encadeados após "Loja":
  - **Setor** — obrigatório. Lista os setores da unidade selecionada (`sectors` filtrados por `unit_id = loja_id`).
  - **Cargo** — obrigatório. Lista `job_titles` da unidade filtrados pelos vínculos em `sector_job_titles` para o setor escolhido. Desabilitado até o setor ser selecionado; limpa ao trocar de setor/loja.
- Persistir em `setor` e `funcao` no insert.
- Manter auto-preenchimento por CPF apenas para `nome_completo` e `chave_pix` (remover branch de gerência).

### 3. Hook `src/hooks/useFreelancerEntries.ts`
- Adicionar `setor` e `funcao` no tipo e no payload de `createEntry`; incluir na leitura para os listagens/filtros.

### 4. Exibição e exports
- `EntriesTable.tsx` / `MobileFreelancerCard.tsx`: substituir coluna/linha "Gerência" por "Setor" + "Cargo".
- `EditFreelancerDialog.tsx`: mesmos ajustes (remover Gerência, adicionar Setor/Cargo encadeados).
- `FreelancerFilters.tsx`: substituir filtro de Gerência por filtros multi-select de Setor e Cargo (mantendo Motivo/Substitui já existentes).
- `ExportReportButton` (Excel) e o PDF equivalente: trocar coluna Gerência por Setor e Cargo; atualizar aba de Recorrência para incluir "Cargos mais recorrentes" e "Setores mais recorrentes".
- Dados legados com `gerencia` preenchida continuam no banco (não vamos apagar), apenas deixam de aparecer no fluxo novo.

### 5. Fontes de dados já disponíveis
- Setores: hook `useSetores` / query direta em `sectors` por `unit_id`.
- Cargos por setor: `job_titles` + `sector_job_titles` (hook `useSectorJobTitles` já existente).

## Detalhes técnicos
- Selects ficam desabilitados enquanto carregam; ao mudar `loja_id`, resetar `setor` e `funcao`; ao mudar `setor`, resetar `funcao`.
- Validação Zod: `setor: z.string().min(1)`, `funcao: z.string().min(1)`; remover `gerencia`.
- Nenhuma mudança em auth/RLS.

## Fora do escopo
- Migrar dados históricos de `gerencia` para `setor`.
- Alterar telas de escala, check-in ou outras que consumam `freelancer_entries`.