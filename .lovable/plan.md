# Organizar abas Parcelas e Histórico por cliente

## Problema
Na planilha exportada, as abas **Parcelas** e **Histórico** saem em ordem misturada (vêm do banco em lotes ordenados só por número da parcela), dificultando a leitura.

## Solução
Ordenar os dados antes de montar as abas, agrupando por cliente.

### Aba Parcelas
Ordenar por:
1. Nome do cliente (A→Z, sem diferenciar acento/maiúsculas)
2. Contrato (mantendo as parcelas do mesmo contrato juntas, por data do empréstimo)
3. Número da parcela (crescente)

### Aba Histórico
Ordenar por:
1. Nome do cliente (A→Z)
2. Contrato
3. Número da parcela
4. Data do evento (cronológica)

## Detalhes técnicos
- Em `src/components/contratos/exportPlanilhaCompleta.ts`, após buscar parcelas e histórico, aplicar `sort` nas listas usando o nome do cliente (resolvido via `nomePorContrato`) com `localeCompare` e normalização de acentos (padrão `removerAcentos` já usado no projeto), depois por contrato e número da parcela.
- Para o histórico, usar o número da parcela (`numeroParcelaPorId`) e a `data_pagamento` como desempate.
- Sem mudanças de UI, backend ou regras de negócio — apenas ordenação dos dados exportados.
