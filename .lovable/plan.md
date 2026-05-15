Simplificar a função PostgreSQL `gerar_parcelas` removendo o overload com 5 parâmetros.

### Contexto
A migration `20251210210012_41ded218-a764-4808-b30a-0779f1e01303.sql` define dois overloads:
1. **Completa** (7 parâmetros): `gerar_parcelas(uuid, int, numeric, date, text, boolean DEFAULT true, boolean DEFAULT false)`
2. **Curta** (5 parâmetros): `gerar_parcelas(uuid, int, numeric, date, text)` — apenas faz `PERFORM` na completa com valores padrão.

### Verificação de callers
Todas as chamadas no banco e no código usam a assinatura completa (7 argumentos):
- `criar_contrato_com_parcelas` (migrations 20260414212311 e 20260515033859) passa os 7 argumentos explicitamente.
- Nenhum código TypeScript chama `gerar_parcelas` diretamente (usa `criar_contrato_com_parcelas` RPC).

### Ação
Nova migration com:
- `DROP FUNCTION IF EXISTS public.gerar_parcelas(uuid, integer, numeric, date, text);`
- `CREATE OR REPLACE FUNCTION public.gerar_parcelas(...)` com a assinatura completa e os `DEFAULT` preservados.

Nenhum impacto no runtime — o overload curto é apenas um wrapper sem uso real.