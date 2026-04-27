
# Desbloquear Google Calendar e manter conexão permanente

## Diagnóstico

A Agenda Operacional usa um **Client ID próprio do Google** (`VITE_GOOGLE_CLIENT_ID`) com o fluxo **GIS Token Client** rodando 100% no navegador. Isso causa dois problemas combinados:

1. **Erro 403 `access_denied`**: o app OAuth está em modo **"Testing"** no Google Cloud Console. Apenas emails cadastrados manualmente como testadores conseguem autorizar, e mesmo eles têm tokens que expiram a cada **7 dias**.
2. **Reconexão constante**: o fluxo atual só recebe `access_token` (válido por 1h) e nenhum `refresh_token`. A "renovação silenciosa" só funciona se o usuário ainda tem sessão Google ativa no navegador — quando isso falha, ele precisa autorizar tudo de novo.

O escopo `https://www.googleapis.com/auth/calendar` é considerado **sensível** pelo Google, então publicar o app exige passar por verificação. Vamos resolver as duas pontas.

## O que vai mudar

### Parte 1 — Publicar o app no Google Cloud (manual, eu te guio)

Você executa estes passos no Google Cloud Console (projeto `844816375481`). Eu te dou o passo a passo no chat depois da aprovação:

1. **OAuth consent screen**:
   - Mudar de "External / Testing" para **"In production"**
   - Preencher: nome do app, logo CajuPAR, email de suporte, link de privacidade, link de termos, domínio autorizado (`freelancersgrupocaju.lovable.app`)
2. **Submeter para verificação do Google** (escopo `calendar` é sensível):
   - Justificativa de uso
   - Vídeo demonstrando o fluxo OAuth no app
   - Verificação leva entre 3 e 6 semanas
3. **Enquanto a verificação roda**: app continua acessível, mas mostra um aviso "Google não verificou este app" — usuários podem clicar em "Avançado → Continuar" para autorizar. **Isso já desbloqueia 100% dos usuários hoje** (não tem mais lista de testadores).
4. Após verificação aprovada: aviso some, fluxo fica idêntico a um app comercial.

### Parte 2 — Refresh token persistente (eu implemento no código)

Migrar o fluxo OAuth do navegador para o servidor (Edge Function), que é o único jeito de obter um `refresh_token` do Google que dura até ser revogado:

1. **Nova tabela** `user_google_tokens` ganha colunas:
   - `refresh_token` (text, criptografado via RLS estrita)
   - `scope` (text)
   - `token_type` (text)
2. **Novas Edge Functions**:
   - `google-oauth-start`: gera URL de consent com `access_type=offline` e `prompt=consent` (obrigatório para receber refresh_token na primeira vez)
   - `google-oauth-callback`: recebe o `code`, troca por `access_token + refresh_token`, salva no Supabase vinculado ao `user_id`
   - `google-oauth-refresh`: usa o `refresh_token` armazenado para obter novo `access_token` quando o atual expira
3. **Frontend** (`src/services/googleCalendar.ts`):
   - Substituir `requestGoogleToken` (GIS popup) por redirect para `google-oauth-start`
   - `ensureValidGoogleToken` passa a chamar `google-oauth-refresh` quando expirado, sem exigir interação do usuário
   - Remover dependência de `VITE_GOOGLE_CLIENT_ID` no client (vira secret server-side)
4. **Secrets do Supabase** (te peço depois da aprovação):
   - `GOOGLE_OAUTH_CLIENT_ID` (mesmo do `.env` atual)
   - `GOOGLE_OAUTH_CLIENT_SECRET` (você pega no Google Cloud Console → Credentials → seu OAuth Client → "Client secret")
5. **Adicionar Redirect URI no Google Cloud Console**:
   - `https://munehfraeisxfvpplkfi.supabase.co/functions/v1/google-oauth-callback`

## Resultado final

- **Hoje (após aprovação do plano)**: qualquer usuário CajuPAR consegue autorizar (com aviso "não verificado" temporário) e a conexão dura **indefinidamente**, renovando sozinha em background sem o usuário perceber.
- **Em 3-6 semanas**: aviso de "não verificado" some quando o Google aprovar a verificação.
- **Erro 403 some imediatamente** assim que você publicar o consent screen (etapa manual da Parte 1).

## Detalhes técnicos

```text
Fluxo atual (quebrado):
  Browser → GIS popup → access_token (1h) → localStorage
                                          → expira → reconectar manualmente

Fluxo novo (resiliente):
  Browser → /google-oauth-start (Edge) → Google consent
         → Google redirect com code → /google-oauth-callback (Edge)
         → troca code por {access_token, refresh_token}
         → grava em user_google_tokens (RLS por user_id)
  
  Em cada chamada Calendar API:
    ensureValidGoogleToken()
      → se access_token válido: usa
      → se expirado: chama /google-oauth-refresh (Edge)
                  → POST oauth2.googleapis.com/token grant_type=refresh_token
                  → atualiza access_token no DB
                  → retorna novo token (transparente ao usuário)
```

**Migração SQL**:
```sql
ALTER TABLE user_google_tokens
  ADD COLUMN refresh_token text,
  ADD COLUMN scope text,
  ADD COLUMN token_type text DEFAULT 'Bearer';
-- RLS já restrita a auth.uid() = user_id (manter)
```

**Arquivos a criar**:
- `supabase/functions/google-oauth-start/index.ts`
- `supabase/functions/google-oauth-callback/index.ts`
- `supabase/functions/google-oauth-refresh/index.ts`
- Migração SQL acima

**Arquivos a modificar**:
- `src/services/googleCalendar.ts` — substituir GIS por redirect flow + chamada à edge function de refresh
- `src/pages/Agenda.tsx` — botão "Conectar" passa a redirecionar para `/google-oauth-start`; tratar callback de retorno

**O que NÃO muda**:
- UI da Agenda permanece idêntica
- Eventos já criados continuam funcionando (mesmo `google_event_id`)
- Login com Google do próprio portal (Lovable Cloud) é independente disso

## Sequência de execução após aprovação

1. Eu aplico migração SQL e crio as 3 Edge Functions
2. Eu peço os secrets `GOOGLE_OAUTH_CLIENT_ID` e `GOOGLE_OAUTH_CLIENT_SECRET`
3. Eu refatoro `googleCalendar.ts` e `Agenda.tsx`
4. Eu te dou o **passo a passo manual no Google Cloud Console** (publicar consent + adicionar redirect URI + iniciar verificação)
5. Você reconecta uma vez e nunca mais precisa autorizar
