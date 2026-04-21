
## Plano de correção 100% — Escalas via modelo e exportação Excel

### Problema real
Hoje existem **dois problemas ainda não encerrados**:

1. **Importação continua falhando com `unique_active_schedule`**
   - O código atual já tenta deduplicar e retry, mas o usuário ainda recebe o toast genérico de conflito.
   - Isso indica uma destas situações:
     - a versão publicada ainda não está refletindo integralmente o fix;
     - o erro está vindo em um formato diferente do esperado pelo branch atual;
     - ainda existe um caso de conflito não coberto antes do `insert`.

2. **Exportação Excel ainda quebra**
   - O ajuste de import do `xlsx-js-style` já foi feito, então o problema restante provavelmente está no **processo de geração do workbook** e não só no import do pacote.
   - Em `scheduleMasterExport.ts` ainda há risco de erro por:
     - **nome de aba inválido** para Excel (`[]:*?/\\`);
     - **nomes duplicados/truncados** ao limitar a 31 caracteres;
     - erro silencioso em alguma etapa de fetch/montagem/download sendo mascarado pelo toast genérico.

### Objetivo
Eliminar o erro na importação e na exportação com:
- tratamento de conflito realmente idempotente;
- mensagens acionáveis;
- export robusto mesmo com nomes de setores problemáticos;
- validação explícita no preview e no publicado.

---

## Frente 1 — Blindar a importação até ficar realmente idempotente

### 1.1 Reforçar o filtro pré-insert
Em `src/components/escalas/ScheduleExcelFlow.tsx`:

- manter a dedup atual por:
  - `(employee_id, date, sector_id)`;
  - `(employee_id, date)`;
- adicionar uma etapa explícita de **detecção de conflitos restantes por lote**, construindo uma lista legível antes do `insert`;
- separar em memória:
  - `rowsToInsert`
  - `rowsIgnoredExisting`
  - `rowsBlockedConflict`

Assim o import não depende só do erro do banco para explicar o problema.

### 1.2 Tornar o branch de erro 23505 mais abrangente
Hoje o código só reconhece alguns formatos do erro. Ajustar para capturar também:
- `error.code === "23505"`
- `error.message`
- `error.details`
- `error.hint`
- `error.error_description`
- qualquer texto contendo `unique_active_schedule`

Isso garante que o usuário nunca mais veja só o texto cru do banco.

### 1.3 Retry realmente defensivo
Depois do primeiro `insert` com falha:
- recarregar schedules existentes;
- recalcular os conflitos;
- tentar novamente só com o subconjunto ainda inserível;
- se persistir, mostrar a lista dos nomes/datas que bloquearam.

### 1.4 Ação direta para resolver
Aproveitar a lógica já existente de limpeza em massa e acoplar ao fluxo de import:
- botão/ação “**Zerar semana e reimportar**” para a mesma unidade/semana;
- reaproveitar o arquivo já em memória;
- reexecutar o `handleConfirmImport` sem o usuário precisar começar tudo de novo.

---

## Frente 2 — Melhorar a usabilidade do erro de importação

### Em `src/components/escalas/ScheduleExcelFlow.tsx`
Substituir o erro genérico por retorno operacional:

- mostrar até 5 conflitos com:
  - nome do funcionário;
  - data;
  - setor, quando disponível;
- sucesso com resumo:
  - `X importados`
  - `Y já existiam`
  - `Z conflitos resolvidos`
  - `W ignorados por conflito`

Também manter os erros de parsing separados dos erros de banco, para não misturar:
- “horário inválido”;
- “conflito com escala já existente”.

---

## Frente 3 — Corrigir a exportação Excel na geração do workbook

### 3.1 Sanitizar e deduplicar nomes de abas
Em `src/lib/scheduleMasterExport.ts`:

Criar helper de nome seguro para abas:
- remover caracteres inválidos de Excel: `: \ / ? * [ ]`
- normalizar espaços
- truncar para 31 chars
- garantir unicidade com sufixo automático quando houver colisão:
  - `ATENDIMENTO`
  - `ATENDIMENTO (2)`

Isso elimina uma causa clássica de falha silenciosa em export.

### 3.2 Quebrar a exportação em etapas com erros específicos
Ainda em `scheduleMasterExport.ts`, separar e nomear falhas:
- erro ao buscar setores;
- erro ao buscar escalas;
- erro ao montar aba do setor X;
- erro ao montar “Resumo Geral”;
- erro ao gerar arquivo para download.

Assim o toast deixa de ser “Erro ao exportar escala” e passa a apontar exatamente o estágio quebrado.

### 3.3 Validar a etapa de download
Em `src/components/escalas/MasterExportButton.tsx`:
- manter `console.error`;
- melhorar o toast com mensagem vinda do estágio real;
- se necessário, envolver `downloadWorkbook` com try/catch local para separar:
  - geração do workbook;
  - disparo do download.

### 3.4 Padronizar robustez do workbook
Revisar `scheduleMasterExport.ts` para:
- garantir `!merges`, `!ref`, `!cols`, `!rows` coerentes por aba;
- evitar qualquer referência fora do range final;
- garantir que “Resumo Geral” nunca colida com alguma aba de setor.

---

## Frente 4 — Garantir que preview e publicado estão alinhados

O print anexado é do domínio publicado. Então a correção precisa validar explicitamente:

- **preview**
- **publicado**

Se o preview estiver correto e o publicado não:
- revisar o caminho real usado na tela publicada;
- confirmar que o fluxo chama os arquivos já corrigidos:
  - `ScheduleExcelFlow.tsx`
  - `MasterExportButton.tsx`
  - `scheduleMasterExport.ts`

Se houver divergência, ajustar o fluxo para que a mesma tela/mesmo botão usem a implementação corrigida em ambos os ambientes.

---

## Arquivos principais
- `src/components/escalas/ScheduleExcelFlow.tsx`
- `src/lib/scheduleMasterExport.ts`
- `src/components/escalas/MasterExportButton.tsx`

### Arquivos de apoio para conferência
- `src/lib/excelUtils.ts`
- `src/lib/scheduleExcel.ts`
- `src/components/escalas/ManualScheduleGrid.tsx`

---

## Validação obrigatória

### Importação
1. Importar a mesma semana já existente na unidade que está falhando.
   - Resultado esperado:
     - sem toast cru do banco;
     - resumo claro de importados/ignorados/conflitos.
2. Reimportar imediatamente o mesmo arquivo.
   - Resultado esperado:
     - zero duplicação;
     - comportamento idempotente.
3. Forçar conflito real.
   - Resultado esperado:
     - nomes e datas listados;
     - ação para limpar semana e reimportar.

### Exportação Excel
1. Exportar em unidade com vários setores.
   - Arquivo deve baixar e abrir normalmente.
2. Exportar em unidade com nomes de setores longos ou parecidos.
   - Nenhuma falha por nome de aba.
3. Conferir abas:
   - todos os setores presentes;
   - “Resumo Geral” presente;
   - sem corrupção no Excel/LibreOffice.

### Paridade
- testar no preview e no publicado para confirmar que o usuário final não ficou preso numa versão antiga do fluxo.

## Resultado esperado
- Importação por modelo fica segura, repetível e explicável.
- Exportação Excel deixa de falhar por workbook/aba.
- O usuário deixa de ver erro técnico cru e passa a ter saída prática para resolver na hora.
