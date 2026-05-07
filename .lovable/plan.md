## Diagnóstico

O envio está gravando as vagas no banco, mas elas não aparecem no Editor porque o gerador está salvando `week_start = 2026-05-05` para a escala dos Cumins. O Editor calcula a semana sempre pela segunda-feira (`startOfWeek`), então para qualquer data dentro dessa semana ele procura `week_start = 2026-05-04`. Resultado: os rascunhos existem, mas ficam em uma semana que o Editor nunca consulta.

Também encontrei outro bloqueio potencial: a lógica atual trata múltiplos setores similares como ambíguos em algumas unidades (`Cumin`, `CUMINS`, `CUMIM`), o que pode impedir o envio antes mesmo de gravar.

## Plano de correção

1. **Normalizar a semana no Gerador IA**
   - Criar uma função local para converter qualquer data selecionada para a segunda-feira da semana.
   - Usar essa data normalizada em:
     - chamada da função `gerar-escala-ia`
     - `week_start` dos rascunhos
     - evento `ai-drafts-ready`
     - cálculo dos dias exibidos/enviados ao Editor
   - Assim, mesmo que o usuário selecione terça (`2026-05-05`), o Editor receberá segunda (`2026-05-04`).

2. **Ajustar o campo de data**
   - Quando o usuário escolher uma data, converter automaticamente para a segunda-feira correspondente.
   - Manter a tela coerente com o texto “Semana (segunda-feira)”.

3. **Tornar o match de setor determinístico**
   - Se existir setor com nome exatamente igual normalizado (`CUMIN`), usar ele imediatamente.
   - Se houver múltiplos similares, preferir a opção mais curta/exata por similaridade, em vez de bloquear como ambígua quando há escolha segura.
   - Manter erro explícito somente quando realmente não houver candidato confiável.

4. **Melhorar a confirmação do envio**
   - Exibir no toast a semana normalizada usada no Editor.
   - Disparar o evento com `unitId`, `sectorId` e `weekStart` normalizados para trocar automaticamente para o Editor.

5. **Verificação**
   - Confirmar via consulta que os novos rascunhos de Cumins ficam com `week_start` na segunda-feira.
   - Validar que o Editor passará a buscar a mesma chave (`unit + sector + monday week_start`) que o gerador grava.