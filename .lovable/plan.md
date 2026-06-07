# Incluir saídas de capital (empréstimos concedidos) no calendário

## Objetivo
Atualizar as duas funções do calendário para também expor as **saídas de capital** (contratos por `data_emprestimo`), além de alinhar o "previsto" à regra de valor cheio. Migration aditiva única com `CREATE OR REPLACE` das duas funções, mantendo filtro por `v_user_id`, `SECURITY DEFINER`, `search_path` e os REVOKE/GRANT existentes.

## 1. `public.calendario_mensal(p_mes, p_ano)`
- Adicionar CTE `saidas_dia` (capital emprestado por dia):
  ```sql
  saidas_dia AS (
    SELECT c.data_emprestimo AS dia,
           SUM(COALESCE(c.valor_emprestado, 0))::numeric AS valor,
           COUNT(*)::int AS qtd
    FROM contratos c
    JOIN clientes cl ON cl.id = c.cliente_id
    WHERE cl.user_id = v_user_id
      AND c.data_emprestimo BETWEEN v_primeiro_dia AND v_ultimo_dia
    GROUP BY c.data_emprestimo
  )
  ```
- No bloco `computado`: `LEFT JOIN saidas_dia sd ON sd.dia = d.dia` e colunas `COALESCE(sd.valor,0) AS valor_saida`, `COALESCE(sd.qtd,0) AS qtd_saidas`.
- No `jsonb_build_object` de cada dia: acrescentar `'valor_saida'` e `'qtd_saidas'`.
- Novos agregados do mês em `totais`: `'total_emprestado_mes'` = `SUM(valor_saida)`, `'qtd_emprestimos_mes'` = `SUM(qtd_saidas)` (declarar as variáveis correspondentes).
- Consistência: na CTE `previstos_dia`, trocar `COALESCE(p.valor_original, p.valor) - COALESCE(p.valor_pago, 0)` por `COALESCE(p.valor_original, p.valor)` (valor cheio).

## 2. `public.calendario_dia_detalhes(p_data)`
- Adicionar terceira lista `emprestimos` (contratos concedidos no dia):
  ```sql
  SELECT c.id AS contrato_id, cl.nome AS cliente_nome, c.valor_emprestado,
         c.numero_parcelas, c.percentual, c.periodicidade, c.data_emprestimo
  FROM contratos c JOIN clientes cl ON cl.id = c.cliente_id
  WHERE cl.user_id = v_user_id AND c.data_emprestimo = p_data
  ORDER BY cl.nome
  ```
  Agregar em `v_total_emprestado` (`SUM(valor_emprestado)`) e `v_qtd_emprestimos` (`COUNT(*)`).
- No `RETURN`: adicionar chave `'emprestimos'` e, em `totais`, `'total_emprestado'` e `'qtd_emprestimos'`.
- Consistência: no campo `valor_previsto`, trocar `COALESCE(p.valor_original, p.valor) - COALESCE(p.valor_pago, 0)` por `COALESCE(p.valor_original, p.valor)` (valor cheio).

## Observações técnicas
- Mudanças são puramente aditivas no JSON retornado — o frontend atual (tipos `DiaCalendario`/`CalendarioMensal`) continua funcionando sem alterações.
- Exibir as saídas na UI do calendário (cards/modal) fica como passo opcional posterior; este plano cobre apenas as funções de banco conforme solicitado.

## Validação
- Conferir que ambas as funções recriam sem erro e que os novos campos (`valor_saida`, `qtd_saidas`, `total_emprestado_mes`, `qtd_emprestimos_mes`, `emprestimos`, `total_emprestado`, `qtd_emprestimos`) aparecem no retorno para um usuário com contratos.
