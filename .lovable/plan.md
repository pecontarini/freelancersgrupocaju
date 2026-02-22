

## Plano: Checklist Publico sem Login + Correcoes de Estabilidade

### Problemas Encontrados

1. **Link pede login para enviar fotos**: A pagina `DailyChecklist.tsx` usa `supabase.storage.upload()` no client-side, que exige autenticacao. O bucket `checklist-photos` tem politica de SELECT publica, mas NAO tem politica de INSERT -- logo o upload falha sem login.

2. **Segundo template sem links gerados**: O template "Supervisor de Back - Ricardo" (64 itens, todos mapeados) tem 0 links porque o usuario precisa clicar "Gerar Links" manualmente apos criar o template. O sistema funciona, mas a UX nao deixa claro que e necessario gerar os links.

### Solucao

#### 1. Upload de fotos sem login via Edge Function

Em vez de usar `supabase.storage.upload()` no cliente (que exige auth), vamos enviar a foto para a edge function `submit-daily-checklist` com uma nova action `upload-photo`. A edge function usa `service_role` e consegue fazer upload no storage sem autenticacao do usuario.

**Fluxo:**
1. Chefe tira foto no celular
2. Foto e convertida para base64 no frontend
3. Frontend envia para `submit-daily-checklist` com action `upload-photo`
4. Edge function faz upload no bucket `checklist-photos` com service_role
5. Edge function retorna a URL publica da foto
6. Frontend exibe preview e salva a URL no estado

#### 2. Gerar links automaticamente ao criar template

Ao salvar um template (novo ou editado), o sistema automaticamente gera os links por setor para todos os setores mapeados. O usuario nao precisa mais clicar "Gerar Links" separadamente.

### Detalhes Tecnicos

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/submit-daily-checklist/index.ts` | Adicionar action `upload-photo` que recebe base64, faz upload no storage com service_role e retorna URL publica |
| `src/pages/DailyChecklist.tsx` | Substituir `supabase.storage.upload()` por chamada a edge function via `fetch()`. Converter arquivo para base64 antes de enviar |
| `src/components/checklist-daily/ChecklistTemplateManager.tsx` | Apos salvar template, chamar automaticamente a geracao de links para os setores mapeados |

#### Edge Function -- Nova action `upload-photo`

Recebe:
- `action: "upload-photo"`
- `access_token`: token do link (para validar que e um link ativo)
- `file_base64`: conteudo da foto em base64
- `file_name`: nome do arquivo

Retorna:
- `{ success: true, data: { public_url: "..." } }`

Validacoes:
- Token deve ser de um link ativo
- Arquivo deve ter no maximo 5MB
- Extensao deve ser imagem (jpg, png, webp)

#### Geracao automatica de links

No `ChecklistTemplateManager.handleSave()`, apos salvar o template e os itens:
1. Buscar todos os `sector_code` distintos dos itens salvos
2. Buscar links existentes para esse template
3. Inserir links para setores que ainda nao tem link
4. Exibir toast informando quantos links foram gerados

