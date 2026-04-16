

# Fix: Filter buttons overflowing on mobile

## Problem
On the contracts page (mobile 390px), the row containing "Contratos Ativos (14)", CSV button, and the Ativos/Quitados/Todos filter toggle group are all on a single line with `flex items-center justify-between`, causing horizontal overflow past the screen edge.

## Solution
Stack the title row and filters vertically on mobile. Move the filter toggle group to its own row below the title+CSV line on small screens.

### Changes in `src/pages/Contratos.tsx` (lines 310-346)

Restructure the layout:
- **Line 1**: Title ("Contratos Ativos (14)") + CSV button — `flex justify-between`
- **Line 2**: Filter toggle group — full width, `overflow-x-auto` with `flex-shrink-0` buttons

This ensures the filters never exceed the screen width on mobile while remaining inline on desktop via `md:flex-row`.

## File
- `src/pages/Contratos.tsx` — lines ~310-346 only

