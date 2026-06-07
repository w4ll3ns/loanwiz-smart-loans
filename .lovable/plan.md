# Corrigir "A Receber" no Dashboard (valor cheio)

## Problema
A função `public.dashboard_stats` calcula `total_receber` subtraindo `valor_pago` das parcelas pendentes/parcialmente pagas. Pela regra do negócio (juros/parcial NÃO abatem o saldo), o valor deve ser sempre o **valor cheio** da parcela. Isso faz o card "A Receber" do Dashboard divergir da página de Parcelas.

## Solução
Criar uma nova migration aditiva com `CREATE OR REPLACE FUNCTION public.dashboard_stats()` idêntica à atual, alterando **apenas** o bloco `total_receber`:

De:
```sql
'total_receber', COALESCE(SUM(CASE
    WHEN p.status IN ('pendente','parcialmente_pago')
    THEN COALESCE(p.valor_original, p.valor) - COALESCE(p.valor_pago, 0)
    ELSE 0 END), 0),
```

Para:
```sql
'total_receber', COALESCE(SUM(CASE
    WHEN p.status IN ('pendente','parcialmente_pago')
    THEN COALESCE(p.valor_original, p.valor)   -- valor cheio, NÃO subtrair valor_pago
    ELSE 0 END), 0),
```

Todos os demais blocos (`total_emprestado`, `total_recebido`, `parcelas_vencidas`, `valor_vencido`, `lucro`, `proximos_vencimentos`, `lucro_mensal`, `status_distribuicao`, `capital_mensal`) permanecem exatamente iguais.

## Detalhes técnicos
- A função mantém `SECURITY DEFINER`, `SET search_path = public` e a checagem `auth.uid()`.
- Recriação completa via `CREATE OR REPLACE` para garantir consistência; nenhuma outra estrutura de banco é alterada.
- Nenhuma mudança em código frontend é necessária — o card já lê `total_receber`.

## Validação
Após aplicar, o card "A Receber" do Dashboard deve mostrar **R$ 27.751,25**, igual ao total da página de Parcelas. Confirmar que não há `- COALESCE(p.valor_pago, 0)` no cálculo de `total_receber`.
