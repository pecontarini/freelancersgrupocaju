# Cadastro das unidades e equipes da Stutz

Importar os 9 PDFs de "Dados Ativos" para dentro da Stutz, criando as unidades que ainda não existem e organizando cada pessoa na sua unidade, cargo e setor.

## O que será criado

7 novas unidades na Stutz (nomes conforme os arquivos):

| Unidade | Empresa (CNPJ do PDF) | Ativos |
|---|---|---|
| BALI PARK | HOTTI ALIMENTAÇÃO | 8 |
| CPA | HOTTI ALIMENTAÇÃO | 61 |
| HOT COZINHA | HOT COZINHA INDUSTRIAL (…/0003-97) | 62 |
| HSLG | HOTTI ALIMENTAÇÃO | 77 |
| MASTER SP | HOT COZINHA INDUSTRIAL (…/0008-00) | 6 |
| MUNDIAL | HOTTI ALIMENTAÇÃO | 6 |
| VITRAL | HOTTI ALIMENTAÇÃO | 4 |

Unidades já existentes que serão atualizadas:

- SANTA LUZIA ASA SUL (arquivo HSL, 146 ativos) — hoje com 172 cadastrados
- SANTA LUCIA NORTE (arquivo HSLN, 106 ativos) — hoje sem funcionários

## Como os dados serão organizados

- **Funcionários**: nome, CPF (parcial, como consta no PDF), cargo, tipo CLT, vinculados à unidade correta.
- **Cargos**: os cargos do PDF são normalizados para nomes canônicos por unidade (ex.: "AUXILIAR COZINHA", "AUX. DE COZINHA" e "AJUD.DE COZINHA" → "AUXILIAR DE COZINHA"), reaproveitando o padrão já criado para SANTA LUZIA ASA SUL.
- **Setores**: cada unidade recebe os setores necessários (COZINHA, COPEIRAS, ASG, ADM, NUTRICIONISTA, TÉC NUTRIÇÃO, ESTOQUE) e os cargos são vinculados a eles, para que os funcionários já apareçam agrupados no editor de escalas.
- **Horários de referência**: os horários de entrada/saída de cada pessoa serão guardados no cadastro para pré-preencher escalas (inclui turnos que viram a noite, ex.: 20:00–05:48).
- **Reconciliação do HSL**: quem está no PDF é atualizado (cargo/horário), quem falta é criado e quem não consta mais na lista de ativos é inativado (não excluído, preservando histórico de escalas).

## Detalhes técnicos

1. Migração: adicionar `default_start_time` e `default_end_time` (time, nulos) em `employees`, para guardar o horário de referência.
2. Migração: criar as 7 unidades em `config_lojas` com `tenant_id` da Stutz; criar `sectors`, `job_titles` e vínculos `sector_job_titles` por unidade.
3. Inserção de dados: extrair cada PDF com `pdftotext -layout`, normalizar cargos via tabela de aliases e inserir em `employees` com `worker_type = 'clt'` e IDs fictícios de Secullum (faixa 900001+) quando exigido pelo guardian, seguindo o mesmo padrão do import anterior do HSL.
4. Reconciliação do HSL/HSLN por CPF + nome normalizado; inativação via `active = false` (o trigger de guardian remapeia escalas órfãs).
5. Deduplicação respeitando os índices únicos existentes (`unique_active_employee_no_cpf`, `employees_banco_secullum_unique`).
6. Verificação final: contagem por unidade, cargos sem setor e funcionários sem cargo, com relatório no chat.

## Fora do escopo

- Criação de acessos/logins para essas pessoas.
- Matriz POP / escala mínima das novas unidades (pode ser feita depois).
