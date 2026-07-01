## Diagnóstico

O calendário está zerado por um **descasamento de contrato** entre a função `calendario_mensal` e a página que a consome — não por perda de dados.

- A função retorna os totais dentro da chave **`resumo`**, com nomes `qtd_recebimentos`, `qtd_previstos`, `atrasado_mes`, `qtd_atrasados`.
- O frontend (`src/pages/Calendario.tsx`) lê **`data.totais`** com `qtd_recebimentos_mes`, `qtd_previstos_mes`, `total_atrasado_mes`, `qtd_atrasados_mes`.
- Como `data.totais` não existe, todos os cards caem em `?? 0`.

Confirmado: os dados existem (ex.: Italo em jul/2026 = 2 recebimentos / R$ 1.500 e 22 previstos).

## Correção

Alinhar o **retorno da função** ao que a tela espera (restaura o comportamento anterior sem tocar no frontend). Nova migration aditiva, `CREATE OR REPLACE FUNCTION public.calendario_mensal(integer, integer)`, mantendo TODA a lógica atual (incluindo os pagamentos de hoje no `recebido_mes` e as saídas de capital) e alterando **apenas o bloco `RETURN`**:

- Trocar a chave wrapper `'resumo'` por `'totais'`.
- Renomear as chaves internas para o padrão `_mes` esperado:
  - `qtd_recebimentos` → `qtd_recebimentos_mes`
  - `qtd_previstos` → `qtd_previstos_mes`
  - `atrasado_mes` → `total_atrasado_mes`
  - `qtd_atrasados` → `qtd_atrasados_mes`
- Manter `recebido_mes`, `previsto_mes`, `total_emprestado_mes`, `qtd_emprestimos_mes` como já estão.
- Manter a chave `'dias'` inalterada (os campos por dia já batem com o frontend).

Nada mais da função muda (janela do mês, isolamento por usuário, cálculo de previsto/recebido/saídas).

## Validação

Após aplicar, valido simulando o usuário Italo em jul/2026 que `totais.recebido_mes` = 1500 e `totais.qtd_previstos_mes` = 22, confirmando que os cards voltam a exibir valores.
