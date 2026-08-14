# Resolver acesso da Fran (fracimara.angelo@stutzfood.com.br)

## O que os dados mostram

- A conta existe, e-mail confirmado, e já entrou uma vez em 14/08 às 13:07 (uso do link de convite).
- A conta já tem senha gravada, então o convite original não serve mais para definir senha.
- Não há token de recuperação pendente para ela: os pedidos de "esqueci a senha" feitos hoje (14/08, 14:06 e 14:07) foram aceitos pelo backend, mas não geraram token ativo na conta dela — indício de que o e-mail de recuperação não chega (envio de e-mail do projeto não está ativo) ou o pedido foi feito com e-mail digitado diferente.

Conclusão: o caminho de "redefinir senha por e-mail" não é confiável hoje. A saída imediata é definir a senha dela diretamente (ação de super admin já existente) e entregar a senha provisória.

## O que será feito

1. Definir uma senha provisória para fracimara.angelo@stutzfood.com.br usando a ação protegida de super admin (`set_password`), com e-mail já confirmado.
2. Conferir que ela continua com o papel de Gerente de Unidade e acesso apenas à unidade SANTA LUCIA NORTE.
3. Validar o login de ponta a ponta com a senha provisória no app publicado, confirmando que o portal abre na unidade correta.
4. Entregar aqui no chat a senha provisória para você repassar, com orientação para ela trocar depois em Perfil.

## Ajuste de robustez (opcional, mesmo turno)

- Na tela de recuperação de senha, exibir mensagem clara quando o pedido é aceito mas o e-mail pode não chegar, orientando a pedir senha provisória ao administrador — evita que outros usuários fiquem presos no mesmo ponto.

## Detalhes técnicos

- Ação via edge function existente `admin-invite-tenant-user` com `action: "set_password"` (restrita a super admin); nenhuma mudança de schema.
- Verificação de papéis em `user_roles` e de unidades em `user_stores`.
- A senha provisória não será registrada em logs nem em código.
