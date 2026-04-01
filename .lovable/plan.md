

# Plano: Recuperação de Senha

## Resumo

Adicionar fluxo completo de "Esqueci minha senha" com dois componentes: um link na tela de login que envia e-mail de redefinição, e uma página `/reset-password` onde o usuário define a nova senha.

## Alterações

### 1. `src/pages/Auth.tsx` — Adicionar link "Esqueceu a senha?"
- Abaixo do botão "Entrar", adicionar um link que alterna para um estado `forgotPassword`
- No estado `forgotPassword`: exibe campo de e-mail + botão "Enviar link de recuperação"
- Chama `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`
- Botão para voltar ao login

### 2. `src/pages/ResetPassword.tsx` — Nova página
- Rota `/reset-password` (pública, sem ProtectedRoute)
- Detecta `type=recovery` no URL hash via `onAuthStateChange`
- Formulário com campo "Nova senha" + "Confirmar senha"
- Chama `supabase.auth.updateUser({ password })` para salvar
- Após sucesso, redireciona para `/auth` com mensagem de confirmação
- Usa o mesmo visual (Card, logo, cores) da página Auth

### 3. `src/App.tsx` — Registrar nova rota
- Adicionar `<Route path="/reset-password" element={<ResetPassword />} />`

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/pages/Auth.tsx` | Adicionar estado forgotPassword com formulário de recuperação |
| `src/pages/ResetPassword.tsx` | Criar página de redefinição de senha |
| `src/App.tsx` | Adicionar rota `/reset-password` |

