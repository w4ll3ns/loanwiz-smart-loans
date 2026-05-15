## Objetivo

Proteger a exclusão de parcelas com uma RPC server-side que valide ownership, status e ordem (última parcela), impedindo gaps em `numero_parcela` e remoção de parcelas pagas.

## 1. Nova migration: RPC `excluir_parcela(p_parcela_id uuid)`

`SECURITY DEFINER`, `SET search_path = public`. Lógica:

1. `auth.uid()` obrigatório — senão `RAISE EXCEPTION 'Not authenticated'`.
2. Buscar parcela + contrato + cliente em um único SELECT validando ownership (`cl.user_id = auth.uid()`). Se não encontrar → `RAISE EXCEPTION 'Parcela não encontrada'`.
3. Se `contrato.status = 'quitado'` → `RAISE EXCEPTION 'Contrato quitado não pode ter parcelas excluídas'`.
4. Se `parcela.status = 'pago'` ou `COALESCE(valor_pago,0) > 0` → `RAISE EXCEPTION 'Não é possível excluir uma parcela com pagamentos registrados'`.
5. Buscar `MAX(numero_parcela)` do contrato; se `parcela.numero_parcela <> max` → `RAISE EXCEPTION 'Apenas a última parcela pode ser excluída para evitar quebra de sequência'`.
6. `DELETE FROM parcelas_historico WHERE parcela_id = p_parcela_id;`
7. `DELETE FROM parcelas WHERE id = p_parcela_id;`

Permissões:
```sql
REVOKE ALL ON FUNCTION public.excluir_parcela(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_parcela(uuid) TO authenticated;
```

## 2. Frontend: `src/pages/Parcelas.tsx` — `handleDelete`

Substituir `supabase.from("parcelas").delete().eq(...)` por:

```ts
const { error } = await supabase.rpc("excluir_parcela", { p_parcela_id: parcelaToDelete });
if (error) throw error;
```

Tratamento de erros no `catch` (mesmo padrão de `ContratoDetails.handleDeleteContrato`):

- `"pagamentos registrados"` → toast "Não é possível excluir", desc "Esta parcela já tem pagamentos. Estorne antes de excluir."
- `"Contrato quitado"` → toast "Contrato quitado", desc "Não é possível excluir parcelas de contratos quitados."
- `"Apenas a última parcela"` → toast "Sequência de parcelas", desc "Apenas a última parcela do contrato pode ser excluída."
- `"Parcela não encontrada"` / `"Not authorized"` → toast genérico de permissão.
- Fallback → "Erro ao excluir, tente novamente."

Todos `variant: "destructive"`.

## 3. O que NÃO muda

- RLS atual de `parcelas` permanece (cobre outros DELETEs eventuais via SDK; a UI passa a usar exclusivamente a RPC).
- Sem alteração em `parcelas_historico` schema.
- Sem mudança em outros pontos do app.

## Critério de aceite

- Parcela paga → toast claro, nada deletado.
- Parcela do meio (não-última) → toast de sequência, nada deletado.
- Última parcela pendente de contrato ativo → exclui OK e remove histórico vinculado.
- Parcela de contrato quitado → toast bloqueando.

Aprovar para implementar.