## Objetivo

Corrigir o cálculo do **lucro** (total e mensal) na RPC `public.dashboard_stats` para usar o **modelo de juros** lido de `parcelas_historico`, manter `valor_vencido`/`total_receber` com **valor cheio** (juros/parcial não abatem a parcela) e eliminar um **vazamento entre usuários** no bloco de lucro mensal.

Tudo via `CREATE OR REPLACE FUNCTION` numa **nova migration aditiva** (não destrutiva). Nenhuma mudança de frontend.

## Mudanças na função (apenas estes blocos)

### (A) Bloco "-- Totais de parcelas"
- `total_recebido`, `parcelas_vencidas` e `total_receber`: **mantidos como estão** (`total_receber` continua valor cheio, sem subtrair `valor_pago`).
- `valor_vencido`: passa a usar **valor cheio**, sem subtrair `valor_pago`:
  ```sql
  'valor_vencido', COALESCE(SUM(CASE
     WHEN p.status IN ('pendente','parcialmente_pago') AND p.data_vencimento < CURRENT_DATE
     THEN COALESCE(p.valor_original, p.valor) ELSE 0 END), 0),
  ```
- A chave `'lucro'` é **removida** deste `jsonb_build_object` (passa a ser calculada em B).

### (B) Recálculo do lucro total pelo modelo de juros (novo bloco logo após A)
Lê `parcelas_historico` (apenas `tipo_evento = 'pagamento'`):
- `juros` e `parcial` = 100% lucro;
- `total` = `valor_pago - (valor_emprestado / numero_parcelas)` (juro embutido).
```sql
SELECT v_stats || jsonb_build_object('lucro', COALESCE((
  SELECT SUM(CASE
    WHEN h.tipo_pagamento IN ('juros','parcial') THEN COALESCE(h.valor_pago,0)
    WHEN h.tipo_pagamento = 'total' THEN COALESCE(h.valor_pago,0) - (c.valor_emprestado / NULLIF(c.numero_parcelas,0))
    ELSE 0 END)
  FROM parcelas_historico h
  JOIN parcelas p ON p.id = h.parcela_id
  JOIN contratos c ON p.contrato_id = c.id
  JOIN clientes cl ON c.cliente_id = cl.id
  WHERE cl.user_id = v_user_id AND h.tipo_evento = 'pagamento'
), 0)) INTO v_stats;
```

### (C) Substituir todo o bloco "-- Lucro mensal"
Mesmo modelo de juros do histórico, com o filtro de `user_id` aplicado dentro de subconsulta pré-filtrada (corrige o vazamento que existia no `LEFT JOIN`). Agrupa por mês nos últimos 6 meses usando `h.data_pagamento::date`.

### Blocos NÃO alterados
KPIs principais, próximos vencimentos, distribuição de status e capital mensal permanecem idênticos.

## Detalhes técnicos
- A migration será um único `CREATE OR REPLACE FUNCTION public.dashboard_stats()` reescrevendo a função completa com os blocos A/B/C ajustados e os demais preservados literalmente.
- Mantém `SECURITY DEFINER`, `SET search_path = public`, assinatura e tipo de retorno (`jsonb`).
- Sem alteração de schema, grants ou RLS.

## Verificação
- Conferir que a migration aplica sem erro.
- Validar via `dashboard_stats()` que `lucro`, `lucro_mensal` e `valor_vencido` retornam valores coerentes e que o lucro mensal não mistura dados de outros usuários.
