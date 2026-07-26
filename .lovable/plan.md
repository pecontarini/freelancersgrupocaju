## Objetivo
Ao clicar num setor no criador de escala, aparecerem automaticamente todos os funcionários daquele setor. O motor já filtra funcionários via `sector_job_titles` (setor → cargos → funcionários) — falta arrumar os dados da HSL, que hoje têm setores duplicados, cargos órfãos e 37 funcionários sem `job_title_id`.

## Situação atual (SANTA LUZIA ASA SUL)

Setores duplicados/inconsistentes:
- `AUXILIAR DE SERVIÇOS GERAIS` (2x) — consolidar em 1
- `COPEIRAS` + `COPEIRO(A)` — consolidar em `COPEIRAS`
- `AUXILIAR DE COZINHA` + `COZINHA` — consolidar em `COZINHA`
- `ESTOQUE` + `ESTOQUISTA` — consolidar em `ESTOQUE`
- `TÉC NUTRIÇÃO` + `TECNICO DE NUTRIÇÃO` — consolidar em `TÉC NUTRIÇÃO`

Cargos: `Concierge` vs `CONCIERGE`, `Garçom` (só variante minúscula) — normalizar para maiúsculo.

Funcionários: 37 sem `job_title_id` (importação não conseguiu resolver o cargo textual).

## Plano

### 1. Deduplicar setores da unidade
Migration que, para cada par duplicado, reaponta `sector_job_titles` do setor "descartado" para o "canônico", depois apaga o duplicado. Resultado: 10 setores limpos na HSL.

### 2. Deduplicar/normalizar cargos
- Fundir `Concierge` (minúsculo) em `CONCIERGE`, reapontando `employees.job_title_id` e `sector_job_titles`.
- Renomear `Garçom` → `GARÇOM` (só cosmético; já linkado).

### 3. Corrigir funcionários sem `job_title_id`
Rodar `UPDATE employees SET job_title_id = jt.id FROM job_titles jt WHERE employees.job_title = jt.name` (case-insensitive) para os 37 registros da unidade.

### 4. Auto-vincular cargos → setores (HSL)
Inserir vínculos em `sector_job_titles` com base no mapeamento abaixo (idempotente, via `ON CONFLICT DO NOTHING`):

```text
ADM                          → CONCIERGE, SUPERVISOR DE CONCIERGE, QR CODE, TASY, COORDENADOR
ADMINISTRATIVO               → ADMINISTRATIVO, AUXILIAR ADMINISTRATIVO, ENCARREGADO
ASG                          → LIMPEZA GERAL, PANELAS, AUXILIAR DE SERVIÇOS GERAIS
AUXILIAR DE SERVIÇOS GERAIS  → LIMPEZA GERAL, PANELAS
COZINHA                      → COZINHEIRO(A) HOSPITALAR, AUXILIAR DO COZINHEIRO,
                               AUXILIAR DE COZINHA - DIETÉTICA, SALADEIRA, COLAÇÃO,
                               CONFEITEIRA, SUPERVISORA DE PRODUÇÃO
COPEIRAS                     → COPEIRO(A) HOSPITALAR, COPEIRA (AVIÃO), GARÇOM, LACTARISTA,
                               LÁCTARIO, 1º ANDAR - HCBR, TERREO E 2º ANDAR - HCBR,
                               CLINICA MEDICA E UCCA, DAY CLINIC, MATERNIDADE E ESTAR MEDICO,
                               UTI ADULTO E CIRURGICA, UTI ONCO + TMO, UTI PED,
                               UTI TERREA + EMERGENCIA
ESTOQUE                      → ESTOQUE, AUXILIAR DE ESTOQUE
NUTRICIONISTA                → NUTRIÇÃO
TÉC NUTRIÇÃO                 → COZINHA - TÉC NUTRIÇÃO, LÁCTARIO
```

### 5. Verificação
Após aplicar, rodar select conferindo:
- 0 setores duplicados
- 0 funcionários ativos sem `job_title_id`
- Cada setor com N ≥ 1 vínculos e M ≥ 1 funcionários elegíveis

## Entregável
Uma única migration SQL (deduplicação + vínculos) escopada apenas à unidade HSL — nenhuma alteração de código de front-end. Ao abrir o criador de escalas e clicar num setor, os funcionários já aparecem automaticamente.
