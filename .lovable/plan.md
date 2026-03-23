

# Plano: Auto-preenchimento editável para CPF existente

## Diagnóstico

Hoje, quando um CPF existente é encontrado, o step `"confirm"` mostra os dados em modo somente leitura. O pedido é que os campos sejam **editáveis e pré-preenchidos**, permitindo ao freelancer atualizar qualquer dado antes de prosseguir.

## Mudanças

### 1. `src/pages/FreelancerCheckin.tsx`

No `handleCpfSubmit`, quando o perfil é encontrado (`existing`):
- Pré-preencher os states do formulário (`regName`, `regPhone`, `regTipoChavePix`, `regChavePix`) com os dados do perfil existente
- Pré-preencher `regPhotoBase64` com `existing.foto_url` (exibir como preview)
- Continuar indo para step `"confirm"`

No step `"confirm"`:
- Substituir a exibição somente leitura por campos editáveis (Input, Select) pré-preenchidos
- Manter a foto de perfil visível com opção de trocar via câmera
- Botão "Fazer Check-in" / "Fazer Check-out" continua existindo

No `handleConfirmProceed`:
- Se houve alteração nos dados, chamar um update no perfil antes de prosseguir para selfie
- Atualizar `nome_completo`, `telefone`, `tipo_chave_pix`, `chave_pix` e `foto_url` (se trocou foto)

### 2. `src/hooks/useFreelancerProfiles.ts`

- Adicionar mutation `updateProfile` que faz `.update()` na tabela `freelancer_profiles` por `id`

### Arquivos editados

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useFreelancerProfiles.ts` | Adicionar `updateProfile` mutation |
| `src/pages/FreelancerCheckin.tsx` | Pré-preencher campos no confirm, torná-los editáveis, salvar alterações |

