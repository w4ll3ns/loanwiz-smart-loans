

## Plano: Corrigir cards cortados no mobile da pagina Parcelas

### Problema

Na tela de 390px, os cards de resumo e os cards de parcelas estao sendo cortados no lado direito. O container pai tem `p-4` (16px de cada lado) e os cards usam `w-full`, mas o grid de 2 colunas com `gap-2` pode estar causando overflow sutil quando combinado com `border-l-4` e padding interno.

### Causa raiz

1. O `main` do Layout tem `p-4` (16px padding), totalizando area util de 358px em tela de 390px
2. Os cards de resumo em `grid-cols-2 gap-2` com `border-l-4` (4px extra) e `px-3` interno podem estourar por pixels
3. O container raiz da pagina tem `overflow-hidden` mas o conteudo real dos cards (valores monetarios longos com `break-all`) pode nao estar respeitando o limite

### Alteracoes em `src/pages/Parcelas.tsx`

1. **Container raiz**: adicionar `min-w-0` para garantir que flex children respeitem limites
2. **Grid de resumo**: reduzir `gap-2` para `gap-1.5` no mobile e garantir que cada card tenha `min-w-0`
3. **Cards de resumo**: reduzir padding dos headers de `px-3` para `px-2` no mobile, usar `text-sm` em vez de `text-base` para valores monetarios no mobile para evitar overflow
4. **Cards de parcelas (listagem)**: adicionar `min-w-0` e reduzir padding se necessario
5. **Container dos cards de parcelas**: garantir `overflow-hidden` no wrapper

### Arquivo modificado

| Arquivo | Acao |
|---|---|
| `src/pages/Parcelas.tsx` | Ajustar paddings, gaps e min-w-0 nos cards mobile para eliminar corte lateral |

