
## Objetivo

Cadastrar, para o tenant **Stutz**, os setores e cargos listados, replicados nas duas unidades ativas:
- **SANTA LUCIA NORTE**
- **SANTA LUZIA ASA SUL**

Todos ligados via `sector_job_titles` para já ficarem utilizáveis nos módulos (Escalas, Freelancers, POP, etc.).

## Setores (7) — replicados nas 2 unidades

1. COPEIRAS
2. ASG
3. COZINHA
4. TÉC NUTRIÇÃO
5. ESTOQUE
6. ADM
7. NUTRICIONISTA

## Cargos por setor (22 distintos)

- **COPEIRAS** (11): LACTARISTA · UTI TERREA + EMERGENCIA · UTI ONCO + TMO · CLINICA MEDICA E UCCA · MATERNIDADE E ESTAR MEDICO · UTI ADULTO E CIRURGICA · UTI PED · TERREO E 2º ANDAR - HCBR · 1º ANDAR - HCBR · COPEIRA (AVIÃO) · DAY CLINIC
- **ASG** (2): PANELAS · LIMPEZA GERAL
- **COZINHA** (4): COLAÇÃO · AUXILIAR DO COZINHEIRO · SALADEIRA · AUXILIAR DE COZINHA - DIETÉTICA
- **TÉC NUTRIÇÃO** (2): COZINHA · LÁCTARIO
- **ESTOQUE** (1): ESTOQUE
- **ADM** (2): TASY · QR CODE
- **NUTRICIONISTA** (1): NUTRIÇÃO

## Como será feito (técnico)

Um único bloco SQL idempotente via ferramenta `insert`, usando CTEs sobre as 2 unidades Stutz:

1. `INSERT ... ON CONFLICT DO NOTHING` em `public.sectors` (unit_id, name, tenant_id).
2. `INSERT ... ON CONFLICT DO NOTHING` em `public.job_titles` (unit_id, name, tenant_id).
3. `INSERT ... ON CONFLICT DO NOTHING` em `public.sector_job_titles` juntando cada cargo ao seu setor, dentro da mesma unidade.

Total: 14 setores (7 × 2 unidades), 44 cargos (22 × 2), e 44 vínculos setor↔cargo.

Nada de mexer em schema/RLS — só dados. Depois de rodar, os setores e cargos aparecem em Escalas/POP/Freelancer normalmente para usuários Stutz.
