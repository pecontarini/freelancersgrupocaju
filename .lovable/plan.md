

# Plano: Freelancers escalados aparecem automaticamente na aba Presença

## Problema

O sistema de escalas (`employees` + `schedules`) e o sistema de check-in (`freelancer_profiles` + `freelancer_checkins`) são independentes. Quando um freelancer é adicionado na escala, ele não aparece na aba "Presença" (CheckinManagerDashboard) porque nenhum registro é criado em `freelancer_checkins`.

## Abordagem

Em vez de forçar integração no banco (que exigiria CPF no modal de escalas e criação de `freelancer_profiles`), a solução é **exibir freelancers escalados diretamente no CheckinManagerDashboard**, consultando a tabela `schedules` + `employees` para o dia selecionado.

O dashboard mostrará uma seção **"Agendados na Escala"** acima dos cards de check-in existentes, listando freelancers que foram escalados mas ainda não fizeram check-in. Freelancers que já têm um `freelancer_checkins` correspondente (match por nome) serão marcados como "Check-in realizado".

## Mudanças

### 1. Novo hook: `src/hooks/useScheduledFreelancers.ts`

- Recebe `unitId` e `date`
- Busca `schedules` com status `working` para a data, fazendo join com `employees` onde `worker_type = 'freelancer'`
- Retorna lista: `{ employeeName, jobTitle, startTime, endTime, agreedRate, scheduleDate }`

### 2. Modificar: `src/components/checkin/CheckinManagerDashboard.tsx`

- Importar o novo hook
- Na tab "Presença", acima dos cards de check-in, renderizar uma seção "Agendados na Escala" com cards compactos mostrando:
  - Nome do freelancer
  - Cargo
  - Horário escalado (ex: 08:00 – 16:20)
  - Valor da diária (R$)
  - Badge de status: "Aguardando Check-in" (amarelo) ou "Check-in realizado" (verde, se houver match por nome em `freelancer_checkins`)
- A seção só aparece se houver freelancers escalados
- Design usa os mesmos componentes de Card/Badge do sistema existente

### 3. Lógica de match

Para determinar se um freelancer escalado já fez check-in:
- Compara `employee.name` (da escala) com `freelancer_profiles.nome_completo` (do check-in) via normalização (lowercase, trim)
- Se houver match, o card mostra "Check-in realizado" em verde
- Se não, mostra "Aguardando Check-in" em amarelo/warning

## Arquivos impactados

| Arquivo | Ação |
|---------|------|
| `src/hooks/useScheduledFreelancers.ts` | Criar |
| `src/components/checkin/CheckinManagerDashboard.tsx` | Modificar (adicionar seção de agendados) |

Nenhuma alteração no banco de dados necessária. Os dados já existem nas tabelas `schedules` e `employees`.

