## Objetivo
Corrigir o card "Total Juros Recebido" em `src/pages/Parcelas.tsx` para o modelo de juros, usando o tipo de pagamento registrado em `parcelas_historico` (juros/parcial = 100% lucro; total = apenas o juro embutido, descontando o principal da parcela).

## Mudanças em `src/pages/Parcelas.tsx`

1. **Novo estado** (junto aos demais `useState`, ~linha 85):
```ts
const [historicoPagamentos, setHistoricoPagamentos] = useState<
  { parcela_id: string; tipo_pagamento: string | null; valor_pago: number | null }[]
>([]);
```

2. **Carregar eventos de pagamento** dentro de `loadParcelas`, logo após `setParcelas(data || [])`:
```ts
const ids = (data || []).map(p => p.id);
if (ids.length > 0) {
  const { data: eventos } = await supabase
    .from('parcelas_historico')
    .select('parcela_id, tipo_pagamento, valor_pago')
    .eq('tipo_evento', 'pagamento')
    .in('parcela_id', ids);
  setHistoricoPagamentos(eventos || []);
} else {
  setHistoricoPagamentos([]);
}
```

3. **Substituir o cálculo** de `totalJurosRecebido` (linhas 275-283) por:
```ts
const idsDashboard = new Set(dashboardParcelas.map(p => p.id));
const mapaContrato = new Map(dashboardParcelas.map(p => [p.id, p.contratos]));
const totalJurosRecebido = (historicoPagamentos || [])
  .filter(e => idsDashboard.has(e.parcela_id))
  .reduce((acc, e) => {
    const valor = Number(e.valor_pago) || 0;
    if (e.tipo_pagamento === 'juros' || e.tipo_pagamento === 'parcial') return acc + valor;
    if (e.tipo_pagamento === 'total') {
      const c = mapaContrato.get(e.parcela_id);
      const principal = Number(c?.valor_emprestado || 0) / (c?.numero_parcelas || 1);
      return acc + Math.max(valor - principal, 0);
    }
    return acc;
  }, 0);
```

4. **Não alterar** `totalVencido`, `totalPendente` nem `totalPago` — já corretos pela regra de valor cheio.

## Observações técnicas
- `parcelas_historico` já é consultado em `loadRecebidoHoje`, e a coluna `tipo_pagamento` existe na tabela.
- O `select` de `loadParcelas` já traz `valor_emprestado` e `numero_parcelas` em `contratos`, então `mapaContrato` tem os dados necessários.
- Limite padrão de 1000 linhas do Supabase: número de eventos por usuário deve estar bem abaixo disso.