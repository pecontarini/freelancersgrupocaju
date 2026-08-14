# Criar 4 acessos na Stutz

## Usuários e permissões

| Email | Permissão | Unidades |
|---|---|---|
| denise.amorim@stutzfood.com.br | Admin da Stutz | todas as 9 unidades |
| lucas.victor@stutzfood.com.br | Gerente de Unidade | CPA, BALI PARK, MUNDIAL, MASTER SP, VITRAL |
| fernanda.mendonca@stutzfood.com.br | Gerente de Unidade | HSLG |
| fracimara.angelo@stutzfood.com.br | Gerente de Unidade | SANTA LUCIA NORTE |

## O que será feito

1. Criar as 4 contas de login (sem senha definida) e vincular todas ao tenant Stutz.
2. Atribuir a permissão de cada uma: admin para Denise, gerente de unidade para os outros três.
3. Restringir o acesso de Lucas, Fernanda e Fracimara apenas às unidades da tabela acima.
4. Gerar um link de convite individual para cada pessoa definir a própria senha, apontando para o app publicado (board2.lovable.app), e entregar os 4 links aqui no chat para você repassar.

## Detalhes técnicos

- Criação/convite via a edge function existente `admin-invite-tenant-user` (cria usuário, vincula em `user_tenants` e gera `action_link` do tipo invite com redirect para `/auth?invite=1`).
- Papéis gravados em `user_roles` (`admin` / `gerente_unidade`); nenhum papel em tabela de perfil.
- Vínculo de unidades gravado em `user_stores` com os IDs das lojas do tenant Stutz.
- Nenhuma alteração de schema é necessária; apenas dados.

## Observações

- Links de convite expiram; se alguém não usar em tempo, dá para regerar o link ou definir senha provisória pela tela `/admin/tenants`.
- Nenhuma mudança de UI neste trabalho.
