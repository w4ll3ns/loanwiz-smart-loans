# Corrigir bug de timezone em pagamentos noturnos

## Problema
Pagamentos registrados após ~21h BRT aparecem no dia seguinte no calendário. Causa: `registrar_pagamento_parcela` grava `now()` (UTC) em `parcelas_historico.data_pagamento` (timestamptz), e as RPCs de calendário fazem `AT TIME ZONE 'UTC'` ao agrupar por dia — somando dois erros.

## Solução
Migration única que:

1. **`registrar_pagamento_parcela`**
   - Valida `p_data_pagamento`: não-nulo e `<= CURRENT_DATE + 1`.
   - No INSERT do histórico, troca `now()` por `(p_data_pagamento::timestamp AT TIME ZONE 'America/Sao_Paulo')` — grava meia-noite BRT do dia escolhido pelo usuário.
   - Hora real da operação fica preservada em `created_at`.

2. **`calendario_mensal` e `calendario_dia_detalhes`**
   - Trocar todas as ocorrências de `(h.data_pagamento AT TIME ZONE 'UTC')::date` por `(h.data_pagamento AT TIME ZONE 'America/Sao_Paulo')::date`.

3. **`excluir_evento_historico`**: nenhuma alteração necessária (não grava data).

4. **Coluna `data_pagamento`**: permanece `timestamptz` (sem ALTER TYPE).

5. **Sem backfill**. Comentário no final da migration com query de diagnóstico para o usuário rodar manualmente no SQL Editor e decidir caso a caso.

## Critério de aceite
- Pagamento às 22h BRT com data de hoje → aparece no card do dia correto.
- Data 1 ano no futuro → erro "Data do pagamento não pode ser no futuro".
- Histórico antigo intocado.
