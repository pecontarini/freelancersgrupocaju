# Corrigir “Turno não salvo” no Editor de Escalas

## Diagnóstico confirmado

O editor sempre procura um registro-base em `shifts` antes de gravar a escala. Hoje existem apenas os turnos **Almoço** e **Jantar** vinculados ao tenant legado; a regra de isolamento impede os administradores da Stutz de enxergá-los. Por isso `resolveShiftId()` não encontra nenhum registro e interrompe a gravação com **“Nenhum turno cadastrado”**, exatamente como aparece na imagem.

## Implementação

1. **Disponibilizar turnos-base para a Stutz**
   - Criar, por migration, os turnos canônicos **Almoço** e **Jantar** associados ao tenant Stutz.
   - Fazer a inserção de forma idempotente, sem duplicar registros se a migration for reaplicada.

2. **Tornar a resolução de turno segura para múltiplas empresas**
   - Ajustar `resolveShiftId()` para buscar o tipo solicitado dentro dos registros visíveis do tenant ativo.
   - Preservar o fallback somente entre turnos acessíveis e retornar uma mensagem operacional clara caso a empresa realmente não tenha configuração.
   - Manter os horários livres digitados no editor, inclusive jornadas que viram a madrugada; o registro-base não substituirá `start_time`, `end_time` nem o intervalo informado.

3. **Garantir novos clientes**
   - Revisar o fluxo de criação de empresa para provisionar os dois turnos-base junto com o tenant, evitando o mesmo bloqueio em clientes futuros.

4. **Validar o fluxo real**
   - Entrar com uma sessão administrativa da Stutz e salvar um turno comum.
   - Salvar o caso da imagem: **19:00–07:00, intervalo de 120 minutos**, confirmando jornada efetiva de 10h e indicador `+1d`.
   - Reabrir a célula e conferir no banco empresa, funcionário, setor, início, fim e intervalo persistidos corretamente.
   - Confirmar separadamente que um usuário sem acesso à unidade continua impedido pela política de segurança.

## Arquivos e backend envolvidos

- `src/hooks/useManualSchedules.ts`: resolução do `shift_id` e gravação da escala.
- Migration do banco: provisionamento idempotente dos turnos da Stutz.
- Função de criação de tenant, somente se a leitura confirmar que ela ainda não provisiona `shifts`.
