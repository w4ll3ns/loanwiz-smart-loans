# Atomic date change RPC + delete-user inventory fix

## Parte 1 — `alterar_data_parcela` RPC + modal fixes

### Migration
Nova função `public.alterar_data_parcela(p_parcela_id uuid, p_nova_data date, p_justificativa text) RETURNS void`:

- `SECURITY DEFINER`, `SET search_path = public`.
- Validar `auth.uid() IS NOT NULL`.
- Validar `p_justificativa IS NOT NULL AND length(trim(p_justificativa)) > 0` → `RAISE EXCEPTION 'Justificativa é obrigatória'`.
- `SELECT p.*, c.status as contrato_status INTO v_parcela FROM parcelas p JOIN contratos c ON c.id = p.contrato_id JOIN clientes cl ON cl.id = c.cliente_id WHERE p.id = p_parcela_id AND cl.user_id = auth.uid() FOR UPDATE OF p, c`.
- Se `NOT FOUND` → `Installment not found or not owned by user`.
- Se `v_parcela.status = 'pago'` → `Cannot change due date of paid installment`.
- Se `v_parcela.contrato_status = 'quitado'` → `Cannot change due date on settled contract`.
- Se `p_nova_data = v_parcela.data_vencimento` → `Nova data must be different`.
- `UPDATE parcelas SET data_vencimento = p_nova_data, justificativa_alteracao_data = trim(p_justificativa), data_vencimento_original = COALESCE(data_vencimento_original, v_parcela.data_vencimento), updated_at = now() WHERE id = p_parcela_id;`
- `INSERT INTO parcelas_historico (parcela_id, tipo_evento, data_vencimento_anterior, data_vencimento_nova, observacao, data_pagamento) VALUES (p_parcela_id, 'alteracao_data', v_parcela.data_vencimento, p_nova_data, trim(p_justificativa), now());`
- `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon; GRANT EXECUTE ... TO authenticated;`

### Frontend `src/components/parcelas/EditarDataModal.tsx`
- Adicionar `useEffect` que sincroniza `novaDataVencimento` com `parcela.data_vencimento` quando `parcela?.id` ou `isOpen` mudam (e reseta `justificativaAlteracao`). Remover o bloco `if (parcela && novaDataVencimento === "" && isOpen) setNovaDataVencimento(...)` da render (linha 41-43).
- Substituir as duas chamadas `.update` + `.insert` por uma única:
  ```ts
  const { error } = await supabase.rpc('alterar_data_parcela', {
    p_parcela_id: parcela.id,
    p_nova_data: novaDataVencimento,
    p_justificativa: justificativaAlteracao.trim(),
  });
  ```
- Tratar erro (lança throw → catch existente exibe toast).

## Parte 2 — `delete-user` edge function

### `supabase/functions/delete-user/index.ts`
- Substituir o count amostral por loop em batches de 100 acumulando o total real em `historicoCount`.
- Atualizar a entrada do `inventory`: renomear chave `historico_estimado` → `historico` (refletindo que agora é exato). Atualizar consumidores: o objeto `counts` em `completedSteps` passa a ler `inventory.historico`.
- Restringir CORS: trocar `"Access-Control-Allow-Origin": "*"` por validação contra lista permitida (origens preview/published do projeto + custom domain via env opcional `ALLOWED_ORIGINS`):
  ```ts
  const ALLOWED = [
    "https://wsemprestimos.lovable.app",
    "https://id-preview--967f0cd4-eadf-45c4-858f-a2848c1eef89.lovable.app",
    ...(Deno.env.get("ALLOWED_ORIGINS")?.split(",").map(s => s.trim()) ?? []),
  ];
  const origin = req.headers.get("Origin") ?? "";
  const allowOrigin = ALLOWED.includes(origin) ? origin : ALLOWED[0];
  const corsHeaders = { "Access-Control-Allow-Origin": allowOrigin, ... };
  ```
  Mantém os mesmos `Access-Control-Allow-Headers`. Origens não listadas recebem o domínio publicado (preflight falha no browser, mantendo a função efetivamente bloqueada para origens externas).

## Critério de aceite
- Alterar data: 1 transação, 1 linha em `parcelas_historico`. Sem warning React (setState durante render eliminado).
- Deletar usuário com >100 parcelas: `audit_logs.details.inventory.historico` mostra contagem exata; CORS responde apenas para origens conhecidas.
