
## Decisão

**A Receber = soma de `valor_original` das parcelas em aberto.** Pagamentos do tipo `juros` e `parcial` entram em "Recebido" (caixa) mas **não** abatem A Receber. Só `tipo='total'` quita parcela (status='pago') e tira do A Receber.

Como na prática "parcela em aberto" = `status IN ('pendente','parcialmente_pago')`, e essas parcelas devem aparecer pelo valor cheio, a fórmula correta é:

```sql
SUM(COALESCE(valor_original, valor))
WHERE status IN ('pendente','parcialmente_pago')
```

Isso é exatamente o que o dashboard **já faz hoje**. O ajuste que fizemos no admin foi conceitualmente errado.

## Mudanças

### 1. Migration: reverter `admin_get_user_stats.valor_a_receber`

De:
```sql
SUM(COALESCE(valor_original, valor) - COALESCE(valor_pago, 0))
WHERE status IN ('pendente','parcialmente_pago')
```

Para:
```sql
SUM(COALESCE(valor_original, valor))
WHERE status IN ('pendente','parcialmente_pago')
```

Demais campos (`valor_emprestado_ativo`, `valor_emprestado_total`, `valor_recebido` etc.) ficam como estão.

### 2. Dashboard

Nenhuma mudança — `dashboard_stats.total_receber` já está correto.

### 3. Frontend

Sem mudança no `UserReportPanel.tsx`. Só ajustar o sub-rótulo do card "A Receber" de "saldo devedor" para **"parcelas em aberto"** para não induzir leitura errada (juros pago não abate).

### 4. Memória

Atualizar `mem://billing/financial-metrics-definitions` para deixar explícito:

> **A Receber** = SUM(valor_original) das parcelas com status `pendente` ou `parcialmente_pago`. Pagamentos do tipo `juros` e `parcial` **não abatem** A Receber — apenas entram em Recebido/Caixa. Apenas `tipo='total'` (status vira `pago`) tira a parcela do A Receber.

## Validação

Após aplicar:
- Para usuário com parcela R$ 600 e R$ 100 de juros pago → A Receber mostra R$ 600 (não R$ 500).
- Admin e dashboard mostram exatamente o mesmo valor de A Receber.

## Arquivos

- Nova migration alterando `admin_get_user_stats`.
- Pequeno ajuste de label em `src/components/admin/UserReportPanel.tsx`.
- Update em `mem://billing/financial-metrics-definitions`.
