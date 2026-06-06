# Nova data de vencimento ao pagar juros / valor personalizado

## Objetivo
Quando o usuário escolher **"Apenas juros"** ou **"Valor personalizado"** no registro de pagamento, o sistema deve **liberar automaticamente** um campo para definir uma **nova data de vencimento** da parcela — facilitando o fluxo de empréstimos rotativos (paga os juros e empurra o vencimento). Vale tanto na tela de **Parcelas** quanto no detalhe do **Contrato**.

## Comportamento
- Ao selecionar "Quitar parcela" (total): nada muda — sem campo de nova data.
- Ao selecionar **"Apenas juros"** ou **"Valor personalizado"**: aparece um campo **"Nova data de vencimento"** já preenchido com o vencimento atual da parcela.
  - É **opcional**: se o usuário deixar igual ao vencimento atual, nada é alterado (comportamento idêntico ao de hoje).
  - Se informar uma data diferente, ao confirmar o pagamento o vencimento da parcela é atualizado automaticamente.
- O fluxo continua: primeiro registra o pagamento (juros/parcial — que nunca quita a parcela, conforme a regra existente), depois ajusta a data de vencimento.
- A alteração de data gera registro no histórico (evento "alteração de data"), com justificativa automática (ex.: "Nova data definida ao registrar pagamento de juros" / "...de valor personalizado"), reaproveitando a função `alterar_data_parcela` já existente.
- Se a parcela já estiver paga ou o contrato quitado, a função de data recusa — mas isso não ocorre aqui, pois juros/parcial nunca quitam.

## Tratamento de erros
- Se o pagamento for registrado com sucesso mas a alteração da data falhar, o pagamento é mantido e é exibido um toast avisando que a data não pôde ser alterada (para o usuário tentar pelo botão de editar vencimento). Assim nada quebra.

## Detalhes técnicos
- **`src/components/parcelas/PagamentoModal.tsx`**: adicionar estado `novaDataVencimento`, inicializado com `parcela.data_vencimento` quando o modal abre. Renderizar o input `type="date"` somente quando `tipoPagamento` for `"juros"` ou `"personalizado"`. Em `handleConfirmarPagamento`, após `registrarPagamento`, se `novaDataVencimento` diferente de `parcela.data_vencimento`, chamar `supabase.rpc("alterar_data_parcela", { p_parcela_id, p_nova_data, p_justificativa })`.
- **`src/components/contratos/dialogs/PagamentoDialog.tsx`** + **`src/components/contratos/hooks/useContratoDetails.ts`**: adicionar estado `novaDataVencimento` no hook (inicializado em `abrirModalPagamento` com `parcela.data_vencimento`), passar como prop ao dialog, exibir o mesmo campo condicional e aplicar a mesma lógica em `handleConfirmarPagamento`.
- Reaproveitar a RPC `alterar_data_parcela` (sem mudanças no banco). Sem migrações, sem alterar regras de negócio de pagamento.
- Datas no padrão já usado (`getLocalDateString`), respeitando o fuso.

## Fora de escopo
- Não altera a opção "Quitar parcela" (total).
- Não cria novo botão — o ajuste de data continua disponível também pelo botão "Alterar vencimento" existente.
