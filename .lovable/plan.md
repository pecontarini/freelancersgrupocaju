## Diagnóstico

Caju Itaim tem **dois cargos duplicados** na tabela `job_titles`, escritos diferente:

| job_title_id | nome | nº funcionários | vinculado ao setor GARÇOM? |
|---|---|---|---|
| `9a8fa0a8…` | **Garçom** (com cedilha) | 20 | ❌ não |
| `d10914ee…` | **Garcom** (sem cedilha) | 2 (Lucas Lopes Sampaio, Wellington Manoel Bezerra Leal) | ✅ sim |

O editor de escalas filtra funcionários por `sector_job_titles` → só lista quem tem `job_title_id` vinculado ao setor. Por isso só aparecem **2 garçons** (os do cargo "Garcom" sem cedilha), apesar de existirem 22 ativos.

A tela "Equipes" não filtra por essa vinculação — mostra todos, agrupados por nome do cargo (daí os "dois grupos").

## Causa raíz

Cargo duplicado por divergência de acentuação. Provavelmente o "Garcom" sem cedilha foi criado primeiro e vinculado ao setor; depois alguém recadastrou "Garçom" com cedilha e os novos funcionários foram para esse, que ficou órfão de setor.

## Plano de correção (apenas Caju Itaim)

Consolidar tudo no cargo correto (`Garçom` com cedilha — o que tem 20 funcionários) e remover o duplicado.

**Migração SQL (via insert tool):**

1. **Migrar os 2 funcionários** do cargo errado para o correto:
   ```sql
   UPDATE employees
     SET job_title_id = '9a8fa0a8-61da-4802-8089-58df2336f2f8',
         job_title    = 'Garçom'
     WHERE unit_id = '87228077-03ab-445b-a409-237972ee6719'
       AND job_title_id = 'd10914ee-bc4b-4b83-b87d-723bf01103b2';
   ```

2. **Mover o vínculo do setor** do cargo errado para o correto:
   ```sql
   UPDATE sector_job_titles
     SET job_title_id = '9a8fa0a8-61da-4802-8089-58df2336f2f8'
     WHERE id = '740297ad-1840-4fce-869a-95307f75ed19';
   ```

3. **Excluir o cargo duplicado** "Garcom" (sem cedilha):
   ```sql
   DELETE FROM job_titles WHERE id = 'd10914ee-bc4b-4b83-b87d-723bf01103b2';
   ```

## Resultado esperado

- Editor de escalas passa a listar **os 22 garçons ativos** da Caju Itaim.
- Tela "Equipes" mostra **um único grupo** "Garçom".
- Nenhum impacto em escalas já criadas (o `sector_job_titles` foi reapontado, não removido; e funcionários migrados mantêm seus `schedule_id` históricos via `employee_id`).

## Observação para evitar reincidência

Vale considerar (próxima onda, fora deste fix) uma constraint `UNIQUE(unit_id, lower(unaccent(name)))` em `job_titles` para impedir cadastro de "Garçom"/"Garcom" duplicados. Não vou tocar agora — só sinalizo.