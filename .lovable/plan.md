

# Plano: Corrigir captura de foto no check-in mobile

## Diagnóstico

Dois problemas identificados:

1. **Estado sujo entre tentativas**: Quando o freelancer volta ao step CPF e tenta outro CPF, `regPhotoBase64` mantém o valor anterior (ex: URL do perfil antigo). No step `register`, isso mostra uma imagem quebrada em vez do botão "Abrir Câmera".

2. **`getUserMedia` não é confiável em browsers mobile**: Em muitos celulares (especialmente in-app browsers), a API `getUserMedia` falha silenciosamente ou é bloqueada. O `<input type="file" accept="image/*" capture="user">` é o método nativo e mais confiável para tirar fotos no mobile — abre o app de câmera nativo.

## Mudanças

### 1. `src/pages/FreelancerCheckin.tsx`

**Reset de estado ao iniciar nova busca**: No início de `handleCpfSubmit`, resetar todos os campos de registro (`regName`, `regPhone`, `regPhotoBase64`, `regTipoChavePix`, `regChavePix`, `selfieBase64`) para evitar dados residuais.

**Substituir `getUserMedia` por `<input type="file" capture>` para fotos de perfil e selfie**:
- Adicionar um `fileInputRef` e um `selfieInputRef` (refs para `<input type="file">`)
- No step `register` e `confirm`, trocar o bloco câmera/video por:
  - Se tem foto → mostra preview + botão "Tirar outra foto" que abre o input file
  - Se não tem → botão "Tirar Foto" que abre o input file
- No step `selfie`, mesma abordagem: botão que abre input file com `capture="user"`
- Ao selecionar arquivo, converter para base64 com `FileReader` e salvar no state
- Remover dependência de `startCamera`/`stopCamera`/`capturePhoto`/`videoRef` para esses fluxos

**Benefícios**:
- Funciona em 100% dos browsers mobile (abre câmera nativa)
- Não precisa de permissão `getUserMedia`
- UI mais simples e previsível

### Lógica do `<input type="file">`:
```
<input type="file" accept="image/*" capture="user" hidden ref={inputRef} />
// onClick do botão → inputRef.current.click()
// onChange → FileReader.readAsDataURL → setState
```

### Arquivo editado

| Arquivo | Mudança |
|---------|---------|
| `src/pages/FreelancerCheckin.tsx` | Reset de estado + substituir getUserMedia por input file capture nativo |

