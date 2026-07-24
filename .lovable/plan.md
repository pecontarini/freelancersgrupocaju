## Problema

Existem duas versões da função `create_public_freelancer_request` no banco (a antiga sem horários e a nova com `_hora_inicio`/`_hora_fim`). O PostgREST não consegue escolher qual chamar e retorna "Could not choose the best candidate function".

## Correção

Migração única que remove a assinatura antiga da RPC, mantendo apenas a versão com horários:

```sql
DROP FUNCTION IF EXISTS public.create_public_freelancer_request(
  text, uuid, date, text, text, text, text, text, text
);
```

A versão nova (com `_hora_inicio time`, `_hora_fim time`) permanece intacta e o formulário público volta a funcionar.
