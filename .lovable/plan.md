

# Plano: Corrigir RLS de `checkin_budget_entries` para todos os cargos

## Problema

A política SELECT atual só usa `user_has_access_to_loja(auth.uid(), loja_id)`, que funciona para operator, gerente_unidade e chefe_setor (vinculados via `user_stores`), mas **exclui admins** que não têm registros em `user_stores`.

## Correção

### Migration SQL

```sql
DROP POLICY "Users can view budget entries for their stores" ON checkin_budget_entries;

CREATE POLICY "Users can view budget entries for their stores"
ON checkin_budget_entries FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR user_has_access_to_loja(auth.uid(), loja_id)
);
```

Isso garante:
- **Admin**: vê todas as entradas (acesso global)
- **Operator / Gerente / Chefe de Setor**: vê entradas das lojas vinculadas (via `user_stores`)

| Tipo | Mudança |
|------|---------|
| Migration SQL | Adicionar `has_role(admin)` à política SELECT de `checkin_budget_entries` |

