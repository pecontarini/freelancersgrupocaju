

## Plano: Ativar e branding do "Esqueci minha senha"

### Diagnóstico
A UI e o fluxo técnico já estão prontos:
- `Auth.tsx` tem botão "Esqueceu a senha?" → tela com input de e-mail → `supabase.auth.resetPasswordForEmail` com `redirectTo: /reset-password`
- `ResetPassword.tsx` valida sessão de recovery e atualiza a senha via `supabase.auth.updateUser`
- Rota `/reset-password` registrada no `App.tsx`

**O que falta:** o e-mail de recuperação sai com template genérico do Supabase, sem identidade CajuPAR e com baixa entregabilidade. Para ficar profissional, precisamos do domínio de envio próprio + template branded.

### O que farei

**1. Pequenos ajustes de UX no `Auth.tsx`** (rápido)
- Validação visual do e-mail antes do envio
- Mensagem de sucesso mais clara (mencionando "verifique também a caixa de spam")
- Botão "Reenviar link" disponível por 60s após o primeiro envio (cooldown)
- Sem mexer no layout/identidade visual existente

**2. Configurar domínio de envio de e-mail**
- Abrir o diálogo de setup para o usuário escolher um subdomínio (ex: `notify.cajupar.com.br` ou similar)
- O setup gera os registros DNS que precisam ser configurados no provedor de domínio do CajuPAR

**3. Criar templates de e-mail de auth com identidade CajuPAR**
- Scaffold dos 6 templates (recovery, signup, magic-link, invite, email-change, reauthentication)
- Aplicar a identidade visual: Coral/Terracotta (#D05937), logo CajuPAR, tipografia condizente
- Foco no template `recovery.tsx` (esqueci a senha) com copy claro em PT-BR
- Deploy do edge function `auth-email-hook`

**4. Validação**
- Testar fluxo completo: clicar "Esqueceu a senha?" → receber e-mail branded → clicar no link → cair em `/reset-password` → definir nova senha → fazer login

### Arquivos
- **Editar**: `src/pages/Auth.tsx` (cooldown + mensagens)
- **Criar (via scaffold)**: `supabase/functions/auth-email-hook/index.ts` + 6 templates em `supabase/functions/_shared/email-templates/*.tsx`
- **Configurar**: domínio de envio + DNS

### Observação
Se o usuário **não quiser configurar domínio próprio agora**, o fluxo já funciona com o e-mail padrão do Supabase — basta confirmar isso e eu faço só os ajustes de UX do passo 1.

### Pergunta antes de prosseguir
Você quer:
- **A)** Implementar tudo (UX + domínio próprio + templates branded CajuPAR) — recomendado
- **B)** Apenas os ajustes de UX no `Auth.tsx`, mantendo o e-mail padrão do Supabase
- **C)** Apenas configurar o domínio de envio + templates, sem mexer no `Auth.tsx`

