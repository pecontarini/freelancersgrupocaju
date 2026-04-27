
# Plano: Metas Customizadas por Cargo + Importação de Tempo de Comanda

## 🎯 Objetivos

1. **Botão "Adicionar Meta"** na seção de Metas por Cargo (`CargosConfigSection`), permitindo criar uma nova meta com:
   - Tipo de meta (codigo_meta)
   - Teto em R$
   - Peso
   - Origem do dado
   - Ativo (toggle)
2. **Editar** todos esses campos em metas existentes (hoje só edita `teto_valor`).
3. **Ativar/desativar** metas individualmente sem precisar excluir.
4. **Suporte a "Tempo de Comanda" / Tempo de Prato** no motor de importação de IA já existente (`AiImportSection` na Holding Central) — sem criar botão novo, reaproveitando o mesmo fluxo de upload.
5. Adicionar a meta `tempo_prato` automaticamente para os cargos de **Chefia** (Cozinha, Bar, Parrilla, Sushi, Salão, APV) e Gerência, prontas para receber dados.

---

## 📊 Análise do estado atual

✅ Schema `metas_cargo` já suporta tudo o que precisamos:
- `id`, `cargo_id`, `codigo_meta` (enum), `teto_valor`, `peso`, `origem_dado` (enum), `ativo`, timestamps.
- Enum `codigo_meta` já contém: `nps_salao | nps_delivery | supervisao | conformidade_setor | tempo_prato`
- Enum `origem_dado` já contém: `sheets | pdf | kds | manual`

✅ O hook `useMetasCargo` já tem `updateMeta`, mas **não tem `createMeta` nem `deleteMeta`**.

✅ O componente `CargosConfigSection.tsx` só edita `teto_valor` inline; precisa ganhar:
- Botão "+ Adicionar Meta" por cargo
- Modal/diálogo com formulário completo
- Switch para `ativo`
- Edição de `peso` e `origem_dado`

✅ Motor de IA (`ai-import-extract` + `ai-import-confirm`) já reconhece `tempo_prato_avg` em `store_performance` (campo já presente no `SCHEMA_DEFINITIONS` linha 89). Falta:
- Reforçar o prompt para reconhecer variações ("Tempo de Comanda", "Tempo Médio de Prato", "Tempo KDS", em minutos ou mm:ss).
- Permitir um "destino" mais explícito no `AiImportSection` para o usuário sinalizar que o arquivo é de tempo de prato (chip/dica de destino opcional).

---

## 🛠️ Mudanças

### 1. Banco de dados (migração)

**Sem alteração de schema** — o modelo já suporta tudo. Apenas:
- **Seed/Insert** de metas `tempo_prato` (inativas por padrão, teto R$ 0, peso 0) para os cargos de Chefia e Gerência que ainda não têm essa meta, para que apareçam listadas na UI prontas para o admin configurar.
- Adicionar `UNIQUE (cargo_id, codigo_meta)` em `metas_cargo` para impedir duplicatas (caso ainda não exista).

### 2. Hook `src/hooks/useCargos.ts`

Adicionar duas mutations no `useMetasCargo`:

```ts
const createMeta = useMutation({
  mutationFn: async (params: {
    cargo_id: string;
    codigo_meta: CodigoMeta;
    teto_valor: number;
    peso: number;
    origem_dado: OrigemDado;
    ativo: boolean;
  }) => {
    const { error } = await supabase.from('metas_cargo').insert(params);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['metas_cargo'] });
    toast.success('Meta adicionada!');
  },
});

const deleteMeta = useMutation({ /* delete by id */ });
```

A mutation `updateMeta` já existe e aceita `Partial<MetaCargo>`, então não precisa mudar — basta passar `peso`, `origem_dado`, `ativo` quando editado.

### 3. Componente `src/components/CargosConfigSection.tsx`

- Importar `Dialog`, `Switch`, `Select`, `Trash2` icon.
- Por baixo da tabela de metas de cada `CargoCard`, adicionar:
  ```
  <Button variant="outline" size="sm">+ Adicionar Meta</Button>
  ```
- Abrir um `Dialog` com formulário:
  - Select **Tipo de Meta** (codigo_meta) — opções de `META_LABELS`, filtrando as que já existem no cargo
  - Input **Teto (R$)** — usar `formatCurrency` no display
  - Input **Peso** (number, default 1)
  - Select **Origem do Dado** — `sheets | pdf | kds | manual`
  - **Switch "Ativo"** (default ligado)
  - Botões: Cancelar / Salvar
- Na tabela de metas existente:
  - Adicionar **Switch "Ativo"** em cada linha (chama `updateMeta.mutate({ id, ativo: !meta.ativo })`)
  - Permitir editar **Peso** e **Origem** inline (já temos padrão de edição inline para teto)
  - Adicionar botão **lixeira** (com confirmação) → `deleteMeta`
- Carregar **TODAS** as metas (não só `ativo=true`) para que o admin possa reativar metas desativadas. Atualizar a query do hook ou criar variante `useMetasCargo({ includeInactive: true })`.

### 4. Motor de importação de IA — suporte a Tempo de Comanda

#### 4a. `supabase/functions/ai-import-extract/index.ts`

Reforçar o prompt em `SCHEMA_DEFINITIONS` (linhas 87–92) e nas regras (`REGRAS:`) para deixar explícito o reconhecimento de "Tempo de Comanda":

- Adicionar nota:
  > Para "Tempo de Comanda", "Tempo de Prato", "Tempo Médio KDS" ou similares: mapear para `tempo_prato_avg` em `store_performance` (mensal) ou criar novo destino diário se vier por dia. Sempre converter para **minutos** (mm:ss → minutos decimais; "00:08:32" → 8.53). Origem provável: `kds`.
- Adicionar exemplos explícitos de cabeçalhos comuns de relatórios KDS (Consumer, Goomer, etc.) para a IA reconhecer.

#### 4b. `supabase/functions/ai-import-confirm/index.ts`

Já trata `tempo_prato_avg` corretamente em `store_performance` (linha 110). Garantir que aceite o formato mm:ss adicionando um helper `parseDurationToMinutes`:

```ts
function parseDurationToMinutes(v: any): number | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  // mm:ss ou hh:mm:ss
  const parts = s.split(":").map((p) => parseInt(p, 10));
  if (parts.every((n) => !isNaN(n))) {
    if (parts.length === 2) return parts[0] + parts[1] / 60;
    if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  }
  return parseNumber(v); // já vem em minutos
}
```

E aplicar: `tempo_prato_avg: parseDurationToMinutes(r.tempo_prato_avg ?? r.tempo_prato ?? r.tempo_comanda)`.

#### 4c. `src/components/dashboard/AiImportSection.tsx`

Adicionar à lista de "destinos" um chip/Select **opcional** "Tempo de Comanda (KDS)" que envia `hintDestino: "store_performance"` mais um campo `subtipo: "tempo_prato"` no body — usado pelo extract para reforçar o prompt. Sem novo botão, mesmo fluxo de upload.

### 5. Memória de projeto

Atualizar `mem://logic/variable-remuneration-and-kpi-engine` (já existe) para refletir que metas de cargo são agora 100% customizáveis (teto, peso, origem, ativo) e que `tempo_prato` é importado via o motor central de IA (mesmo botão de upload da Holding Central).

---

## 📁 Arquivos afetados

**Editados:**
- `src/components/CargosConfigSection.tsx` — UI de adicionar/editar/desativar metas
- `src/hooks/useCargos.ts` — `createMeta` + `deleteMeta` + opção de carregar inativas
- `src/components/dashboard/AiImportSection.tsx` — chip "Tempo de Comanda"
- `supabase/functions/ai-import-extract/index.ts` — prompt reforçado
- `supabase/functions/ai-import-confirm/index.ts` — helper `parseDurationToMinutes`

**Criados:**
- Migração SQL: índice único `(cargo_id, codigo_meta)` + insert de metas `tempo_prato` inativas para Chefias e Gerências que ainda não têm.

---

## ✅ Resultado esperado

1. Admin abre **Configurações → Cargos V2** → expande qualquer cargo → clica "+ Adicionar Meta" → escolhe tipo/teto/peso/origem/ativo → salva.
2. Admin pode **desativar** uma meta com um clique no Switch (sem perder histórico).
3. Admin sobe um arquivo Excel/PDF/imagem com tempos de comanda no mesmo botão de upload da Holding Central → IA reconhece, normaliza mm:ss para minutos, e popula `store_performance.tempo_prato_avg`.
4. A meta `tempo_prato` de cada Chefe/Gerente passa a usar esses dados no cálculo de remuneração variável assim que estiver ativa e com teto > 0.
