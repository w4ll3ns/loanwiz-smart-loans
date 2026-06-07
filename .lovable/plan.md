## Objetivo

Deixar claro para quem usa o painel que os dois gráficos medem coisas diferentes, evitando a expectativa de que os valores "batam".

## Mudança (somente frontend)

Arquivo: `src/pages/Dashboard.tsx`

Adicionar um ícone de ajuda (`HelpCircle` do lucide-react) ao lado de cada título de card, com um tooltip explicativo. Usar os componentes já existentes em `src/components/ui/tooltip.tsx` (`Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`).

### 1. Card "Evolução do Lucro Mensal"
Tooltip:
> Mostra apenas o lucro (juros recebidos) de cada mês — o valor pago menos a parte do principal de cada parcela. Não inclui a devolução do capital emprestado.

### 2. Card "Fluxo de Capital Mensal"
Tooltip:
> Mostra o movimento de caixa do mês: total recebido (principal + juros) menos o total emprestado. O "Saldo do mês" pode ser negativo se você emprestou mais do que recebeu — por isso difere do Lucro Mensal.

### Detalhes técnicos
- Importar `HelpCircle` de `lucide-react` e os componentes de tooltip.
- Envolver os dois ícones com `TooltipProvider` (ou um provider único no topo do retorno).
- Ícone: `h-3.5 w-3.5 text-muted-foreground`, com `cursor-help`; no mobile o tooltip abre por toque (Radix suporta).
- Nenhuma alteração na função `dashboard_stats` nem na lógica de dados — apenas apresentação.

## Verificação
- Conferir build e visual no preview (desktop e mobile), garantindo que os tooltips aparecem e não quebram o layout dos títulos.