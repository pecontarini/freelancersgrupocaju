

## Plano: Cadastro e Gestão de Praças do Plano de Chão

### Diagnóstico
Hoje o sistema já lê `pracas_plano_chao` no Editor de Escalas (seletor de praça + painel de status), mas **não existe tela para cadastrar/editar essas praças**. O seed inicial criou as praças padrão, mas qualquer ajuste por loja precisa ser feito direto no banco. Falta o lado administrativo que fecha o ciclo: cadastrar → vincular → monitorar.

### Onde colocar
Dentro de **Escalas > Configurações**, adicionar uma nova sub-seção “Plano de Chão (Praças)” logo abaixo de “Vincular Cargos por Setor”. Mesmo módulo, mesmo padrão visual, sem criar nova rota.

### O que será construído

**1. Componente `PracasConfig.tsx` (novo)**
- Seletor de unidade (igual aos outros configs do módulo)
- Para a unidade escolhida, lista as praças agrupadas por **Setor → Turno (Almoço/Jantar/Tarde)**
- Cada praça mostra:
  - Nome da praça (ex: “Garçom Almoço”, “Fogão”)
  - Linha com 7 inputs numéricos (Seg → Dom) para `qtd_necessaria`
  - Botão de remover praça
- Botões de ação por setor:
  - “+ Nova praça” (abre diálogo: nome + turno; cria as 7 linhas Seg-Dom com qtd=1)
  - “Replicar de outra loja” (copia praças de uma unidade origem para a atual)
- Botão global “Aplicar seed padrão” (apenas se a loja não tem praças cadastradas) — usa o mesmo conjunto do seed inicial

**2. Hook `usePracasAdmin.ts` (novo)**
- `useUpsertPraca` — criar/atualizar uma praça (linha única setor+nome+turno+dia)
- `useUpdatePracaQtd` — atualizar `qtd_necessaria` (chamado em onBlur do input)
- `useDeletePraca` — remover praça
- `useDeletePracaGrupo` — remover todas as 7 linhas de uma praça (setor+nome+turno)
- `useReplicarPracas` — copiar todas as praças de uma unidade origem para destino
- `useApplySeedPracas` — inserir o pacote padrão (Subchefe, Garçom, Cumin, Hostess, Caixa, Parrilla, Cozinha, Bar, Serv. Gerais, Produção)
- Invalida `["pracas-unit", unitId]` (mesma queryKey usada no Editor de Escalas) para sincronizar instantaneamente

**3. Integração com setores existentes**
- Carregar `sectors` da unidade via hook já existente (`useSectors`)
- Ao criar praça, oferecer dropdown com os setores cadastrados na loja (evita digitar nome solto que não casa com `sectors.name` usado no fuzzy match do `usePracas`)
- Mostrar aviso se houver praça com `setor` que não bate com nenhum `sectors.name` da unidade (ajuda a corrigir desalinhamentos)

**4. Conexão com o Editor de Escalas (já pronta)**
- Não precisa mexer em `ManualScheduleGrid`, `ScheduleEditModal` ou `usePracas` — eles já consomem `pracas_plano_chao` por unidade/setor/turno/dia
- A invalidação de cache faz com que qualquer alteração apareça imediatamente no seletor de praça e no painel “Plano de chão — status do turno”

**5. RLS**
- A tabela `pracas_plano_chao` provavelmente já está liberada para leitura (o hook lê hoje). Vou verificar e, se necessário, adicionar policies de INSERT/UPDATE/DELETE para `admin` e `operator` (mesmo padrão de `staffing_matrix`).

### Arquivos
- **Novo**: `src/components/escalas/PracasConfig.tsx`
- **Novo**: `src/hooks/usePracasAdmin.ts`
- **Editado**: `src/components/escalas/EscalasTab.tsx` (renderizar `PracasConfig` na aba Configurações, abaixo de `SectorJobTitleMapping`)
- **Migration** (se necessário): policies RLS de escrita em `pracas_plano_chao`

### Fluxo final do usuário
1. Vai em **Escalas > Configurações > Plano de Chão**
2. Escolhe a loja (ex: MULT 12)
3. Vê todos os setores e suas praças por turno
4. Ajusta as quantidades por dia da semana inline, ou cria/remove praças
5. Volta para **Editor de Escalas** → ao escalar um colaborador, o seletor “Praça” já mostra as opções atualizadas e o painel “Plano de chão” reflete a nova realidade

### Resultado esperado
Ciclo completo: **cadastrar praça → escalar colaborador na praça → acompanhar cobertura por turno**, tudo dentro do módulo de Escalas, sem alterar nada fora dele.

