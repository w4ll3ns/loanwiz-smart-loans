

# Add "Observações" field to contracts

## What changes

Add an optional notes/observations field (`observacoes`) to the contracts table and integrate it into the creation form and details view, allowing users to annotate contracts at creation time or edit them later.

## Technical details

### 1. Database migration
- Add column `observacoes TEXT NULL` to the `contratos` table. No RLS changes needed (existing policies cover all columns).

### 2. `src/components/contratos/ContratoForm.tsx`
- Add `observacoes: string` to `ContratoFormData` interface and `defaultFormData`
- Add a `<Textarea>` field after the "Regras de Cobrança" section, labeled "Observações (opcional)"
- Pass `observacoes` through to the contract creation flow — since `criarContratoComParcelas` is an RPC that doesn't accept observacoes, we'll update the contract immediately after creation with a simple `.update()` call

### 3. `src/services/contratos.ts`
- Add `observacoes?: string` to `CriarContratoParams`
- After the RPC call returns the contract ID, if `observacoes` is provided, do a `supabase.from('contratos').update({ observacoes }).eq('id', contratoId)`

### 4. `src/components/contratos/ContratoDetails.tsx`
- Add `observacoes?: string` to the `Contrato` interface
- Display the observations below the contract summary cards (before the actions row), with an inline edit capability — a small edit icon that toggles a textarea, with save/cancel
- The save calls `supabase.from('contratos').update({ observacoes }).eq('id', contrato.id)` then triggers `onContratoUpdated()`

### 5. `src/pages/Contratos.tsx`
- Ensure `loadContratos` query already uses `select("*, clientes(nome)")` which returns all columns — the new `observacoes` column will be included automatically

No business logic, RLS, or RPC changes needed beyond the column addition.

