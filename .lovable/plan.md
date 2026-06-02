## Objetivo

Criar uma trilha de auditoria para **estornos de pagamento** e **recálculos de juros de contrato**, registrando quem fez, quando e exatamente o que mudou — visível no painel Admin (tabela `audit_logs`).

## Por que no audit_logs funciona para ações de usuário comum

As ações são feitas por usuários comuns, e o `audit_logs` bloqueia insert direto via RLS. A solução é gravar o log **de dentro das próprias funções** `estornar_pagamento_parcela` e `recalcular_contrato_parcelas`, que são `SECURITY DEFINER` (rodam como dono e ignoram a RLS) — mesmo padrão já usado pela RPC `insert_audit_log`. Não é preciso mexer em RLS nem em permissões.

## Mudanças no banco (migração)

Atualizar duas funções para inserir um registro em `audit_logs` ao final da operação:

```text
audit_logs:
  user_id        = auth.uid()        (quem executou)
  target_user_id = dono do contrato  (= o próprio usuário)
  action         = 'estorno_pagamento' | 'recalculo_contrato'
  details (jsonb)= dados do que foi revertido/alterado
  created_at     = now()             (quando)
```

**1. `estornar_pagamento_parcela`** — após reverter o último pagamento, gravar log com:
- `parcela_id`, `contrato_id`, `cliente_nome`, `numero_parcela`
- `valor_estornado`, `tipo_pagamento` do lançamento revertido, `data_lancamento_revertido`
- `valor_pago_anterior` / `valor_pago_novo`
- `status_anterior` / `status_novo`
- `contrato_reaberto`

**2. `recalcular_contrato_parcelas`** — após recalcular, gravar log com:
- `contrato_id`, `cliente_nome`
- `tipo_juros_anterior` / `tipo_juros_novo`
- `percentual_anterior` / `percentual_novo`
- `valor_total_anterior` / `valor_total_novo`
- `valor_parcela_novo`, `parcelas_pendentes_afetadas`

Ambas capturam os valores "anteriores" no início (antes do `UPDATE`) para registrar o antes/depois. Nenhuma mudança de assinatura/retorno das funções.

## Mudanças no frontend

`src/components/admin/AuditLogsPanel.tsx`:
- Adicionar rótulos no `actionLabels`: `estorno_pagamento → 'Estorno de Pagamento'`, `recalculo_contrato → 'Recálculo de Juros'`.
- Adicionar coluna "Executado por" mostrando o `user_id` (ator) resolvido via `profiles`, já que nessas ações o ator é o usuário comum (não um admin). A coluna "Usuário Alvo" continua mostrando o dono.

Sem mudanças em `useAdmin` necessárias (já carrega os últimos 100 logs); apenas confirmar que a query traz `user_id`.

## Observações

- Estornos/recálculos passados (anteriores a esta mudança) não terão log — a trilha começa a partir da implementação.
- O log é apenas de leitura no Admin; nenhuma ação de reverter a partir dele.

## Memória

Atualizar `mem://admin/infraestrutura-logs-auditoria` para incluir que estornos de pagamento e recálculos de juros (ações de usuário comum) também são registrados via as próprias funções SECURITY DEFINER.
