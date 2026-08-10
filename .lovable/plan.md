# Corrigir definição de senha dos usuários da Stutz

## Diagnóstico confirmado

- O botão de chave está renderizado e habilitado na lista de usuários.
- Ao clicar, a tela depende de `window.prompt` para capturar a nova senha.
- Esse diálogo nativo pode ser bloqueado no ambiente de prévia/incorporado; quando isso ocorre, nenhuma solicitação de definição de senha chega ao backend.
- A função administrativa já possui a ação protegida `set_password`, restrita a super administradores; o problema principal está na abertura e condução do formulário na interface.

## Implementação

1. Substituir o `window.prompt` por um modal do próprio aplicativo ao clicar no botão de chave.
2. Exibir no modal o nome/e-mail do usuário selecionado, campos de **nova senha** e **confirmar senha**, opção de mostrar/ocultar e validação mínima antes do envio.
3. Manter o modal aberto durante o processamento, impedir envios duplicados e mostrar a mensagem real retornada pelo backend em caso de falha.
4. Ao concluir, fechar e limpar o formulário, confirmar visualmente que a senha foi definida e que o e-mail está confirmado.
5. Melhorar o tratamento da resposta da função para não reduzir erros úteis a uma mensagem genérica de “Edge Function”.

## Validação

- Abrir **Empresas → Stutz → Usuários** e testar o botão de chave para Cristina e Joab.
- Confirmar que o modal abre corretamente, valida senhas vazias, curtas ou diferentes e envia somente dados válidos.
- Verificar nos registros da função que a ação chega ao backend e retorna sucesso.
- Validar o login de uma conta de teste com a senha recém-definida, sem expor ou registrar a senha.

## Arquivos envolvidos

- `src/pages/admin/Tenants.tsx`: modal, estados, validações e feedback.
- `supabase/functions/admin-invite-tenant-user/index.ts`: apenas ajustes de resposta/validação caso a verificação ponta a ponta revele necessidade; a autorização de super administrador será preservada.