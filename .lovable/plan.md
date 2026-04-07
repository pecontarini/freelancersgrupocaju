

# Plano: Importação Inteligente da Matriz POP via Imagem

## Resumo

Criar um botão "Importar via IA" na tela da Matriz de Efetivo Mínimo (StaffingMatrixConfig) que aceita uma foto/imagem da tabela de efetivos. A IA (Gemini 2.5 Flash, com visão) interpreta a imagem e extrai setores, dias da semana, turnos, efetivos e extras. O resultado é exibido numa tela de revisão antes de ser aplicado à matriz.

---

## Edge Function: `supabase/functions/extract-staffing-matrix/index.ts`

- Recebe imagem (base64 + mimeType) via POST
- Prompt de sistema instruindo a IA a:
  - Identificar o nome da unidade (cabeçalho)
  - Separar por setor (GARÇOM + CHEFIAS, CUMINS, HOSTESS, etc.)
  - Para cada setor, extrair por turno (ALMOÇO/JANTAR) e dia (Seg-Dom)
  - Interpretar "5+2" como `{ efetivos: 5, extras: 2 }` e "5" como `{ efetivos: 5, extras: 0 }`
  - Ignorar colunas "Nº PESSOAS NECESSÁRIAS" e "Nº DOBRAS"
- Retorna JSON:
  ```json
  {
    "unit_name": "CAMINITO PARRILLA ASA SUL",
    "sectors": [
      {
        "name": "GARÇOM + CHEFIAS",
        "shifts": [
          {
            "type": "ALMOÇO",
            "days": [
              { "day": 0, "efetivos": 6, "extras": 0 },
              { "day": 1, "efetivos": 7, "extras": 0 },
              ...
            ]
          }
        ]
      }
    ]
  }
  ```
- Usa `google/gemini-2.5-flash` (visão multimodal) via `ai.gateway.lovable.dev`
- Segue o mesmo padrão de `extract-team-data` (CORS, error handling, JSON extraction)

---

## Componente: `src/components/escalas/StaffingMatrixImporter.tsx`

Dialog/modal com 3 etapas:

**Etapa 1 — Upload:** Input de imagem (câmera ou galeria). Mostra preview da imagem.

**Etapa 2 — Processamento:** Spinner enquanto a IA processa. Chamada à edge function via `supabase.functions.invoke("extract-staffing-matrix", ...)`.

**Etapa 3 — Revisão:** Tabela editável mostrando o resultado da IA:
- Coluna de setor com match automático contra setores existentes (fuzzy match)
- Se o setor não existir, opção de criar automaticamente
- Campos de efetivos e extras editáveis antes de confirmar
- Botão "Aplicar" que faz upsert em massa via `useUpsertStaffingMatrix`

---

## Modificação: `src/components/escalas/StaffingMatrixConfig.tsx`

- Adicionar botão "Importar via IA" (ícone Camera/Upload) ao lado do botão "Novo Setor"
- Renderizar `<StaffingMatrixImporter>` quando aberto
- Passa `selectedUnit`, `sectors` e `upsertMatrix` como props
- Após importação, os dados preenchem a matriz existente (campos continuam editáveis)

---

## Fluxo completo

```text
[Foto da tabela] → [Upload no modal] → [Edge Function + IA]
    → [Tela de revisão com setores/dias/efetivos/extras]
    → [Criar setores faltantes] → [Upsert em massa na staffing_matrix]
    → [Matriz preenchida e editável]
```

## Arquivos impactados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/extract-staffing-matrix/index.ts` | Criar |
| `src/components/escalas/StaffingMatrixImporter.tsx` | Criar |
| `src/components/escalas/StaffingMatrixConfig.tsx` | Modificar (adicionar botão de importação) |

Nenhuma alteração no banco de dados necessária.

