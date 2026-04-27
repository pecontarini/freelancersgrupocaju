## Diagnóstico

O erro **"Nenhum cargo vinculado a este setor"** + toast **"Selecione um cargo"** aparece porque o modal `FreelancerAddModal` só lista cargos que estão em `sector_job_titles` (relação setor ↔ cargo). Quando o setor (ex: AUXILIAR DE BAR, AUX. SUSHIMAN) não tem nenhum cargo vinculado, o usuário trava — não consegue salvar e não tem ação rápida para criar/vincular um cargo sem sair da escala.

Hoje, a única forma de resolver é fechar o modal, ir em **Configurações → Vinculação de Cargos por Setor**, criar/vincular o cargo e voltar. Vamos eliminar esse atrito.

## O que será feito

### 1. Botão "+" ao lado do seletor de Cargo no `FreelancerAddModal`
- Quando há cargos vinculados → botão `+` discreto ao lado do `Select` para adicionar um novo cargo já vinculado ao setor.
- Quando não há nenhum cargo vinculado → substituir a mensagem "Nenhum cargo vinculado a este setor" por um **CTA primário "+ Criar e vincular cargo"** (mais convidativo).

### 2. Mini-dialog `QuickCreateJobTitleDialog`
Diálogo leve (dentro do próprio modal de freelancer) com:
- **Combobox** dos cargos já existentes na unidade (vindos de `useJobTitles(unitId)`) que **ainda não estão vinculados** ao setor → permite vincular um cargo existente em 1 clique.
- Campo "**Criar novo cargo**" (input de texto) — usa `useUpsertJobTitle` (idempotente por nome+unidade).
- Botão **"Vincular ao setor"** que:
  1. Cria o cargo se for novo (via `useUpsertJobTitle`).
  2. Chama uma nova mutação `useAddSectorJobTitle` (insert único em `sector_job_titles`, sem apagar os existentes — diferente do `useSetSectorJobTitles` que faz delete+insert).
  3. Invalida `["sector_job_titles"]` e `["job_titles"]`.
  4. **Pré-seleciona automaticamente** o cargo recém-criado no `Select` do modal pai.

### 3. Nova mutação `useAddSectorJobTitle` em `useSectorJobTitles.ts`
```ts
export function useAddSectorJobTitle() {
  // insert { sector_id, job_title_id } com onConflict: ignore
  // invalida ["sector_job_titles"]
}
```
Mantém o `useSetSectorJobTitles` existente intacto (continua usado pela tela de configuração para edição em massa).

### 4. Permissão
O botão "+" só aparece para usuários com permissão de gerência/admin (mesma regra que controla acesso ao TeamManagement). Operadores comuns continuam vendo o estado atual. Vou usar o hook `useUserProfile` para checar `role`.

## Arquivos a alterar
- `src/hooks/useSectorJobTitles.ts` — adicionar `useAddSectorJobTitle`.
- `src/components/escalas/FreelancerAddModal.tsx` — botão "+", CTA quando vazio, abrir mini-dialog, auto-selecionar cargo após criação.
- `src/components/escalas/QuickCreateJobTitleDialog.tsx` (novo) — componente reutilizável.

## Resultado esperado
Na situação da imagem (setor sem cargos vinculados), o usuário verá um botão **"+ Criar e vincular cargo"** dentro do próprio modal "Freelancer extra". Em 2 cliques ele cria/vincula o cargo (ex: "Auxiliar de Bar"), o `Select` é populado e pré-selecionado, e o usuário consegue escalar o freelancer sem fechar nada.