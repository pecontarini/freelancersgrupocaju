
Execução completa nas 6 etapas, sem novo diagnóstico.

## Etapa 1 — Migrations

**Migration A** — `sheets_sources` ganha colunas de status:
```sql
ALTER TABLE public.sheets_sources
  ADD COLUMN IF NOT EXISTS ultimo_status text DEFAULT 'pendente'
    CHECK (ultimo_status IN ('ok','erro','pendente')),
  ADD COLUMN IF NOT EXISTS ultimo_erro text;
```

**Migration B** — tabela `planos_acao` + RLS:
```sql
CREATE TABLE IF NOT EXISTS public.planos_acao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comentario_id uuid REFERENCES public.reclamacoes_comentarios(id) ON DELETE CASCADE,
  texto_acao text NOT NULL,
  responsavel text,
  data_criacao timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  status text DEFAULT 'aberto'
);
ALTER TABLE public.planos_acao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_planos" ON public.planos_acao FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_planos" ON public.planos_acao FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "update_planos" ON public.planos_acao FOR UPDATE TO authenticated USING (auth.uid() = created_by OR has_role(auth.uid(),'admin'));
```
(Pequeno ajuste de segurança nas policies de insert/update para amarrar a `auth.uid()` — evita escalada.)

## Etapa 2 — `supabase/functions/sync-sheets-staging/index.ts`

- Adicionar `extractSheetParams`, `buildGvizUrl`, `fetchGvizGrid` exatamente como no prompt.
- Substituir `normalizeSheetsUrl` para retornar URL gviz/tq.
- No `serve`: trocar fetch CSV por:
  ```ts
  const { sheetId, gid } = extractSheetParams(source.url);
  let deparaMap: Record<string,string> = {};
  try {
    const dep = await fetchGvizGrid(buildGvizUrl(sheetId, 'Depara'));
    for (const r of dep.slice(1)) if (r[0] && r[1]) deparaMap[r[0].trim().toLowerCase()] = r[1].trim();
  } catch { console.warn('[sync] Depara ausente', sheetId); }
  const grid = await fetchGvizGrid(buildGvizUrl(sheetId, gid));
  const parsed = dispatchParser(metaKey, grid, deparaMap);
  ```
- Estender `dispatchParser(metaKey, grid, deparaMap = {})` e cada parser existente para aceitar `deparaMap` como 2º parâmetro opcional (default `{}`). `matchLojaCodigo` consulta `deparaMap` antes do `UNIT_ALIAS`.
- Substituir o bloco final de gravação de status pela versão condicional do prompt (status `ok` apenas com `hasData`; senão grava `ultimo_status='erro'` + `ultimo_erro` e responde 422).

## Etapa 3 — `src/hooks/useSheetsSources.ts`

- Reescrever `normalizeSheetsUrl` usando `extractSheetParams` + `buildGvizUrl` (gviz/tq).
- Adicionar ao tipo `SheetsSource`:
  ```ts
  ultimo_status: 'ok' | 'erro' | 'pendente';
  ultimo_erro: string | null;
  ```
- Incluir as colunas no `select('*')` (já cobre — confirmar nada hardcoded). Atualizar `parseSheetsCsvUrl` se necessário para entender URLs gviz já normalizadas.

## Etapa 4 — `MetaSheetsLinker.tsx`

Ao lado de cada fonte, badge:
- `ok` → verde "Sincronizado"
- `erro` → vermelho "Erro" + `Tooltip` com `ultimo_erro`
- `pendente` → cinza "Pendente"

Usar `Badge` shadcn + classes glass + accent amber existentes.

## Etapa 5 — Registrar 7 fontes

Insert/Upsert em `sheets_sources` (operação de dados via insert tool, não migration). Para itens com `meta_key` vazio, gerar `meta_key` único como `pendente-N` (já que coluna é unique implicitamente quando ativo) ou simplesmente deixar `meta_key=NULL` + `ativo=false`. Confirmar que não há constraint UNIQUE em `meta_key` antes — se houver, usar `meta_key=NULL` (Postgres permite múltiplos NULL em UNIQUE).

URLs salvas no formato gviz canônico:
```
https://docs.google.com/spreadsheets/d/{ID}/gviz/tq?tqx=out:json&gid={GID}
```

| meta_key | nome | ativo |
|---|---|---|
| ranking-supervisores | Ranking Supervisores | true |
| nps | NPS | true |
| atendimento-medias | NPS / Avaliações | true |
| reclamacoes | Base Avaliações | true |
| NULL | Pendente Mapeamento #2 | false |
| NULL | Pendente Mapeamento #6 | false |
| NULL | Pendente Mapeamento #7 | false |

Também vincular `reclamacoes_config.source_id` à fonte `reclamacoes` recém-criada (para o Mural de Comentários).

Adicionar parser `parseSupervisoresRanking` (reusa lógica genérica) e mapear em `dispatchParser`: `case 'ranking-supervisores': return parseGenericMeta(...)` como fallback até termos formato real.

## Etapa 6 — Comments Wall + Plano de Ação

**`ReclamacoesCommentsWall.tsx`:**
- Adicionar 2 `<input type="date">` (De/Até) + botão "Limpar filtros" acima dos filtros atuais. Filtrar `comentarios` por `data_comentario`.
- Em cada card: nova query `useQuery(['planos_count', c.id])` ou um único `useQuery` que carrega todos `planos_acao` por `comentario_id IN (...)` e indexa por id.
- Botão `<Plus> Plano de Ação` (amber outline, sm) → abre `PlanoAcaoDialog`. Se já há plano, mostrar `Badge` verde "Plano criado".

**Novo `src/components/dashboard/painel-metas/comments/PlanoAcaoDialog.tsx`:**
- Dialog shadcn (glass + amber).
- Campos: Textarea `texto_acao` (obrigatório), Input `responsavel` (opcional).
- Salvar: `supabase.from('planos_acao').insert({ comentario_id, texto_acao, responsavel, created_by: user.id })`.
- Sucesso: `toast.success`, fechar, invalidar query `['planos_count']`. Erro: `toast.error(e.message)`.

## Restrições

Mantidas: nada em `/auth`, `/agenda`, `/contagem-utensilios`, `/confirm-shift/:id`, `/checklist/:token`, `/checkin`. Parsers existentes intocados (apenas recebem `deparaMap` opcional). Componentes apenas estendidos.

## Ordem de execução

1. Migration A + B
2. Edge Function (deploy automático)
3. Hook + tipos
4. Badge no Linker
5. Insert das 7 fontes (+ vincular `reclamacoes_config`)
6. Comments Wall + Dialog
7. Smoke test: rodar "Sincronizar agora" em uma fonte e verificar `ultimo_status` no DB.
