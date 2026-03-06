

# Plano: Reset automatico do formulario apos salvar freelancer

## Diagnostico

O formulario em `FreelancerForm.tsx` ja tem logica de reset (linha 109), mas os componentes `Select` do Radix UI mantêm estado interno mesmo apos `form.reset()`. Quando o valor muda para `""` e depois para `undefined` via `|| undefined`, o Select pode nao re-renderizar corretamente e continuar exibindo a selecao anterior visualmente. Isso faz o usuario achar que o formulario "travou".

## Solucao

Adicionar um `key` incremental no `<form>` que muda a cada submit bem-sucedido. Isso forca o React a desmontar e remontar todos os componentes filhos (incluindo os Selects), garantindo um estado visual limpo.

## Mudancas em `src/components/FreelancerForm.tsx`

1. Adicionar estado `const [formKey, setFormKey] = useState(0)`
2. No `onSubmit`, apos o reset, chamar `setFormKey(k => k + 1)`
3. Adicionar `key={formKey}` no elemento `<form>`
4. Focar automaticamente no primeiro campo editavel (CPF) apos o reset usando um `useEffect` que reage ao `formKey`

Resultado: apos salvar, o formulario reseta completamente (visual e dados), mantem a loja selecionada, e posiciona o cursor no campo CPF para o proximo lancamento.

