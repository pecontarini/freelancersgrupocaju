## Diagnóstico

O fluxo "Gerar IA → Editor de Escalas" usa `enviarParaEditor` em `src/components/escalas/GeradorEscalaIA.tsx` (linhas 219–337). Ele:

1. Lê o `setor` do Gerador (vem de `turno_config.setor`).
2. Procura em `sectors` da unidade um registro cujo `name` normalizado seja **exatamente igual** ao nome do setor (somente strip de acentos + lowercase + trim — linhas 230–233).
3. Se não achar, dispara `toast.error('Setor "X" não encontrado…')` e **não** dispara o evento `ai-drafts-ready`, então o Editor nunca abre.

No banco temos `turno_config.setor = 'CUMIN'`, mas vários `sectors.name` da rede estão como **`CUMINS`** (plural) ou **`CUMIM`** (typo). Para essas unidades a comparação `cumin === cumins` falha → o envio para o Editor não acontece. As "demais" funções funcionam porque o nome do setor bate 1:1 (ex.: `Cozinha`, `Salão`).

## Plano

Editar apenas `src/components/escalas/GeradorEscalaIA.tsx` (função `enviarParaEditor`):

1. **Lookup tolerante**: além do match exato normalizado, aceitar variantes:
   - normalizar removendo `s` final (`cumins → cumin`, `cumin → cumin`);
   - normalizar trocando `m` final por `n` (`cumim → cumin`);
   - colapsar espaços/hífens.
   Implementar como `normalize(s)` e usar `find()` com igualdade entre as duas strings normalizadas.
2. **Fallback `includes`**: se ainda assim não houver match único, procurar `sector.name` que **comece com** o nome do setor normalizado (ex.: `cumin` casaria com `cumins nazo` só se houver um único candidato — caso contrário, preserva o erro atual para evitar ambiguidade).
3. **Mensagem de erro melhor**: quando houver múltiplos candidatos ambíguos, listar os nomes encontrados na unidade no `toast.error` para o usuário escolher renomear.
4. **Sem mudanças** no edge function, no Editor, nem no schema.

### Detalhes técnicos

```ts
const normalize = (s: string) => s
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().trim()
  .replace(/[\s\-_]+/g, " ")
  .replace(/m$/, "n")     // CUMIM → cumin
  .replace(/s$/, "");     // CUMINS → cumin
```

Ordem de busca:
1. exato normalizado;
2. se nada, `startsWith` único;
3. se nada/ambíguo, mostrar erro com lista de candidatos.

### Validação

- Gerar a escala de CUMIN em uma unidade cujo `sectors.name` é `CUMINS`/`CUMIM` e confirmar que o Editor é aberto automaticamente (evento `ai-drafts-ready` disparado).
- Repetir para um setor que já casava (ex.: `Cozinha`) para garantir que não regredimos.
