

## Plano: Corrigir filtro do card "Recebido Hoje" ao clicar

### Problema identificado

Existem **dois problemas distintos**:

1. **Card mostra valor de outra data**: Os pagamentos feitos em 01/04 à noite (horário Brasil) foram gravados com timestamps UTC de `2026-04-02 03:2x`, que caem no "dia seguinte" em UTC. A correção de timezone feita anteriormente resolve isso parcialmente, mas os dados já gravados têm `parcelas.data_pagamento = 2026-04-01` (data escolhida pelo usuário), enquanto o `parcelas_historico.data_pagamento` tem o timestamp real `2026-04-02T03:xx UTC`.

2. **Ao clicar no card, mostra "Nenhuma parcela encontrada"**: O filtro `recebido_hoje` compara `parcela.data_pagamento` (campo `date` da tabela `parcelas`) com a data de hoje. Mas `parcela.data_pagamento` pode ser uma data diferente (ex: `2026-04-01`) porque é a data efetiva do pagamento definida pelo usuário, não o timestamp do registro. O card calcula o total consultando `parcelas_historico` (timestamp real), mas o filtro da lista usa `parcelas.data_pagamento` — fontes de dados diferentes.

### Solução

Ao clicar no card "Recebido Hoje", carregar os IDs das parcelas que têm registros em `parcelas_historico` com pagamento hoje, e filtrar a lista por esses IDs.

### Alterações em `src/pages/Parcelas.tsx`

**1. Novo estado** para armazenar os IDs de parcelas com pagamento hoje:
```ts
const [parcelasRecebidoHojeIds, setParcelasRecebidoHojeIds] = useState<string[]>([]);
```

**2. Atualizar `loadRecebidoHoje`** para também salvar os `parcela_id`s:
- Alterar o select para incluir `parcela_id` além de `valor_pago`
- Extrair os IDs únicos e salvar no novo estado

**3. Alterar o filtro `recebido_hoje`** em `filteredParcelas`:
- De: comparar `parcela.data_pagamento` com hoje
- Para: verificar se `parcela.id` está na lista `parcelasRecebidoHojeIds`

```ts
if (cardFilter === "recebido_hoje") {
  return parcelasRecebidoHojeIds.includes(parcela.id);
}
```

Isso garante que a lista exibe exatamente as parcelas cujos pagamentos aparecem no total do card.

