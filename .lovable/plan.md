## Objetivo

Atualizar `public.dashboard_stats` via nova migration aditiva (`CREATE OR REPLACE FUNCTION`), mantendo toda a estrutura e os demais blocos idênticos. Apenas três ajustes pontuais.

## Mudanças

### 1) Lucro mensal — isolamento por usuário robusto
No bloco `-- Lucro mensal`, o subselect já filtra o usuário, mas será reescrito conforme o padrão solicitado para garantir o pré-filtro antes do LEFT JOIN com a série de meses, renomeando o alias para `pp` e calculando `lucro_parcela` com guarda de divisão:

- Subquery interna passa a expor `GREATEST(COALESCE(p.valor_pago,0) - (c.valor_emprestado / NULLIF(c.numero_parcelas, 0)), 0) AS lucro_parcela`, com `JOIN contratos`/`JOIN clientes` e `WHERE cl.user_id = v_user_id AND p.status IN ('pago','parcialmente_pago') AND COALESCE(p.valor_pago,0) > 0`.
- LEFT JOIN da série de meses `m(mes)` contra `pp` por `pp.data_pagamento >= m.mes::date AND pp.data_pagamento < (m.mes + interval '1 month')::date`, com `GROUP BY m.mes`.
- O SELECT do lucro do mês passa a `COALESCE(SUM(pp.lucro_parcela), 0) as lucro`.

### 2) "A Receber" desconta o já pago
No bloco `-- Totais de parcelas`, `total_receber` passa a:
```
'total_receber', COALESCE(SUM(CASE
    WHEN p.status IN ('pendente','parcialmente_pago')
    THEN COALESCE(p.valor_original, p.valor) - COALESCE(p.valor_pago, 0)
    ELSE 0 END), 0),
```

### 3) Guarda de divisão no KPI "lucro"
No bloco `-- Totais de parcelas`, trocar `(c.valor_emprestado / c.numero_parcelas)` por `(c.valor_emprestado / NULLIF(c.numero_parcelas, 0))`.

## Não alterado
KPIs principais, próximos vencimentos, distribuição de status e capital mensal permanecem idênticos. Nenhuma mudança no frontend é necessária — o `Dashboard.tsx` e `services/dashboard.ts` já consomem as mesmas chaves.

## Entrega
Um único arquivo de migration novo com `CREATE OR REPLACE FUNCTION public.dashboard_stats()` contendo a definição completa atual com as três alterações aplicadas.
