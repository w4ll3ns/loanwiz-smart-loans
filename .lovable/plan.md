## Plano: Adicionar campo `valor_vencido` ao Dashboard

Alterar apenas 2 arquivos para conectar a nova chave `valor_vencido` retornada pela função `dashboard_stats` (já migrada no banco).

### Alterações

1. **src/services/dashboard.ts**
   - Adicionar `valor_vencido: number;` à interface `DashboardData`.

2. **src/pages/Dashboard.tsx**
   - Adicionar `valorVencido: number;` à interface `DashboardStats`.
   - No objeto `stats` montado dentro do `queryFn`, adicionar `valorVencido: Number(raw.valor_vencido) || 0,`.

Nenhuma outra mudança será feita.