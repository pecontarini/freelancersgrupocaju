## Objetivo

Permitir adicionar freelancer extra escolhendo **qualquer setor cadastrado** da unidade direto no editor de escalas (hoje só dá pra adicionar no setor da aba ativa). A integração com POP do dia e com o lançamento automático em Budget Gerencial **já existe** — só precisa do gatilho de UI.

## O que já está pronto (não precisa mexer)

- Trigger `sync_schedule_to_freelancer_entry` cria/atualiza automaticamente o registro em `freelancer_entries` com `origem='escala'` toda vez que uma escala de freelancer é gravada → aparece sozinho no Budget Gerencial.
- `calculateDailyMetrics` (`src/lib/peakHours.ts`) já soma freelancers na contagem POP de almoço/jantar do dia.
- `FreelancerAddModal` já trata: lookup por CPF, vínculo a employee existente, criação de novo, sem-CPF, taxa, horário, setor compartilhado.

## Mudança de UX

Hoje, no cabeçalho de cada dia da grade (`ManualScheduleGrid.tsx` linhas ~1407 / 1641 / 1655), o botão `+ Freelancer` chama `setFreelancerModal({ open, date })` e o modal usa **fixo** `activeSectorId` (linha 1775).

Vamos:

1. Estender o estado `freelancerModal` para aceitar `sectorId` opcional. Se não vier, modal abre com seletor de setor visível.
2. No `FreelancerAddModal`:
   - Receber lista de setores da unidade (`sectors: {id,name}[]`) e `initialSectorId` opcional.
   - Adicionar um **Select de Setor** no topo do formulário (sempre visível quando há mais de 1 setor disponível).
   - Quando o usuário troca de setor, recarregar `useSectorJobTitles([selectedSectorId])` e resetar `selectedJobTitleId`.
   - O `targetSectorId` passa a vir desse seletor (mantendo a lógica atual de setor compartilhado quando aplicável — checar `useSectorPartner` para o setor escolhido).
3. Manter o atalho atual: clicar no botão dentro de uma aba de setor já vem com aquele setor pré-selecionado, mas o usuário pode trocar.
4. Adicionar opcionalmente um botão `+ Freelancer (qualquer setor)` no cabeçalho geral da semana (ao lado de "Copiar dia anterior") que abre o modal sem setor pré-selecionado, exigindo escolha.

## Arquivos a alterar

- `src/components/escalas/FreelancerAddModal.tsx` — novo seletor de setor + props `sectors`, `initialSectorId`; refazer hook `useSectorJobTitles` para reagir ao setor selecionado; reavaliar parceria via lookup leve.
- `src/components/escalas/ManualScheduleGrid.tsx` — passar `sectors` e `initialSectorId={activeSectorId}` ao modal; estado do modal aceita `sectorId?: string`.

## Comportamento esperado após o ajuste

- Operador clica em `+ Freelancer` em qualquer dia → escolhe setor (ou aceita o pré-selecionado) → preenche CPF / dados → salva.
- A escala aparece imediatamente na grade do setor escolhido.
- O contador POP do dia (almoço/jantar) já reflete o freelancer extra automaticamente (regra de janela ≥2h consecutivas).
- O lançamento aparece automaticamente no Budget Gerencial (`freelancer_entries` com `origem='escala'`) — sem ação adicional.

## Não-objetivos

- Não criar lançamento manual paralelo no Budget Gerencial — o trigger já cobre.
- Não mexer em RLS, contadores POP nem na lógica de pareamento de setores.
