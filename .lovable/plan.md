

## Plano: Foto obrigatoria para itens NAO conformes no Checklist

### Sobre os links existentes

Os links compartilhados com os chefes sao apenas tokens de acesso que carregam a mesma pagina do aplicativo. Qualquer alteracao no codigo da pagina sera automaticamente refletida em todos os links ja enviados. **Nao sera necessario gerar novos links.**

---

### Mudancas

**1. Frontend -- `src/pages/DailyChecklist.tsx`**

- Tornar foto **obrigatoria** quando o item for marcado como NAO (nao conforme)
- Alterar o texto do botao de "Anexar foto (opcional)" para "Anexar foto *" com borda vermelha quando faltando
- Adicionar mensagem de alerta: "Foto obrigatoria para itens nao conformes"
- Atualizar a validacao `canSubmit` para incluir verificacao de foto nos itens NAO
- Atualizar a mensagem do rodape para informar quando faltam fotos
- Adicionar validacao no `handleSubmit` com toast de erro

**2. Backend -- `supabase/functions/submit-daily-checklist/index.ts`**

- Adicionar validacao no servidor: itens marcados como NAO devem ter `photo_url` preenchido
- Retornar erro 400 com mensagem clara se faltar foto em algum item nao conforme

---

### Detalhes tecnicos

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/DailyChecklist.tsx` | Adicionar `allNonConformingHavePhoto` memo, atualizar `canSubmit`, estilizar botao de foto com borda vermelha quando obrigatorio e faltando, atualizar mensagens |
| `supabase/functions/submit-daily-checklist/index.ts` | Adicionar validacao `missingPhotos` similar a validacao `missingObs` existente |

### Logica de validacao

```text
canSubmit = allAnswered
         AND allNonConformingHaveObs
         AND allNonConformingHavePhoto   <-- NOVO
         AND respondedByName nao vazio
```

A area de foto, que hoje so aparece quando o campo de observacao esta expandido, passara a aparecer automaticamente (junto com a observacao) sempre que o item for marcado como NAO, com indicacao visual clara de que e obrigatoria.

