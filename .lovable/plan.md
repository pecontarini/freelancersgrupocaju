## Problema

A URL `lovableproject.com/...` é o **preview** do Lovable e exige login do Lovable, mesmo a rota `/aprovar-escala/:token` sendo pública no React Router. Para o COO, o link compartilhado precisa apontar para a **URL publicada** (`freelancersgrupocaju.lovable.app`). Além disso, a página deve pedir um **PIN simples** antes de aprovar/rejeitar.

## Mudanças

### 1. Link gerado sempre na URL publicada
- `src/components/escalas/CooApprovalLinkBox.tsx`: trocar `window.location.origin` por constante fixa `https://freelancersgrupocaju.lovable.app` ao montar o link copiado / WhatsApp.

### 2. PIN de aprovação
- **Secret**: criar `COO_APPROVAL_PIN` (4–8 dígitos definidos por você) via tool de secrets.
- **Edge function `escala-aprovacao-decidir`**: aceitar campo `pin` no body. Comparar com `Deno.env.get("COO_APPROVAL_PIN")` antes de aprovar/rejeitar; retornar `401` se inválido. Uso constante-time simples.
- **Página `AprovarEscala.tsx`**: adicionar `<Input type="password">` "PIN do COO" obrigatório acima dos botões. Enviar `pin` junto no `decidir()`. Tratar erro 401 com toast "PIN inválido".

### 3. Garantir publicação ativa
- Após o deploy frontend, você precisa clicar em **Publicar/Update** na publicação para que a nova versão (com URL correta + PIN) chegue em `freelancersgrupocaju.lovable.app`. Edge functions deployam automaticamente.

## Detalhes técnicos

- A rota `/aprovar-escala/:token` já está fora do `ProtectedRoute` em `App.tsx` (não há mudança de rota).
- `verify_jwt = false` da função `escala-aprovacao-decidir` permanece — a autorização passa a depender do par **token + PIN**.
- O PIN fica apenas no servidor (secret); nunca exposto ao frontend.

## Próximo passo

Após aprovar o plano, vou pedir o PIN via `add_secret` (você digita em formulário seguro).
