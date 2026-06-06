## Objetivo

A correção de lógica já está aplicada no banco (migração de 05/jun). O que falta é **registrar a regra de negócio na memória do projeto** para que não seja reintroduzida no futuro (como ocorreu na regressão de 15/mai).

## Contexto

- Comportamento correto (e original, até 14/abr): uma parcela só vira `pago` quando há um pagamento do tipo `total`.
- Regressão de 15/mai a 05/jun: passou a quitar automaticamente quando `valor_pago` acumulado (juros/parcial) atingia o valor da parcela — causou quitações indevidas em empréstimos de juros rotativos.
- Correção de 05/jun: restaurou a regra original em `registrar_pagamento_parcela`, `estornar_pagamento_parcela` e `excluir_evento_historico`.

## Ação

Criar/atualizar um arquivo de memória do tipo `feature` descrevendo a regra, e referenciá-lo no índice de memória:

- **Arquivo**: `mem://billing/settlement-only-on-total-payment`
- **Regra**: Parcela só recebe status `pago` quando existe um lançamento com `tipo_pagamento = 'total'`. Pagamentos de `juros` ou `parcial` sempre resultam em `parcialmente_pago`, mesmo que `valor_pago` ultrapasse o valor da parcela. Contrato vira `quitado` apenas quando todas as parcelas estão `pago`.
- **Aplica-se a**: funções `registrar_pagamento_parcela`, `estornar_pagamento_parcela`, `excluir_evento_historico`.
- **Adicionar referência** em `mem://index.md` na seção Memories.

Nenhuma mudança de código ou de banco é necessária — apenas o registro da regra.
