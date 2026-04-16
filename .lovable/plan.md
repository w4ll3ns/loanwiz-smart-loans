

# Fix: Date fields overflowing on iPhone (Parcelas page)

## Problem
On real iPhones, the native `<input type="date">` renders wider than in the Lovable preview simulator. The date inputs in the "Período" card overflow past the screen edge because iOS Safari's native date picker UI adds extra chrome that doesn't fit within the current container.

## Root Cause
Lines 263-280 in `src/pages/Parcelas.tsx`: The date inputs use `w-full` inside `flex-1 min-w-0` containers, but the parent Card lacks `overflow-hidden`, and on iOS the native date input appearance can push beyond bounds.

## Solution
Apply these fixes to `src/pages/Parcelas.tsx` (lines ~263-280):

1. Add `overflow-hidden` to the Card wrapping the date filters
2. Add `min-w-0` to the flex row container to prevent flex children from overflowing
3. Add `max-w-full` and `appearance-none` styling to date inputs for iOS compatibility
4. Ensure the container uses `overflow-x-hidden` as a safety net

Changes are limited to the period filter Card (~5 lines adjusted). No logic or business rule changes.

## File
- `src/pages/Parcelas.tsx` — lines 263-280 only

