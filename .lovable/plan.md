## Diagnóstico

Confirmei via curl que o bundle publicado em `freelancersgrupocaju.lovable.app` **já contém o código novo** (string `ai_draft_slots` aparece no JS de produção, hash `index-B76Uu_a-.js`). O site está público e o build está atualizado.

O problema é **cache do navegador** — Chrome/Safari estão servindo o `index.html` antigo, que aponta para um bundle antigo. Como a estratégia "só publicar" já foi tentada sem sucesso, a única forma confiável de resolver é o **próprio app detectar a nova versão e forçar reload**.

## Plano: detector de versão com auto-reload

### 1. Gerar arquivo de versão no build
- Adicionar plugin Vite simples que escreve `public/version.json` com `{ "buildId": "<timestamp+hash>" }` a cada build.
- Injetar o mesmo `buildId` como `import.meta.env.VITE_BUILD_ID` no bundle.

### 2. Hook `useVersionCheck`
- A cada 60s (e no `visibilitychange` para quando a aba volta ao foco), faz `fetch('/version.json', { cache: 'no-store' })`.
- Se o `buildId` retornado ≠ `VITE_BUILD_ID` do bundle em execução → dispara o passo 3.

### 3. Banner + reload
- Mostra um toast persistente no topo: *"Nova versão disponível"* com botão **Atualizar agora**.
- Ao clicar: `window.location.reload()` com cache-busting (`?v=<buildId>`).
- Se o usuário ignorar por mais de 5min, recarrega automaticamente quando a aba estiver inativa (sem perder trabalho em andamento).

### 4. Badge de versão no rodapé (discreto)
- Pequeno texto cinza no canto: `v <buildId-curto>` — permite confirmar visualmente em qual versão o usuário está, sem precisar abrir DevTools.

### 5. Quebra de cache imediata (one-shot)
- Para resolver **agora** sem esperar o ciclo: incluir no `index.html` meta tags `Cache-Control: no-cache, must-revalidate` para o próprio HTML (o bundle JS já tem hash, então ele se auto-versiona; o problema é só o HTML que aponta para ele).

### Arquivos afetados
- `vite.config.ts` — plugin de geração de `version.json` + define `VITE_BUILD_ID`.
- `src/hooks/useVersionCheck.ts` — novo.
- `src/App.tsx` — montar o hook e o banner globalmente.
- `src/components/ui/VersionBadge.tsx` — novo, discreto no rodapé.
- `index.html` — meta cache-control no HTML.

### Resultado esperado
- Hoje à noite: Felipe e qualquer usuário com aba aberta verão um toast "Atualizar agora" em até 60s após a próxima publicação. Um clique resolve.
- Daqui para frente: nunca mais "preciso fazer hard refresh" — o app cuida disso sozinho.
