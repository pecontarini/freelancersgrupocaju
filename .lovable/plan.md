

## Plano: Modo Tablet de Check-in fixo na unidade

### Conceito
Substituir o fluxo "QR Code → celular do freelancer" por uma **estação fixa em tablet**, montada na parede ao lado do relógio de ponto. O tablet abre travado em uma unidade específica e mostra todos os freelancers **previstos do dia** (escala + lançamentos manuais do Budget) como botões grandes prontos para check-in/check-out. Freelancer não previsto continua podendo se identificar pelo CPF.

### Como será a experiência

**Tela inicial (Home do tablet)** — fica sempre aberta:
- Topo: nome da unidade + relógio em tempo real + data
- Grid grande de cards com **todos os freelancers previstos hoje** (vindos da escala e do Budget manual), ordenados por horário (escalas primeiro, manuais por nome no fim).
- Cada card mostra: foto (se já tiver perfil), nome, função, horário previsto (ou "sem horário" para manual), valor combinado, e um **badge de status**:
  - **Disponível** (azul) — ainda não fez check-in
  - **Em serviço** (verde) — fez check-in, falta check-out
  - **Concluído** (cinza) — já fez check-out hoje
- Rodapé com 2 botões grandes:
  - **"Não estou na lista"** → abre teclado de CPF (fluxo atual de cadastro/identificação)
  - **"Trocar unidade"** → exige PIN do gerente (4 dígitos, configurado por loja) para evitar troca acidental

**Tocar em um card "Disponível"** → abre fluxo direto:
1. Foto da pessoa (já cadastrada) + nome em destaque, com pergunta "É você?"
2. Botão grande **"Tirar selfie de check-in"** → abre câmera frontal do tablet
3. Confirma valor (pré-preenchido com o `agreed_rate` da escala ou `valor` do lançamento manual; pode ajustar)
4. Tela de sucesso por 5 segundos → volta pra Home

**Tocar em um card "Em serviço"** → fluxo de check-out:
1. Foto + nome + horário do check-in
2. Botão **"Tirar selfie de check-out"**
3. Tela de sucesso → volta pra Home

**"Não estou na lista" (freelancer avulso)**:
- Teclado numérico em tela cheia para CPF
- Reusa o fluxo atual: lookup → cadastro novo (se não existir) → selfie → valor → sucesso
- Após o check-in, esse freelancer passa a aparecer como card "Em serviço" na Home

**Travamento da estação**:
- Rota nova `/estacao-checkin` (ou `/checkin` adaptado) que **fixa a unidade em localStorage** após o gerente selecionar e digitar PIN.
- Recarregar a página mantém a unidade travada.
- Sem botão de "voltar" pra outras telas — modo quiosque puro.
- Auto-refresh dos cards a cada 30s + Realtime do Supabase (`freelancer_checkins`, `schedules`, `freelancer_entries`) para ficar ao vivo se alguém atualizar a escala no portal.

### O que muda tecnicamente

| Arquivo / objeto | Mudança |
|---|---|
| `src/pages/EstacaoCheckin.tsx` (novo) | Página completa do modo tablet: home com grid + sub-telas de check-in/check-out |
| `src/components/checkin/EstacaoSetup.tsx` (novo) | Tela inicial de configuração: seleção de unidade + criação de PIN do gerente |
| `src/components/checkin/EstacaoFreelancerCard.tsx` (novo) | Card grande de freelancer (foto, nome, horário, status) |
| `src/components/checkin/EstacaoSelfieCapture.tsx` (novo) | Captura selfie usando `navigator.mediaDevices.getUserMedia` (câmera frontal do tablet, sem upload de arquivo) |
| `src/components/checkin/EstacaoCpfKeypad.tsx` (novo) | Teclado numérico touch para entrada de CPF |
| `src/hooks/useEstacaoStatus.ts` (novo) | Cruza `useScheduledFreelancers` + `useFreelancerCheckins` e calcula o status (Disponível / Em serviço / Concluído) por freelancer; assina Realtime |
| `src/App.tsx` | Rota pública nova `/estacao-checkin` (sem `ProtectedRoute`) |
| `src/components/checkin/QRCodeGenerator.tsx` | Adicionar segundo modo: gerar **link da estação** além do link do freelancer (para o gerente abrir no tablet) |
| Migração SQL | Nova tabela `checkin_stations` (`id`, `loja_id`, `station_name`, `pin_hash`, `created_by`, `last_seen_at`) com RLS |
| Migração SQL | Coluna `station_id uuid NULL` em `freelancer_checkins` para auditoria de qual tablet originou o check-in |
| Edge function `verify-station-pin` (nova) | Recebe `loja_id + pin`, valida hash bcrypt, retorna token de sessão da estação (cookie ou localStorage) |

### Fluxo unificado com o que já existe

- A lista do tablet usa **a mesma fonte** que a aba Presença do gerente (`useScheduledFreelancers` + `useFreelancerCheckins`). Ou seja: tudo que aparece no Painel da Liderança como "Aguardando" aparece no tablet como "Disponível", e vice-versa.
- Check-in feito no tablet **cai exatamente no mesmo lugar** que o feito por celular hoje: vira `freelancer_checkins` com `status='open'` (e amarra ao `pending_schedule` stub via CPF, igual ao fluxo atual).
- Aprovação de presença, valor e ordem de pagamento continuam **100% iguais** no Portal da Liderança — sem mudança nenhuma na aba Presença.
- Geolocalização do tablet é capturada uma vez no boot da estação (fixa) e reusada em todos os check-ins.

### Resultado para o usuário

| Quem | Onde | O que faz |
|---|---|---|
| Gerente da unidade | Portal Liderança | Cria/escala freelancers como hoje (escala ou lançamento manual no Budget) |
| Gerente da unidade | Tablet (1ª vez) | Seleciona unidade, define PIN, deixa o tablet travado na parede |
| Freelancer previsto | Tablet | Toca no próprio card → selfie → confirma valor → pronto |
| Freelancer avulso | Tablet | "Não estou na lista" → digita CPF → cadastro/identificação → selfie → valor |
| Freelancer | Tablet (saída) | Toca no próprio card "Em serviço" → selfie de check-out |
| Gerente | Portal Liderança | Aprova presença + valor em lote, gera ordem de pagamento (idêntico a hoje) |

### O que **não** entra agora

- App nativo / modo PWA instalável (web fica responsivo para qualquer tablet — Android, iPad)
- Reconhecimento facial automático (mantém toque no card + selfie de evidência)
- Substituição do fluxo `/checkin` por celular existente — fica disponível como alternativa
- Mudanças visuais ou de regras na aba Presença / Ordem de Pagamento

### Validação

1. Em desktop em modo tablet (1024×768), abrir `/estacao-checkin` → ver tela de setup → escolher unidade + criar PIN → cair na Home.
2. Recarregar a página → continua na Home travada na mesma unidade.
3. Escalar 1 freelancer com CPF para hoje no Editor de Escalas → em <30s o card aparece como "Disponível" no tablet.
4. Lançar 1 freelancer manual no Budget Gerencial para hoje → idem aparece como "Disponível, sem horário".
5. Tocar no card → selfie pela câmera → confirmar valor → card vira "Em serviço" e some da lista de pendentes da Liderança como "Aguardando" (vira "Check-in realizado").
6. Tocar no card "Em serviço" → selfie de check-out → card vira "Concluído".
7. "Não estou na lista" → CPF novo → cadastro completo → check-in → vira card "Em serviço".
8. "Trocar unidade" sem PIN correto → bloqueia. Com PIN correto → volta ao setup.
9. Aprovar presença + valor em lote no Portal → gerar PDF de Ordem de Pagamento idêntico ao fluxo atual.

