# Corrigir cards de resumo do Calendário

## Problema
A função `public.calendario_mensal(mes, ano)` retorna o objeto de totais sob a chave **`resumo`**, com nomes de campos **sem** o sufixo `_mes` (ex.: `qtd_recebimentos`, `atrasado_mes`).

O frontend `src/pages/Calendario.tsx` (linha 128) lê `data.totais` e espera os campos com sufixo `_mes`:
- `recebido_mes`, `previsto_mes`
- `qtd_recebimentos_mes`, `qtd_previstos_mes`
- `total_atrasado_mes`, `qtd_atrasados_mes`
- `total_emprestado_mes`, `qtd_emprestimos_mes`

Como `data.totais` é `undefined`, todos os cards caem no fallback `?? 0` e o mês aparece zerado — mesmo havendo pagamentos (confirmado no banco para o usuário Italo Bruno, jul/2026: 2 recebimentos / R$ 1.500).

## Correção
Nova migration aditiva com `CREATE OR REPLACE FUNCTION public.calendario_mensal(integer, integer)`. Todo o corpo (CTEs, cálculos, filtro por `v_user_id`, array `dias`) permanece **idêntico**. Muda apenas o bloco `RETURN jsonb_build_object(...)`:

- Renomear a chave `resumo` → **`totais`**.
- Ajustar os nomes dos campos internos para casar com o frontend:
  - `qtd_recebimentos` → `qtd_recebimentos_mes`
  - `qtd_previstos` → `qtd_previstos_mes`
  - `atrasado_mes` → `total_atrasado_mes`
  - `qtd_atrasados` → `qtd_atrasados_mes`
  - `recebido_mes`, `previsto_mes`, `total_emprestado_mes`, `qtd_emprestimos_mes` já estão corretos.

Manter os `REVOKE`/`GRANT` existentes (a migration só substitui o corpo; permissões não são alteradas por `CREATE OR REPLACE`).

## Validação
Após aplicar, consultar `calendario_mensal(7, 2026)` para o usuário e confirmar que `totais.recebido_mes` reflete R$ 1.500 e os cards do Calendário deixam de exibir zero.

## Detalhes técnicos
```text
RETURN jsonb_build_object(
  'dias', v_dias,
  'totais', jsonb_build_object(
    'recebido_mes',        v_recebido_mes,
    'previsto_mes',        v_previsto_mes,
    'total_atrasado_mes',  v_atrasado_mes,
    'qtd_recebimentos_mes',v_qtd_recebimentos,
    'qtd_previstos_mes',   v_qtd_previstos,
    'qtd_atrasados_mes',   v_qtd_atrasados,
    'total_emprestado_mes',v_total_emprestado_mes,
    'qtd_emprestimos_mes', v_qtd_emprestimos_mes
  )
);
```
