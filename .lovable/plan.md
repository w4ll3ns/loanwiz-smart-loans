

## Analise: Baixa de parcelas via Contratos vs Parcelas

### Problemas encontrados

**1. Contratos NAO registra historico de pagamento**

A pagina de Parcelas insere em `parcelas_historico` a cada pagamento (linha 255-264). A pagina de Contratos NAO faz isso -- paga a parcela diretamente sem registro de historico. Isso significa que pagamentos feitos via Contratos ficam "invisiveis" no historico.

**2. Logica de pagamento parcial DIVERGENTE da regra de negocio**

Conforme a regra de negocio documentada (memory: partial-payment-business-rule), pagamentos parciais NAO devem alterar o status para "pago" nem transferir saldo. Porem, no Contratos.tsx (linhas 459-508):
- Pagamento parcial marca a parcela como **"pago"** (errado -- deveria manter "pendente")
- Transfere o saldo restante para a proxima parcela (errado -- deveria manter o valor original)
- Nao preserva `valor_original`

Na pagina de Parcelas, a logica esta correta: pagamento parcial mantem status "pendente" e nao transfere saldo.

**3. Verificacao de quitacao do contrato FUNCIONA**

Tanto Contratos (linha 441-457) quanto Parcelas (linha 300-320) verificam se todas as parcelas estao pagas e atualizam o contrato para "quitado". Porem, no Contratos, como pagamentos parciais marcam indevidamente como "pago", isso pode causar quitacao prematura do contrato.

**4. Dashboard NAO e afetado diretamente**

O Dashboard busca dados frescos do banco (contratos ativos, parcelas pendentes, valores pagos). Se os dados estiverem corretos no banco, o Dashboard reflete corretamente. O problema e que dados gravados via Contratos podem estar inconsistentes por causa dos bugs acima.

### Solucao proposta

Alinhar a logica de pagamento em `Contratos.tsx` com a de `Parcelas.tsx`:

| Alteracao | Arquivo |
|---|---|
| Inserir em `parcelas_historico` ao registrar pagamento | `src/pages/Contratos.tsx` |
| Pagamento parcial: manter status "pendente", acumular `valor_pago`, nao transferir saldo | `src/pages/Contratos.tsx` |
| Preservar `valor_original` na primeira alteracao | `src/pages/Contratos.tsx` |
| Quitacao: so verificar se contrato deve ser quitado quando status = "pago" | `src/pages/Contratos.tsx` |

### Detalhes das alteracoes em `Contratos.tsx`

**Substituir `handleConfirmarPagamento` (linhas 399-541)** pela mesma logica da pagina Parcelas:

1. Calcular `valorPagar` baseado no tipo (total, juros, personalizado)
2. **Inserir em `parcelas_historico`** com `tipo_evento: "pagamento"`, `valor_pago`, `tipo_pagamento`, `data_pagamento: new Date().toISOString()`
3. Acumular `valor_pago` (`novoValorPago = atual + valorPagar`)
4. Se `tipoPagamento === "total"`: status = "pago", `valor_pago = valor_original`
5. Se parcial: status = "pendente", `valor_pago = acumulado`
6. Preservar `valor_original` se nao existir
7. So verificar quitacao do contrato se `novoStatus === "pago"`
8. **Remover** logica de transferencia de saldo para proxima parcela

### Dashboard

Nenhuma alteracao necessaria. O Dashboard ja busca dados corretos do banco -- o problema era apenas que dados gravados via Contratos podiam estar errados.

