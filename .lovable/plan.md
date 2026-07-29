## Objetivo
Permitir que o horário final seja menor que o inicial (turno que vira a noite), sem bloquear o envio da solicitação pública de freelancer.

## Diagnóstico
A única trava é no frontend, em `src/pages/SolicitarFreela.tsx` (linha 134): `if (horaFim <= horaInicio)` exibe erro e cancela o envio. A função do banco `create_public_freelancer_request` apenas valida que os campos não sejam nulos — não compara os horários. Não há constraint de horário na tabela.

## Mudanças

1. **Remover a trava de horário** em `SolicitarFreela.tsx`: eliminar a comparação `horaFim <= horaInicio`, mantendo apenas a validação de campos obrigatórios. Bloquear somente o caso de horários exatamente iguais (duração zero).

2. **Sinalizar visualmente o turno noturno**: quando `horaFim < horaInicio`, exibir junto ao campo "Horário final" um aviso discreto do tipo "vira o dia — termina no dia seguinte", para o solicitante confirmar que é intencional.

3. **Texto do WhatsApp**: no resumo compartilhado, quando o turno virar o dia, o horário aparece como `22:00 às 06:00 (dia seguinte)`.

4. **Exibição no painel**: em `src/components/freelancer/SolicitacoesPendentes.tsx`, acrescentar o marcador "+1d" ao intervalo quando o fim for menor que o início, para os gerentes lerem corretamente.

## Detalhes técnicos
Sem migração de banco: as colunas `hora_inicio`/`hora_fim` são do tipo `time` e aceitam qualquer par de valores. Alteração restrita a frontend/apresentação.
