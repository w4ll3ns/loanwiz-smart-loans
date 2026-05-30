## Objetivo

Corrigir o estorno de pagamento para que ele reverta **apenas o último lançamento de pagamento** da parcela, em vez de apagar todo o histórico de pagamentos. Após remover o último pagamento, o `valor_pago` e o `status` da parcela devem ser recalculados corretamente a partir dos pagamentos que restaram.

## Problema atual

A função `estornar_pagamento_parcela` faz:

```text
DELETE FROM parcelas_historico WHERE parcela_id = X AND tipo_evento = 'pagamento'
UPDATE parcelas SET valor_pago = 0, status = 'pendente'
```

Ou seja, apaga **todos** os pagamentos da parcela e zera tudo de uma vez — foi o que destruiu o histórico de juros da cliente Taiza.

## Mudança

### 1. Migration: reescrever `estornar_pagamento_parcela`

Nova lógica (mantendo SECURITY DEFINER, validação de dono e `FOR UPDATE`):

1. Localizar o **último** evento de pagamento da parcela:
   - `tipo_evento = 'pagamento'`, ordenado por `created_at DESC` (desempate por `data_pagamento DESC`), `LIMIT 1`.
   - Se não houver nenhum pagamento → `RAISE EXCEPTION 'Não há pagamentos para estornar'`.
2. `DELETE` somente desse evento (pelo `id`).
3. Recalcular `valor_pago` = `SUM(valor_pago)` dos eventos de pagamento **restantes** da parcela (`COALESCE(..., 0)`).
4. Recalcular `status` com base no novo `valor_pago`:
   - `>= valor_ref` (`COALESCE(valor_original, valor)`) → `pago`
   - `> 0` → `parcialmente_pago`
   - `= 0` → `pendente`
5. `data_pagamento`: manter/`CURRENT_DATE` se voltar a `pago`; caso contrário `NULL`.
6. Reabrir contrato: se o contrato estava `quitado` e a parcela **deixou de ser** `pago`, voltar contrato para `ativo`.
7. Retornar `jsonb` com `valor_pago`, `novo_status`, `valor_estornado` e `contrato_reaberto` (atualmente retorna `void`).

### 2. Frontend

- `src/services/parcelas.ts`: ajustar `estornarPagamento` para retornar o resultado (`jsonb`) em vez de `void`.
- `src/pages/Parcelas.tsx` (`handleMarcarPendente`) e `src/components/contratos/hooks/useContratoDetails.ts`: ajustar mensagens dos toasts de "Pagamentos desfeitos / resetada para pendente" para refletir que apenas o **último pagamento** foi estornado (ex.: "Último pagamento estornado", mostrando o valor revertido e o novo status). Sem mudança de lógica além disso.

## Observações importantes

- **Os pagamentos já apagados da Taiza não são recuperáveis** por esta correção — a exclusão anterior foi física. Esta mudança previne novas perdas. (Posso, em etapa separada, tentar reconstruir os lançamentos da Taiza a partir das anotações de "Pagando juros" existentes, se desejado.)
- O estorno passa a ser incremental: chamar várias vezes remove um pagamento por vez, na ordem inversa.

## Validação

Após aplicar, testar numa parcela com 2+ pagamentos de juros:
- 1º estorno remove só o último lançamento; `valor_pago` cai apenas o valor desse lançamento; demais eventos permanecem no histórico.
- Status recalcula corretamente (`parcialmente_pago` enquanto restar pagamento; `pendente` só quando zerar).
- Contrato `quitado` reabre para `ativo` apenas quando a parcela deixa de estar `pago`.

## Arquivos

- Nova migration reescrevendo `estornar_pagamento_parcela`.
- `src/services/parcelas.ts` (tipo de retorno).
- `src/pages/Parcelas.tsx` e `src/components/contratos/hooks/useContratoDetails.ts` (mensagens).
