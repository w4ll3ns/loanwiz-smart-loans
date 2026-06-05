## Avaliação encontrada

- Usuário: **Italo Bruno C Silva** (`italobruno820@gmail.com`).
- Cliente do print: **Taiza Campelo Almeida**.
- Parcela afetada: **Parcela 1**, vencimento **05/06/2026**, valor original **R$ 960,00**.
- Estado atual: **Pago**, com **R$ 1.440,00** pago.
- O histórico atual mantém:
  - pagamento parcial inicial de **R$ 960,00**;
  - três pagamentos de juros de **R$ 160,00**;
  - alterações de vencimento até **05/06/2026**.
- Os logs mostram dois estornos em sequência hoje:
  - primeiro removeu um juros de **R$ 160,00**, baixando de **R$ 1.760,00** para **R$ 1.600,00**;
  - segundo removeu outro juros de **R$ 160,00**, baixando de **R$ 1.600,00** para **R$ 1.440,00**.

## O que provavelmente aconteceu

O botão **Desfazer** da tela de parcelas já chama a função segura `estornar_pagamento_parcela`, que remove somente o último pagamento. O estranho aqui é que ele foi acionado mais de uma vez, ou houve tentativa pelo histórico/fluxo antigo.

Além disso, existe uma função antiga no banco, `excluir_evento_historico`, usada pelo modal de histórico, que recalcula status de forma mais frágil: quando ainda existe pagamento parcial, ela pode voltar a parcela para `pendente` em vez de `parcialmente_pago`, e usa `CURRENT_DATE` para data de pagamento. Ela não parece ter sido a operação registrada nesses logs, mas é um ponto de risco para confusão/perda visual de histórico.

## Plano para corrigir os dados da cliente

1. **Restaurar o estado anterior aos dois estornos indevidos**
   - Recriar os dois pagamentos de juros de **R$ 160,00** removidos:
     - um com data de pagamento **05/06/2026**;
     - outro com data de lançamento original **06/05/2026 22:29:57.956967+00**.
   - Ajustar a parcela para:
     - `valor_pago = 1760.00`;
     - `status = 'pago'`;
     - `data_pagamento = '2026-06-05'`.
   - Manter o contrato como `quitado`.

2. **Desfazer somente a última baixa, como solicitado**
   - Depois de restaurar, remover apenas a última baixa que ele precisa refazer.
   - Resultado esperado final:
     - `valor_pago = 1600.00`;
     - `status = 'pago'`;
     - histórico preservado com o pagamento parcial e os juros anteriores;
     - apenas o último pagamento de juros de **R$ 160,00** removido.

3. **Registrar a intervenção com segurança**
   - Fazer a correção por SQL de dados, sem alterar estrutura do banco.
   - Inserir um registro em `audit_logs` descrevendo a restauração manual e o estorno único aplicado.

## Plano para evitar recorrência

1. **Adicionar proteção contra duplo clique no botão Desfazer**
   - Nas telas que têm `Desfazer`, bloquear o botão enquanto a operação estiver em andamento.
   - Isso evita dois estornos seguidos por toque duplo, rede lenta ou repetição de clique.

2. **Corrigir a função antiga do histórico**
   - Atualizar `excluir_evento_historico` para usar a mesma regra da função segura:
     - se soma paga >= valor da parcela: `pago`;
     - se soma paga > 0: `parcialmente_pago`;
     - se soma paga = 0: `pendente`.
   - Evitar que exclusão manual pelo histórico deixe status incorreto.

3. **Sem alterar cálculos de agregação ou regras de negócio existentes**
   - A mudança fica restrita ao fluxo de estorno/exclusão de histórico e à proteção visual/estado de carregamento.