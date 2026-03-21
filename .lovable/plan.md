

## Plano: Corrigir filtro "Recebido Hoje" para incluir pagamentos parciais

### Problema

O card "Recebido Hoje" conta **2 pagamentos** porque consulta `parcelas_historico` (que registra cada evento de pagamento, incluindo parciais). Porém, ao clicar, o filtro busca na lista de `parcelas` onde `status === "pago" && data_pagamento === hoje`. Isso exclui parcelas que receberam pagamento parcial hoje (status permanece "pendente" ou "parcialmente_pago").

### Solução

Alterar o filtro `recebido_hoje` em `filteredParcelas` para incluir também parcelas com `status === "parcialmente_pago"` que tenham `data_pagamento` de hoje. Parcelas parcialmente pagas também registram `data_pagamento` com a data do último pagamento.

### Alteração em `src/pages/Parcelas.tsx`

Linha 193-195: mudar de:
```ts
return parcela.status === "pago" && parcela.data_pagamento && parcela.data_pagamento.startsWith(hoje);
```
Para:
```ts
return (parcela.status === "pago" || parcela.status === "parcialmente_pago") && parcela.data_pagamento && parcela.data_pagamento.startsWith(hoje);
```

Isso alinha o filtro com a mesma lógica do card, que conta todos os pagamentos feitos hoje (totais e parciais).

