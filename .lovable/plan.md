## Objetivo

Permitir o status `parcialmente_pago` em `parcelas` (já esperado pela UI e por `dashboard_stats`) e fazer com que a RPC `registrar_pagamento_parcela` o emita automaticamente em pagamentos de juros/parciais — auto-promovendo para `pago` quando o acumulado atinge o valor original.

## 1. Nova migration

### 1.1 Constraint
```sql
ALTER TABLE public.parcelas DROP CONSTRAINT IF EXISTS parcelas_status_check;
ALTER TABLE public.parcelas
  ADD CONSTRAINT parcelas_status_check
  CHECK (status IN ('pendente', 'pago', 'parcialmente_pago', 'vencido'));
```

### 1.2 Backfill (antes de recriar a função para evitar inconsistência)
```sql
UPDATE public.parcelas
SET status = 'parcialmente_pago', updated_at = now()
WHERE status = 'pendente'
  AND COALESCE(valor_pago, 0) > 0
  AND COALESCE(valor_pago, 0) < COALESCE(valor_original, valor);
```

### 1.3 `registrar_pagamento_parcela` — `CREATE OR REPLACE`
Manter assinatura e lógica atuais, alterando apenas o cálculo de `v_novo_status`:

```plpgsql
v_valor_ref := COALESCE(v_parcela.valor_original, v_parcela.valor);
IF v_novo_valor_pago >= v_valor_ref THEN
  v_novo_status := 'pago';
ELSIF v_novo_valor_pago > 0 THEN
  v_novo_status := 'parcialmente_pago';
ELSE
  v_novo_status := 'pendente';
END IF;
```

Isto cobre os 3 tipos (`total`, `juros`, `parcial`) e auto-promove para `pago` quando a soma dos parciais atinge o valor original. A verificação de "todas as parcelas pagas → contrato quitado" continua disparando quando `v_novo_status = 'pago'` (já existe).

### 1.4 `estornar_pagamento_parcela` — `CREATE OR REPLACE`
Continua resetando para `'pendente'` (correto: estorno apaga histórico de pagamentos, então `valor_pago` volta a 0).

## 2. Frontend

Sem alterações de código necessárias — as referências a `parcialmente_pago` já existem em:
- `src/pages/Parcelas.tsx` (filtros, badges, agregações, opção do select)
- `src/components/NotificacoesVencimento.tsx`
- `src/components/contratos/RelatorioGenerator.tsx` (badge âmbar `#f59e0b`)
- RPC `dashboard_stats` (pie chart bucket "Parciais", `total_receber`, `lucro`)

## 3. Verificação pós-migration

- Testar via UI:
  1. Pagar "juros" numa parcela pendente → badge "Parcial" aparece, filtro "Parcial" mostra a linha.
  2. Repetir 3 pagamentos parciais até atingir o valor original → status promove para "Pago" automaticamente; se for a última pendente do contrato, contrato vira `quitado`.
- Conferir no Dashboard que a fatia "Parciais" do gráfico de status aparece com o número correto.

## 4. O que NÃO muda

- RLS, triggers e demais RPCs.
- `parcelas_historico` continua armazenando cada evento (1 linha por pagamento parcial).
- Lógica de `data_pagamento` permanece (só preenchida ao quitar a parcela).