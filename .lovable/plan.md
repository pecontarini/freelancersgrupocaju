
## Diagnóstico

O link que abriu (`.../verify?token=...&type=invite&redirect_to=https://53a5f1f8-...lovableproject.com/auth`) tem dois problemas:

1. **`redirect_to` aponta para a URL de preview do Lovable** (`lovableproject.com`), não para a URL pública (`board2.lovable.app`). Esse host tende a não estar na allow-list de Auth, então o Supabase joga o usuário para o Site URL default, resultando naquela "página de dev".
2. **Mesmo se o redirect estivesse certo**, a página `/auth` não trata convites. O Supabase verifica o token, cria a sessão do usuário (que ainda não tem senha) e devolve ao `/auth` com o access_token no hash. Hoje o `Auth.tsx` ignora esse estado, então o usuário só vê a tela de login normal — sem nenhum caminho para definir a senha.

## O que fazer

### 1. Edge Function `admin-invite-tenant-user`
- Passar a montar um `redirectTo` padrão apontando para `/auth?invite=1` da URL do admin que chamou (recebida no body como hoje) e, quando ausente, cair num `PUBLIC_SITE_URL` (secret) ou origem passada pelo caller — nunca deixar o Supabase escolher.
- Fazer o mesmo para o link de `recovery`.

### 2. `src/pages/admin/Tenants.tsx`
- Ao invocar a função, mandar sempre `redirect_to: ${window.location.origin}/auth?invite=1` (o admin hoje já está no domínio publicado quando faz o convite, então o link nascerá correto).
- Mesmo tratamento ao gerar o link via o botão 🔗 de "regenerar link".

### 3. `src/pages/Auth.tsx` — detectar convite/recovery e pedir senha
- No mount, usar `supabase.auth.onAuthStateChange`. Quando o evento for `PASSWORD_RECOVERY` **ou** houver sessão + `?invite=1` na query (ou `type=invite` no hash), trocar a UI para um formulário "Defina sua senha" (`Nova senha` + `Confirmar senha`).
- No submit chamar `supabase.auth.updateUser({ password })`. Ao sucesso: toast, limpar query/hash e `navigate("/")`.
- Manter o fluxo de login normal para quem chega sem token.

### 4. Verificação
- Gerar um novo link de convite via `/admin/tenants` (Stutz → Thaylla) e abrir no navegador logado limpo.
- Esperado: link abre em `board2.lovable.app/auth?invite=1#access_token=...`, aparece o formulário "Defina sua senha", após salvar cai no dashboard já autenticado.

## Observação sobre links já enviados

Links de convite antigos (como o que você abriu) ficarão inúteis porque o `redirect_to` deles está gravado no token. Depois do fix é preciso **regenerar** o link da Thaylla pelo botão 🔗 e reenviar — o link novo já sairá com o redirect certo.

## Fora do escopo

- Não vou mexer em Site URL / Redirect URLs do Supabase (isso é configuração manual em Auth Settings — só é necessário se `board2.lovable.app` ainda não estiver lá; posso listar depois).
- Não vou trocar SMTP / provedor de e-mail; o botão 🔗 continua sendo o caminho oficial de compartilhar.
