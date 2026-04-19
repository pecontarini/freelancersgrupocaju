

## Diagnóstico do erro

Erro: `duplicate key value violates unique constraint "unique_active_schedule"`

**Constraint envolvida:** índice único parcial em `schedules (employee_id, schedule_date, sector_id) WHERE status <> 'cancelled'`.

**Causa real (vista no `ScheduleExcelFlow.tsx` linhas 327–359):**
A deduplicação atual compara as linhas da planilha **contra o que já existe no banco**, mas **não deduplica linhas duplicadas dentro do próprio arquivo Excel**. Quando a planilha do usuário tem o mesmo funcionário aparecendo duas vezes na mesma data/setor (caso comum em Excel multi-aba quando o funcionário foi listado em duas abas de setor, ou quando há linhas repetidas no template), o `insert(newRows)` envia 2 linhas idênticas no mesmo batch e o Postgres rejeita tudo.

Confirmei via query SQL: não há duplicatas atuais no banco para a semana 20–26/04 nessa unidade. Logo, a duplicação está **dentro do arquivo enviado**.

## Plano de correção

### 1) Deduplicação intra-batch (correção principal)
Em `src/components/escalas/ScheduleExcelFlow.tsx`, antes do filtro `existingKeys`, adicionar uma deduplicação interna:
- Percorrer `rows` mantendo um `Map<string, row>` com chave `${employee_id}|${schedule_date}|${sector_id}`.
- Se a mesma chave aparecer 2x, manter a **última ocorrência** (sobrescreve) e contar quantas foram colapsadas.
- Toast informativo: *"N linha(s) duplicada(s) na planilha foram unificadas."*

### 2) Mensagem de erro mais clara (defesa em profundidade)
Caso o erro ainda ocorra (corrida com outro usuário inserindo simultaneamente, por exemplo), trocar o toast genérico por uma mensagem orientativa: *"Existem escalas conflitantes para esta semana. Use 'Zerar Escalas' antes de reimportar, ou ajuste manualmente."*

### 3) Aplicar a mesma proteção em `useImportEscalas` (se existir caminho paralelo)
Vou conferir se há outro fluxo de import além do `ScheduleExcelFlow.tsx` que faça `insert` em batch — se houver, replico a deduplicação lá também.

### Como o usuário deve proceder agora (sem mudar código)
Enquanto o ajuste não é aplicado, o usuário pode:
1. **Zerar Escalas** da semana 20–26/04 dessa unidade (botão laranja "Zerar Escalas" no topo do Editor).
2. Abrir o arquivo Excel e verificar se algum funcionário aparece em **mais de uma aba/setor** na mesma data — remover a duplicata.
3. Reimportar.

### Arquivo a editar
- `src/components/escalas/ScheduleExcelFlow.tsx` — adicionar dedup intra-batch e melhorar mensagem.

### Validação que farei
- Importar planilha com linha duplicada propositalmente → confirma que importa apenas 1 e mostra toast informativo.
- Importar planilha limpa → comportamento normal.
- Reimportar a mesma planilha (já existente no banco) → ignora corretamente como antes.

