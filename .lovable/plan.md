

## Plano: Tornar cards "Recebido Hoje" e "Total Vencido" clicaveis

### Comportamento esperado

- **Clicar em "Recebido Hoje"**: filtra a lista para mostrar apenas parcelas pagas hoje (status "pago" com data_pagamento = hoje)
- **Clicar em "Total Vencido"**: filtra a lista para mostrar apenas parcelas vencidas (status "pendente" ou "parcialmente_pago" com dias de atraso > 0)
- **Clicar novamente** no mesmo card: remove o filtro e volta ao estado anterior
- Visual: cursor pointer + hover sutil nos cards clicaveis

### Alteracoes em `src/pages/Parcelas.tsx`

1. **Novo estado**: `cardFilter` com valores `null | "recebido_hoje" | "vencido"`
2. **Cards**: envolver "Recebido Hoje" e "Total Vencido" com `onClick` que alterna o `cardFilter`, adicionar `cursor-pointer hover:shadow-md transition-shadow` e borda de destaque quando ativo (`ring-2 ring-primary` / `ring-destructive`)
3. **`filteredParcelas`**: quando `cardFilter` esta ativo, aplicar filtro adicional:
   - `"recebido_hoje"`: parcelas com `status === "pago"` e `data_pagamento` de hoje
   - `"vencido"`: parcelas com `(status === "pendente" || status === "parcialmente_pago")` e `calcularDiasAtraso(data_vencimento) > 0`
4. **Indicador visual**: badge ou texto "Filtro ativo" proximo ao titulo da lista + botao para limpar

