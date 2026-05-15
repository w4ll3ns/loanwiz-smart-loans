## Objetivo

Tornar a exclusão de eventos do histórico atômica e consistente: uma única RPC server-side recalcula `valor_pago`, ajusta `status` da parcela e reabre o contrato se necessário.

## 1. Nova migration: RPC `excluir_evento_historico(p_evento_id uuid)`

`SECURITY DEFINER`, `SET search_path = public`, retorna `jsonb`.

Lógica:

1. `auth.uid()` obrigatório → `RAISE EXCEPTION 'Not authenticated'`.
2. Carregar evento + parcela + contrato com ownership e lock pessimista:
   ```sql
   SELECT h.id, h.tipo_evento,
          p.id AS parcela_id, p.valor_original, p.valor,
          c.id AS contrato_id, c.status AS contrato_status
   FROM parcelas_historico h
   JOIN parcelas  p  ON p.id = h.parcela_id
   JOIN contratos c  ON c.id = p.contrato_id
   JOIN clientes  cl ON cl.id = c.cliente_id
   WHERE h.id = p_evento_id AND cl.user_id = auth.uid()
   FOR UPDATE OF p, c;
   ```
   Se `NOT FOUND` → `RAISE EXCEPTION 'Evento não encontrado'`.
3. `DELETE FROM parcelas_historico WHERE id = p_evento_id`.
4. Se `tipo_evento = 'pagamento'`:
   - `v_novo_pago := (SELECT COALESCE(SUM(valor_pago),0) FROM parcelas_historico WHERE parcela_id = v_parcela_id AND tipo_evento = 'pagamento')`.
   - `v_valor_ref := COALESCE(valor_original, valor)`.
   - `v_novo_status := CASE WHEN v_novo_pago >= v_valor_ref THEN 'pago' ELSE 'pendente' END`.
   - `v_nova_data_pag := CASE WHEN v_novo_pago = 0 THEN NULL WHEN v_novo_status = 'pago' THEN CURRENT_DATE ELSE NULL END`. (Mantém a regra atual: só preenche `data_pagamento` se totalmente pago.)
   - `UPDATE parcelas SET valor_pago = v_novo_pago, status = v_novo_status, data_pagamento = v_nova_data_pag, updated_at = now() WHERE id = v_parcela_id`.
   - Se `v_novo_status = 'pendente'` E `contrato.status = 'quitado'`:
     - `UPDATE contratos SET status = 'ativo', updated_at = now() WHERE id = v_contrato_id`.
     - `v_contrato_reaberto := true`.
5. Se `tipo_evento <> 'pagamento'` (ex. `alteracao_data`, `estorno`): não mexe em `parcelas`/`contratos`.
6. `RETURN jsonb_build_object('parcela_status', v_novo_status, 'contrato_reaberto', COALESCE(v_contrato_reaberto, false));`

Permissões:
```sql
REVOKE ALL ON FUNCTION public.excluir_evento_historico(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_evento_historico(uuid) TO authenticated;
```

## 2. Frontend: `src/components/parcelas/HistoricoModal.tsx`

Substituir todo o bloco de `handleExcluirPagamento` pelo seguinte fluxo:

```ts
const { data, error } = await supabase.rpc("excluir_evento_historico", { p_evento_id: registroId });
if (error) throw error;

toast({ title: "Registro excluído", description: "O registro foi removido do histórico." });
if ((data as any)?.contrato_reaberto) {
  toast({ title: "Contrato reaberto", description: "O contrato voltou para ativo." });
}
onHistoricoUpdated(parcela);
onParcelasUpdated();
```

`catch` mantém toast destrutivo com a mensagem do servidor. Remover o import não utilizado de `getLocalDateString`.

## 3. O que NÃO muda

- RLS atual de `parcelas_historico` continua válida (defesa em profundidade).
- Sem mudanças em outros consumidores do histórico.
- Sem alterações na lógica de exibição/filtro do modal.

## Critério de aceite

- Excluir o último pagamento de um contrato `quitado` → parcela vira `pendente`, contrato vira `ativo`, toast extra "Contrato reaberto".
- Excluir um evento `alteracao_data` → `valor_pago`/`status` da parcela permanecem inalterados.
- Excluir um pagamento parcial → `valor_pago` recalculado pela soma restante; status fica `pendente`; `data_pagamento = NULL` se zerou.
- Falha (rede, permissão) → nenhum estado parcial graças à transação implícita da RPC.