## Problema

O `plano_folgas` atual distribui folgas olhando só a **demanda diária total** (pico almoço/jantar). Resultado: dias acabam com headcount suficiente no pico, mas **sem o mínimo obrigatório de abridores e fechadores** definido em `turno_config` (`qtd_abridores`, `qtd_fechadores`, `qtd_intermediarios`).

Ex.: numa Quinta (Tipo C), todas as folgas dos fechadores caíram no mesmo dia → ninguém para fechar até 02h30, mesmo o headcount total batendo.

## Solução: cobertura por papel + por dia

Trocar a regra "headcount total ≥ demanda" por **três restrições simultâneas por dia**:

1. `abridores_em_campo[d] ≥ qtd_abridores` (mínimo POP de abertura)
2. `fechadores_em_campo[d] ≥ qtd_fechadores` (mínimo POP de fechamento)
3. `intermediarios_em_campo[d] ≥ qtd_intermediarios`
4. (mantém) headcount total ≥ demanda do pico

Cada vaga já nasce tipada (`ABRIDOR-DOBRA`, `FECHADOR-PURO`, `INTERMEDIARIO-DOBRA`, etc.). A folga só é aceita se, **removendo aquela vaga naquele dia, o mínimo do papel dela continua atendido**.

## Mudanças

### 1. `supabase/functions/gerar-escala-ia/prompt.ts`

Reescrever o bloco "PLANEJAMENTO DE FOLGAS — DISTRIBUÍDO POR VAGA":

- Definir `papel(vaga)` ∈ {ABRIDOR, FECHADOR, INTERMEDIARIO} a partir do `tipo`.
- Headcount mínimo por papel = valores recebidos no prompt (`qtd_abridores`, `qtd_fechadores`, `qtd_intermediarios`).
- Headcount total por papel na semana:
  ```
  vagas_papel = ceil( (qtd_papel * dias_semana) / dias_uteis_por_pessoa )
  ```
  (6x1 → /6, 5x2 → /5). Garante folga sem furar o mínimo diário.
- Distribuir folgas **dentro de cada papel** rotacionando entre os 7 dias, validando após cada atribuição:
  - `papel_em_campo[d] ≥ qtd_papel` para todo d.
  - 5x2: pares consecutivos quando possível.
- Adicionar ao JSON de saída:
  ```
  plano_folgas.minimos_por_papel: { abridor, fechador, intermediario }
  plano_folgas.cobertura_por_dia: {
    SEG: { abridor_em_campo, fechador_em_campo, intermediario_em_campo, headcount_total },
    ...
  }
  ```
- Novo item de validação: "se cobertura_por_dia[d].papel < minimos_por_papel.papel → adicione em alertas_folga".
- Atualizar CHECKLIST para incluir "□ Mín. abridores/fechadores/intermediários atendido em todos os 7 dias".

### 2. `supabase/functions/gerar-escala-ia/index.ts`

Estender a validação do `plano_folgas` (logo após o loop atual):

- Para cada dia ∈ DIAS, contar vagas por papel **não em folga** naquele dia.
- Comparar com `config.qtd_abridores / qtd_fechadores / qtd_intermediarios`.
- Se faltar, push em `alertasFolga` (`SEG: 1 abridor em campo < mínimo 2`).
- Bloquear retorno (422) se `alertasFolga.length > 0` — hoje só anexa avisos. Como o usuário disse que isso é **obrigatório**, virar erro duro.

### 3. `src/components/escalas/GeradorEscalaIA.tsx`

No painel "Plano de folgas", adicionar uma segunda mini-tabela:
- Linhas: Abridor / Fechador / Intermediário / Total
- Colunas: SEG..DOM
- Célula: `em_campo / mínimo` — vermelho se em_campo < mínimo.

Lê de `resultado.plano_folgas.cobertura_por_dia` e `minimos_por_papel`.

## Arquivos
- `supabase/functions/gerar-escala-ia/prompt.ts`
- `supabase/functions/gerar-escala-ia/index.ts`
- `src/components/escalas/GeradorEscalaIA.tsx`

## Como testar
Rodar o gerador para a mesma semana de teste. O JSON deve agora trazer `cobertura_por_dia`; se o modelo tentar colocar duas folgas de fechador no mesmo Tipo C, o edge retorna 422 com `alertas_folga` apontando o dia/papel furado, forçando nova geração.