

# Add due date editing to Contract Details parcelas

## Problem
In the Contratos page, the contract details modal shows parcelas but has no option to edit their due dates. The Parcelas page already has this feature via `EditarDataModal`.

## Solution
Reuse the existing `EditarDataModal` component inside `ContratoDetails.tsx`. Add a "calendar/edit date" button next to each parcela (for pending ones only), which opens the same modal used in the Parcelas page.

### Changes in `src/components/contratos/ContratoDetails.tsx`

1. **Import** `EditarDataModal` from `@/components/parcelas`
2. **Add state**: `editarDataOpen` (boolean) and `parcelaEditarData` (parcela object or null)
3. **Add edit-date button** next to each pending parcela — both in the desktop table and mobile cards. Use a small `CalendarIcon` or `Pencil` button.
4. **Render** `<EditarDataModal>` at the bottom, passing:
   - `isOpen={editarDataOpen}`
   - `onOpenChange={setEditarDataOpen}`
   - `parcela={parcelaEditarData}` (mapped to match the expected interface — needs `contratos.clientes.nome` from the parent `contrato`)
   - `onDataAlterada={() => onParcelasUpdated(contrato.id)}`

The `EditarDataModal` expects a parcela with `{ id, data_vencimento, data_vencimento_original, numero_parcela, contratos?: { clientes?: { nome } } }` — we'll map the ContratoDetails parcela to this shape using the parent contrato's client name.

### UI placement
- **Desktop table**: Add a small calendar icon button in the "Ação" column for pending parcelas
- **Mobile cards**: Add a small calendar icon button next to the history button for pending parcelas

No database, RLS, or business logic changes. The existing `EditarDataModal` handles everything including justification, history logging, and validation.

## File
- `src/components/contratos/ContratoDetails.tsx` — import, state, buttons, and modal render

