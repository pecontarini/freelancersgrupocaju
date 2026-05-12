/**
 * Templates aprovados para disparo via WhatsApp.
 * V3 — aprovada em 12/05/2026 (chat #2007).
 * Não modificar sem nova aprovação escrita.
 */

export const PIX_UPDATE_MESSAGE_V3 = (params: {
  nome: string;
  link: string;
}) => {
  const primeiroNome = params.nome.trim().split(/\s+/)[0] || params.nome;
  return `Olá, ${primeiroNome}!

Aqui é a equipe do Grupo Cajupar. Para garantir que seus pagamentos como freelancer continuem sendo processados sem atraso, precisamos confirmar seus dados PIX.

É rápido — toque no link abaixo, confira sua chave PIX e atualize se for o caso:

${params.link}

Importante:

- A chave PIX precisa estar no seu nome (CPF, e-mail ou telefone).
- PIX em nome de terceiros não será processado.
- O link expira em 7 dias.

Qualquer dúvida, é só responder por aqui.

Obrigado!
Grupo Cajupar`;
};
