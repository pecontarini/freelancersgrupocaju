

## Plano: Rota DEMO `/checkin-demo` para experiência do freelancer

### Objetivo
Criar uma página **DEMO 100% funcional visualmente, sem persistência no banco**, espelhando o fluxo de check-in/check-out do freelancer (`/checkin`). Permite revisar UX, copy, ordem das etapas, validações e visual antes de mexer no fluxo real.

### O que a DEMO terá

**Rota nova**: `/checkin-demo` (pública, sem `?unidade=` obrigatório — usa unidade fictícia "Caju Limão - Demo").

**Painel de controle DEMO** (barra fixa no topo, só na demo):
- Seletor de **cenário** inicial:
  - "Freelancer novo" → entra no fluxo `cpf → register → selfie → value → done`
  - "Freelancer já cadastrado (1º check-in do dia)" → `cpf → confirm → selfie → value → done`
  - "Freelancer com check-in em aberto (check-out)" → `cpf → confirm → selfie → done`
  - "Freelancer agendado na escala (valor pré-preenchido)" → igual ao já cadastrado, mas com valor R$ 120 já no campo
- Botão **"Pular para etapa…"** (cpf, register, confirm, selfie, value, done) — para revisar uma tela específica em segundos
- Botão **"Reiniciar demo"**
- Toggle **"Simular GPS off"** / **"Simular câmera negada"** para ver os estados de erro
- Indicador grande "MODO DEMO — nenhuma alteração será salva"

**Comportamento sem banco**:
- CPF aceita qualquer valor de 11 dígitos (com validação de formato visual)
- Foto de perfil e selfies usam **upload local** (FileReader → preview), sem chamar a edge `checkin-upload-photo`
- Câmara: usa `<input type="file" capture="user">` igual ao real, mas o resultado fica só em memória
- "Salvar" em qualquer etapa apenas avança o `step` e mostra um toast verde de mock
- Lookup de CPF é simulado: se o CPF começa com "111…" → novo; se começa com "222…" → já cadastrado; se com "333…" → check-in aberto. Independente do cenário inicial, o usuário pode testar variações digitando.

**Telas espelhadas (idênticas visualmente ao real)**:
1. Identificação (CPF) com dica de CPFs de teste
2. Cadastro completo (nome, telefone, Pix, foto de perfil)
3. Confirmar dados (com foto, edição inline)
4. Selfie (câmera frontal nativa, preview, retomar)
5. Valor do serviço (com auto-preenchimento se vier de "agendado")
6. Tela final de sucesso (check-in ou check-out)

**Bonus de UX visível na demo**:
- Banner de progresso no topo dos cards: "Etapa 2 de 5"
- Mensagem contextual no cabeçalho: "Você é freelancer agendado para hoje às 18h" quando o cenário for de escala
- Aviso visual claro em check-out: card amarelo "Você fez check-in às 18:03 — registre sua saída"

### Arquitetura

**Arquivo único novo**: `src/pages/FreelancerCheckinDemo.tsx`
- Cópia adaptada de `FreelancerCheckin.tsx`, com:
  - Todos os hooks Supabase (`useFreelancerProfiles`, `useFreelancerCheckins`, `useCpfLookup`) **substituídos por mocks locais** (objetos em memória)
  - Função `uploadPhoto` substituída por `Promise.resolve(base64)` (devolve o próprio data-URL)
  - Adição do painel de controle no topo
  - Mesma estrutura visual (Tailwind, shadcn, ícones, copy)

**Rota nova em `src/App.tsx`**: `<Route path="/checkin-demo" element={<FreelancerCheckinDemo />} />` — pública, sem ProtectedRoute.

**Nada mais é tocado**: `/checkin` real, hooks, edge functions, banco — tudo intacto.

### Como você vai usar
1. Abrir `https://freelancersgrupocaju.lovable.app/checkin-demo` no celular ou desktop
2. Escolher um cenário no painel DEMO no topo
3. Percorrer o fluxo real, ou pular direto para a tela que quer ajustar
4. Marcar tudo que precisa mudar (copy, ordem de campos, botões, mensagens, cores) — depois aplicamos no `/checkin` real numa segunda rodada

### O que **não** entra agora
- Mudanças no fluxo real `/checkin`
- Mudanças no dashboard do gestor (`CheckinManagerDashboard`)
- Mudanças no banco, RLS, triggers ou edge functions
- Conexão da demo com dados reais

### Validação
- Abrir `/checkin-demo` em desktop e celular → ver painel DEMO + tela de CPF
- Cenário "novo" → preencher CPF, cadastro, selfie, valor → ver tela de sucesso, sem nenhum registro no banco
- Cenário "check-out" → CPF, confirmar, selfie → tela de sucesso de saída
- Botão "Pular para…" leva direto a qualquer tela
- "Reiniciar demo" volta ao começo limpo
- `/checkin?unidade=…` real continua funcionando idêntico (smoke test rápido)

