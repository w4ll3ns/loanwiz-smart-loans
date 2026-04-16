

# Fix: Replace native date inputs with custom DatePicker on Parcelas

## Problem
Native `<input type="date">` on iOS Safari ignores `appearance-none` and renders its own UI chrome (spinner, calendar icon) that pushes the input beyond the container width. CSS-only fixes cannot fully control iOS Safari's native date input rendering — this is a known platform limitation.

## Solution
Replace the two native `<input type="date">` fields in the Período card with Shadcn's Popover + Calendar (DatePicker) pattern. This renders identically on all platforms since it's a fully custom UI — no native browser chrome involved.

### Changes

**`src/pages/Parcelas.tsx`** (lines 262-281):
- Replace `<Input type="date">` for "Período inicial" and "Período final" with `<Popover>` + `<PopoverTrigger>` (Button) + `<PopoverContent>` + `<Calendar mode="single">`
- Convert `dataInicioDashboard`/`dataFimDashboard` (currently ISO strings `YYYY-MM-DD`) to/from `Date` objects for the Calendar component
- Display formatted date (`dd/MM/yyyy`) in the trigger button, or placeholder text when empty
- Add `pointer-events-auto` to Calendar className per Shadcn requirements
- Keep the "Limpar" button as-is

**Imports to add**: `format, parse` from `date-fns`, `ptBR` from `date-fns/locale/pt-BR`, `Calendar`, `Popover/PopoverContent/PopoverTrigger`, `CalendarIcon` from lucide-react.

No logic, business rules, or database changes. Only the date input rendering method changes.

