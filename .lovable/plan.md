## Problema

O gerador de escalas IA pode criar mais "vagas" do que pessoas realmente cadastradas no setor (ex.: gera 30 vagas de garçom quando só existem 26 funcionários ativos). Como cada vaga precisa ser vinculada a uma pessoa real no Editor, qualquer excedente fica órfão. Além disso, o algoritmo às vezes deixa abertura/fechamento/POP descobertos quando o teto aperta.

## Regra de negócio definida

1. **Teto = headcount real do setor** = nº de `employees` ativos vinculados ao setor via `sector_job_titles`. Esse é o número máximo de vagas regulares (não-EXTRA) que o gerador pode produzir.
2. **POP de abertura/fechamento é intocável.** Mínimo diário de abridores e fechadores em campo deve ser respeitado nos 7 dias.
3. **Se teto não couber POP+folgas:** reduzir folgas (manter 6x1 mesmo quando o desejado era 5x2) e devolver alerta visível, **sem bloquear** a geração.

## Mudanças

### Edge function `gerar-escala-ia/index.ts`

1. Buscar `headcount_max` antes de chamar a IA:
   - `sector_job_titles` do setor → `job_title_id[]`
   - `employees` ativos da unidade com `job_title_id IN (...)` → `count`
   - Passar esse número para a IA (no prompt) e usar como teto duro na pós-validação.
2. Pós-validação após resposta da IA:
   - Filtrar `vagasRegulares` (sem EXTRA).
   - Garantir `vagas_papel = ceil((qtd_papel * 7)/diasUteis)` para abridor e fechador (já existe).
   - Se `vagasRegulares.length > headcount_max`:
     - Tentar primeiro mudar modelo para 6x1 (recalcular `diasUteisPorVaga`) e refazer a distribuição de folgas.
     - Se ainda exceder, podar **intermediários** (último a entrar) até bater o teto.
     - Nunca podar abridor/fechador abaixo do mínimo diário POP.
     - Se mesmo após podar intermediários ao mínimo necessário ainda exceder, retornar alerta `headcount_insuficiente` com a mensagem: "Setor X tem N pessoas mas a configuração POP exige M vagas. Reduzir POP ou contratar (M-N)."
   - Recalcular `cobertura_por_dia_calc` e revalidar mínimos POP por papel após qualquer poda/redistribuição.
3. Adicionar ao payload retornado:
   - `headcount_max`
   - `headcount_usado`
   - `alertas_capacidade` (array com mensagens explicativas)
   - `modelo_folga_aplicado` (pode diferir do solicitado se houve fallback)
4. Caso o conflito não tenha sido contornável (resta excedente), retornar HTTP 200 mas com `alertas_capacidade.length > 0` para o front mostrar banner amarelo (não 422 — usuário ainda pode revisar).

### Prompt `gerar-escala-ia/prompt.ts`

Adicionar bloco logo após "ESTRUTURA DE TURNOS":

```
TETO DE HEADCOUNT — INEGOCIÁVEL
Headcount real cadastrado no setor: ${p.headcount_max}
A soma de vagas regulares (excluindo EXTRA-*) NÃO pode ultrapassar esse número.
Se a configuração POP exigir mais vagas do que esse teto:
  1. Mantenha 100% dos abridores e fechadores nos 7 dias (POP intocável).
  2. Reduza intermediários até caber.
  3. Se mesmo assim não couber, use modelo 6x1 (1 folga/vaga) em vez de 5x2.
  4. Sinalize em validacao.alertas_operacionais a falta de capacidade.
EXTRA-ALMOCO/EXTRA-JANTAR não contam no teto (são reforços pontuais).
```

### Front — `GeradorEscalaIA.tsx`

1. Após receber resposta, se `alertas_capacidade?.length > 0`, mostrar banner amarelo com a lista (não impedir envio ao Editor).
2. Mostrar no resumo: `Vagas: X / Y disponíveis no setor`.
3. Se `modelo_folga_aplicado !== modelo_folga` solicitado, exibir aviso: "Modelo ajustado para 6x1 por falta de headcount".

## Detalhes técnicos

- Headcount real consultado via:
  ```sql
  SELECT COUNT(*) FROM employees e
  WHERE e.unit_id = $1 AND e.active = true
    AND e.job_title_id IN (
      SELECT job_title_id FROM sector_job_titles WHERE sector_id = $2
    )
  ```
  Como o gerador atual recebe `setor` (text) e não `sector_id`, resolver `sector_id` por `name = setor AND unit_id = unidade_id`.
- Função auxiliar `podarIntermediarios(vagasRegulares, headcountMax, minimos)`: remove vagas com `papelDe = 'intermediario'` (LIFO) até `length <= headcountMax`, sem tocar em abridor/fechador.
- Função auxiliar `forcar6x1(vagasRegulares)`: zera `folgas` e reaplica `escolherDiasParaVaga` com `folgasPorVaga = 1`.
- Ordem das ações de fallback: (1) trocar p/ 6x1 → (2) podar intermediários → (3) emitir alerta.

## Arquivos afetados

- `supabase/functions/gerar-escala-ia/index.ts`
- `supabase/functions/gerar-escala-ia/prompt.ts`
- `src/components/escalas/GeradorEscalaIA.tsx` (banners de capacidade/modelo)

## Verificação

1. Rodar gerador para Garçom do Caju Limão Itaim com config que pediria 30 vagas → deve sair com ≤ 26 vagas, abertura/fechamento cobertos e banner amarelo "modelo ajustado".
2. Confirmar via `ai_draft_slots` que nº de funcionários distintos ≤ 26.
3. Validar nos `cobertura_por_dia_calc` que `abridor`/`fechador` ≥ mínimo em todos os 7 dias.
