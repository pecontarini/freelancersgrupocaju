## Diagnóstico

A boa notícia: **a integração funcionou**. O screenshot mostra a resposta do `google-oauth-callback` com `?google_oauth=success`, ou seja:

- O Google aceitou a autorização
- Os tokens foram trocados com sucesso
- O `access_token` + `refresh_token` foram salvos no banco (`user_google_tokens`)

O problema é só **visual**: o navegador parou na página HTML intermediária do Supabase em vez de seguir o redirect para `https://freelancersgrupocaju.lovable.app/agenda?google_oauth=success`.

### Por que ficou parado

Hoje a edge function `google-oauth-callback` devolve uma página HTML que tenta redirecionar de três formas (meta refresh, link e `window.location.replace`). Em algumas situações o Safari bloqueia essa navegação cross-origin (de `supabase.co` para `lovable.app`) — o usuário vê o HTML cru e precisaria clicar manualmente em "Continuar".

## O que vou mudar

Apenas **um arquivo**: `supabase/functions/google-oauth-callback/index.ts`.

Vou substituir a resposta HTML por um **HTTP 302 (redirect verdadeiro)** com header `Location`. Isso faz o navegador seguir imediatamente, sem janela intermediária e sem depender de JavaScript, sem importar o navegador usado.

```text
Antes:  Google → callback → HTML "Redirecionando..." → (às vezes para aqui)
Depois: Google → callback → 302 Location: /agenda?google_oauth=success → app
```

Mantenho um pequeno fallback HTML somente se o `Location` falhar por algum motivo de proxy.

## Como validar depois

1. Você abre `/agenda` no app publicado.
2. Clica em "Conectar Google Calendar".
3. Autoriza no Google.
4. Volta direto para `/agenda` com o toast "Google Calendar conectado!".
5. A conexão fica persistente (refresh_token salvo) — não precisa reconectar a cada 7 dias.

## Importante: você já está conectado agora

Como o callback chegou a salvar os tokens com sucesso antes de travar no HTML, basta voltar manualmente para `https://freelancersgrupocaju.lovable.app/agenda` e a conexão já deve aparecer ativa. Pode testar criar um evento.

## Detalhes técnicos

- Mudar `htmlRedirect()` para `httpRedirect()` retornando `Response` com status `302` e header `Location`.
- Manter `corsHeaders` no response para evitar problemas de CORS no fluxo de redirect.
- Manter o tratamento de erro (param `?google_oauth=error&reason=...`) que o `Agenda.tsx` já lê via `useEffect`.
- Sem mudanças no frontend, na tabela `user_google_tokens`, no Google Cloud Console ou em outras edge functions.

Após aprovar, eu aplico a mudança e faço deploy da função.