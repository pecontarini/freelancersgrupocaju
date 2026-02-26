

## Plano: Fixar Loja Selecionada Entre Lancamentos Consecutivos

### Problema

Quando um usuario com multiplas lojas (ex: 3 lojas) cadastra um freelancer e o formulario faz `form.reset()`, os campos `loja` e `loja_id` sao limpos. No proximo lancamento, o usuario precisa selecionar a loja novamente e, se nao perceber, recebe o erro "Loja e obrigatoria".

A logica atual (linha 101-110 de `FreelancerForm.tsx`) so re-aplica a loja para usuarios com **uma unica loja** (`singleUnidade`). Usuarios com 2+ lojas perdem a selecao.

### Solucao

Salvar a loja selecionada antes do `form.reset()` e re-aplicar imediatamente depois, para **todos** os perfis (nao apenas `singleUnidade`).

### Mudancas

**Arquivo: `src/components/FreelancerForm.tsx`**

Na funcao `onSubmit` (linhas 89-111):

1. Antes de `form.reset()`, capturar os valores atuais de `loja` e `loja_id`
2. Apos `form.reset()`, re-aplicar esses valores salvos (independente do perfil)
3. Remover a condicao `if (singleUnidade)` que limita a re-aplicacao

Codigo atual:
```
form.reset();
setCpfValue("");
setValorValue("");
setAutoFilledFields(new Set());

// Re-apply unidade for gerente with single store
if (singleUnidade) {
  form.setValue("loja", singleUnidade.nome);
  form.setValue("loja_id", singleUnidade.id);
}
```

Codigo novo:
```
// Salvar loja selecionada antes do reset
const currentLoja = data.loja;
const currentLojaId = data.loja_id;

form.reset();
setCpfValue("");
setValorValue("");
setAutoFilledFields(new Set());

// Re-aplicar loja para todos os perfis (single ou multi-loja)
if (currentLojaId) {
  form.setValue("loja", currentLoja);
  form.setValue("loja_id", currentLojaId);
}
```

### Impacto

- **Admin**: mantem a loja selecionada entre lancamentos
- **Socio Operador (multi-loja)**: corrige o bug reportado — loja fica fixa
- **Gerente (single loja)**: continua funcionando normalmente
- **Gerente (multi-loja)**: tambem corrigido

Nenhuma outra mudanca necessaria. A correcao e cirurgica e universal.
