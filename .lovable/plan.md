

## Adicionar Gráfico de Evolução do Lucro Mensal no Dashboard

### O que será feito

Um gráfico de barras mostrando o lucro mensal (juros recebidos) ao longo dos últimos 6 meses, posicionado entre os cards de resumo e o alerta de parcelas vencidas.

### Implementação

**Arquivo**: `src/pages/Dashboard.tsx`

1. **Importar** componentes de chart (`ChartContainer`, `ChartTooltip`, `ChartTooltipContent`) e `BarChart`/`Bar`/`XAxis`/`YAxis` do recharts
2. **Processar dados mensais** a partir das parcelas já carregadas:
   - Filtrar parcelas com status `pago` ou `parcialmente_pago`
   - Agrupar por mês/ano usando `data_pagamento`
   - Calcular lucro de cada parcela: `valor_pago - (valor_emprestado / numero_parcelas)`
   - Somar por mês, últimos 6 meses
3. **Adicionar estado** `lucroMensal` com array `{ mes: string, lucro: number }`
4. **Renderizar** um `Card` com `ChartContainer` + `BarChart` responsivo, barras verdes, tooltip formatado em R$

### Visual

```text
┌─────────────────────────────────┐
│  Evolução do Lucro Mensal       │
│  ┌───┐                          │
│  │   │ ┌───┐                    │
│  │   │ │   │ ┌───┐ ┌───┐       │
│  │   │ │   │ │   │ │   │ ┌───┐ │
│  └───┘ └───┘ └───┘ └───┘ └───┘ │
│  Jan   Fev   Mar   Abr   Mai   │
└─────────────────────────────────┘
```

### Detalhes técnicos

- Usa os mesmos dados da query existente (sem query adicional)
- Responsivo: em mobile (390px) o gráfico ocupa 100% da largura com aspect ratio menor
- Meses sem pagamentos aparecem com barra zerada
- Labels do eixo X em formato "Jan/25", "Fev/25"
- Tooltip mostra valor formatado: "R$ 1.234,56"

