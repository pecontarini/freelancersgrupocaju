

# Plano: Cadastrar funcionários não encontrados durante a importação de escala

## Problema
Hoje, quando a planilha contém nomes que não estão cadastrados no sistema, eles aparecem como "não encontrados" e são ignorados. O usuário precisa ir manualmente à tela de equipe, cadastrar cada um, e reimportar. Isso gera retrabalho.

## Solução
Transformar a seção de "funcionários não encontrados" em uma **etapa de confirmação interativa**: para cada nome não reconhecido, o usuário pode marcar um checkbox para cadastrá-lo automaticamente na unidade antes de confirmar a importação. O cargo lido da planilha será usado para criar/vincular o `job_title`.

## Mudanças

### 1. `ScheduleExcelFlow.tsx` — UI de cadastro inline
- Substituir a lista passiva de nomes não encontrados por uma lista com **checkbox** para cada um
- Cada item mostra: nome, cargo (da planilha), e um toggle "Cadastrar agora"
- Permitir editar o nome antes de salvar (caso a planilha tenha abreviações)
- Ao confirmar importação, antes de salvar as escalas:
  1. Para cada funcionário marcado: upsert o cargo via `job_titles` e inserir o employee na tabela `employees`
  2. Re-parsear a planilha com os novos employees incluídos na lista
  3. Prosseguir com o salvamento normal das escalas

### 2. `ScheduleExcelFlow.tsx` — Lógica de auto-cadastro
- Adicionar estado `selectedUnmatched: Set<number>` (índices dos unmatched a cadastrar)
- Receber `unitId` como prop (já disponível no ManualScheduleGrid como `selectedUnit`)
- Na confirmação, para cada unmatched selecionado:
  - Chamar `supabase.from("job_titles")` upsert com `{ name: cargo, unit_id }`
  - Chamar `supabase.from("employees").insert({ name, unit_id, job_title, job_title_id, gender: "M", worker_type: "clt" })`
- Após cadastrar todos, re-executar o parse com a lista atualizada de employees
- Só então salvar as escalas

### 3. `ManualScheduleGrid.tsx` — Passar `unitId`
- Adicionar prop `unitId={selectedUnit}` ao `<ScheduleExcelFlow>`

### 4. `ScheduleExcelFlowProps` — Nova prop
- Adicionar `unitId: string` à interface

## Arquivos impactados

| Arquivo | Ação |
|---------|------|
| `src/components/escalas/ScheduleExcelFlow.tsx` | UI interativa + lógica de cadastro |
| `src/components/escalas/ManualScheduleGrid.tsx` | Passar unitId como prop |

## Resultado
- Funcionários novos da planilha são cadastrados com um clique durante a importação
- Nas próximas importações, esses nomes já serão reconhecidos automaticamente
- Zero retrabalho para o usuário

