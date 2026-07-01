## Objetivo

Fazer o card **"Recebido no mês"** do calendário incluir os pagamentos feitos **hoje**, alinhando com o comportamento do dashboard ("Recebido Hoje"). Hoje, a baixa de R$ 400 do cliente LADSON (feita em 01/07 pelo Italo) não entra no total mensal porque a função só soma dias já no passado.

## Diagnóstico confirmado

Na função `public.calendario_mensal`, o total de recebidos do mês soma apenas os dias marcados como `passado` (`d.dia < CURRENT_DATE`). O pagamento de hoje é guardado no campo por dia `ja_recebido_hoje`, mas **não** entra no total mensal. Como a baixa foi no dia 01/07 (primeiro dia do mês), não há dias anteriores e o total fica R$ 0.

## Mudança (uma migration aditiva, `CREATE OR REPLACE FUNCTION`)

Alterar **somente** os agregados finais da `calendario_mensal`, sem tocar na montagem por dia (a célula do calendário de hoje continua mostrando o previsto normalmente):

1. **Total recebido do mês** — passar a somar os pagamentos do passado **mais** os pagamentos de hoje:
   - de `SUM(CASE WHEN tipo = 'passado' THEN valor ELSE 0 END)`
   - para `SUM(CASE WHEN tipo = 'passado' THEN valor ELSE 0 END) + SUM(ja_recebido_hoje)`

2. **Quantidade de recebimentos do mês** — incluir também as movimentações de pagamento de hoje, para o contador do card bater com o valor.

3. Nenhuma outra alteração: previsto do mês, atrasados, saídas de capital, série de dias e isolamento por `v_user_id` permanecem idênticos. REVOKE/GRANT existentes preservados.

## Resultado

- A baixa de hoje (ex.: R$ 400 do LADSON) passa a aparecer imediatamente no card "Recebido no mês".
- A célula do dia de hoje no calendário continua exibindo o previsto (sem regressão visual).
- Consistente com o "Recebido Hoje" do dashboard.

## Detalhes técnicos

- O campo `ja_recebido_hoje` já é calculado por dia como `CASE WHEN d.dia = CURRENT_DATE THEN COALESCE(pg.valor,0) ELSE 0 END`, então basta somá-lo ao total mensal — sem novas queries nem novo JOIN.
- Migration puramente aditiva (`CREATE OR REPLACE`), sem alterar assinatura da função; nenhuma mudança no frontend é necessária (`Calendario.tsx` já consome o total retornado).
