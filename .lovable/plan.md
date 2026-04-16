

# Fix: Relatório Atrasados ignoring partial payment business rule

## Problem
The overdue report calculates `valorAtrasado` as `valor_original - valor_pago`, showing R$ 5,000 for Adriane. But per the partial payment business rule, partial/interest-only payments do NOT reduce the remaining balance. The full `valor_original` (R$ 5,500) should be shown as owed.

## Solution
In `src/components/contratos/RelatorioAtrasados.tsx`, line 72, change the calculation to use the full `valor_original` (or `valor`) without subtracting `valor_pago`:

```
// Before (wrong):
entry.valorAtrasado += Number(p.valor_original || p.valor) - Number(p.valor_pago || 0);

// After (correct):
entry.valorAtrasado += Number(p.valor_original || p.valor);
```

This aligns with the established rule: "Restante a Quitar always reflects the original installment value for pending installments."

## File
- `src/components/contratos/RelatorioAtrasados.tsx` — single line change on line 72

