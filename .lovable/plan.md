## Refator de `src/components/contratos/ContratoDetails.tsx`

Mesma técnica usada em `Admin.tsx`: extrair lógica para hook e quebrar dialogs em arquivos próprios. Mantém comportamento 1:1, sem migrar para react-query nesta etapa.

### Nova estrutura

```text
src/components/contratos/
  ContratoDetails.tsx              (orquestrador, ~150-180 linhas)
  types.ts                         (interfaces Contrato e Parcela já exportadas hoje)
  hooks/
    useContratoDetails.ts          (estado + side effects + supabase calls)
  dialogs/
    PagamentoDialog.tsx            (registrar pagamento — total/parcial/juros)
    EditarJurosDialog.tsx          (editar tipo/percentual + recalcular_contrato_parcelas)
    ExcluirContratoDialog.tsx      (AlertDialog com excluir_contrato RPC)
    HistoricoParcelaDialog.tsx     (já existe? se sim, só consumir)
    EditarDataParcelaDialog.tsx    (idem)
```

### `useContratoDetails.ts` concentra:
- Estados: `isDeleteDialogOpen`, `isPagamentoDialogOpen`, `parcelaToPay`, `tipoPagamento`, `valorPagamento`, `dataPagamento`, `isEditDialogOpen`, `editFormData`, `isEditLoading`, `historicoModalOpen`, `parcelaHistorico`, `historicoData`, `editarDataOpen`, `parcelaEditarData`, `isEditingObs`, `obsText`, `isSavingObs`.
- Efeitos: sync de `obsText` com `contrato.observacoes`; reset de campos quando abre pagamento.
- Ações: `abrirPagamento`, `confirmarPagamento`, `abrirEditarJuros`, `salvarEditarJuros` (rpc `recalcular_contrato_parcelas`), `excluirContrato` (rpc `excluir_contrato`), `salvarObservacoes`, `abrirHistorico`, `abrirEditarData`.
- Recebe `{ contrato, onUpdate, onClose }` e devolve `{ state, actions }`.

### `ContratoDetails.tsx` (após o refator)
- Importa o hook e os dialogs.
- Renderiza apenas o `Dialog` principal com header/body (lista de parcelas, observações, botões) e monta os dialogs filhos passando estado/handlers do hook.
- Sem chamadas `supabase.*` diretas e sem RPCs inline.

### Validação
- `bun run build` ao final (executado pela harness).
- Checagem manual rápida de fluxos: registrar pagamento (total/parcial), editar juros, excluir contrato, editar observação, abrir histórico e editar data.

### Fora de escopo
- Migração para `react-query` (fica para uma próxima passada, igual fizemos com Dashboard).
- Mudanças de UI/UX ou de regras de negócio.