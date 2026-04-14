

# Histórico de Pagamentos no Contrato

## Problema
Quando a cliente paga somente juros ou valores personalizados, os detalhes (datas, valores, tipo) ficam registrados na tabela `parcelas_historico`, mas na tela de detalhes do contrato você só vê o status atual da parcela — sem acesso ao histórico de cada pagamento.

## Solução
Adicionar um botão "Ver Histórico" em cada parcela dentro do `ContratoDetails`, que abre o `HistoricoModal` já existente mostrando todas as datas e valores pagos daquela parcela.

Além disso, melhorar a visualização das parcelas no contrato para mostrar um resumo inline: total já pago em pagamentos parciais e quantidade de pagamentos feitos.

## Mudanças

### 1. `src/components/contratos/ContratoDetails.tsx`
- Importar `HistoricoModal` de `src/components/parcelas/HistoricoModal`
- Adicionar estados para controlar o modal de histórico (`historicoModalOpen`, `parcelaHistorico`, `historicoData`)
- Criar função `loadHistorico(parcela)` que busca `parcelas_historico` da parcela selecionada
- Na tabela de parcelas (desktop), adicionar coluna "Valor Pago" mostrando total de pagamentos parciais quando > 0
- Adicionar botão "Histórico" (ícone `History`) ao lado do botão Baixar/Desfazer em cada parcela
- Nos cards mobile, mostrar o total já pago e botão de histórico
- Renderizar o `HistoricoModal` no final do componente

### 2. Nenhuma mudança no banco de dados
Os dados já estão na tabela `parcelas_historico` — apenas precisamos consultá-los a partir do contrato.

## Resultado
Ao abrir o contrato da Sílvia Regina, cada parcela terá:
- Indicação visual de quanto já foi pago (ex: "Pago: R$ 150,00 em 3x")
- Botão para ver o histórico completo com datas exatas, valores e tipo (juros/parcial/total)

