

## Plano: Corrigir filtro de data do card "Recebido Hoje" (bug de timezone)

### Problema identificado

O card "Recebido Hoje" mostra valores de **outra data** por causa de um bug de timezone. A causa raiz:

1. **Gravação**: `data_pagamento` em `parcelas_historico` é salvo com `new Date().toISOString()` — que gera timestamp em **UTC** (ex: `2026-04-02T01:00:00.000Z` para um pagamento feito às 22h no Brasil)
2. **Leitura**: A query filtra com `getLocalDateString()` (data local, ex: `2026-04-02`) mas monta os limites como `2026-04-02T00:00:00` e `2026-04-02T23:59:59.999` **sem timezone** — o PostgREST interpreta como UTC
3. **Resultado**: Pagamentos feitos à noite no Brasil (após 21h) caem no "dia seguinte" em UTC e não aparecem. Pagamentos do dia anterior feitos à noite aparecem indevidamente como "hoje"

### Solução

Converter os limites do dia local para ISO strings com offset correto, para que a query filtre pelo dia local real do usuario.

### Alteração em `src/pages/Parcelas.tsx`

**Função `loadRecebidoHoje` (linhas 110-129)**: substituir a construção dos limites de data:

```ts
const loadRecebidoHoje = async () => {
  try {
    // Criar limites do dia LOCAL em formato ISO (com timezone correto)
    const hoje = new Date();
    const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0, 0);
    const fimHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59, 999);

    const { data, error } = await supabase
      .from("parcelas_historico")
      .select("valor_pago")
      .eq("tipo_evento", "pagamento")
      .gte("data_pagamento", inicioHoje.toISOString())
      .lt("data_pagamento", fimHoje.toISOString());

    // ... resto igual
  }
};
```

Isso garante que `inicioHoje.toISOString()` produz `2026-04-02T03:00:00.000Z` (para UTC-3), filtrando corretamente pelo dia local.

### Cards afetados — análise completa

| Card | Fonte de dados | Status |
|---|---|---|
| **Recebido Hoje** | `parcelas_historico.data_pagamento` (timestamp) | **BUG** — corrigido acima |
| **A Receber (Pendente)** | `parcelas.valor_original` onde `status !== "pago"` | OK — usa valor, não data |
| **Total Recebido** | `parcelas.valor_pago` (soma de todos) | OK — usa valor, não data |
| **Total Vencido** | `parcelas.data_vencimento` (tipo `date`) + `calcularDiasAtraso` | OK — usa `T00:00:00` para neutralizar timezone |

Apenas o card "Recebido Hoje" tem o bug, pois é o único que filtra por timestamp com timezone.

