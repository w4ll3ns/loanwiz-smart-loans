
## Objetivo

Alinhar os números do "Relatório por Usuário" (admin) com o que o próprio usuário vê no dashboard, e separar capital em circulação de histórico total.

## Problemas atuais em `admin_get_user_stats`

- `valor_emprestado`: soma todos os contratos (inclui `quitado`), divergindo do dashboard que conta só `ativo`.
- `valor_a_receber`: usa `p.valor` (não `valor_original`) e filtra só `status = 'pendente'`, ignorando `parcialmente_pago`. Subestima o saldo devedor real.

## Mudanças

### 1. Migration: atualizar `admin_get_user_stats`

Novo JSON retornado:

```
{
  total_clientes,
  total_contratos,                 -- mantém (todos os contratos)
  valor_emprestado_ativo,          -- NOVO: SUM(valor_emprestado) WHERE status='ativo'
  valor_emprestado_total,          -- NOVO: SUM(valor_emprestado) de todos (substitui o antigo valor_emprestado)
  valor_a_receber,                 -- AJUSTADO: SUM(COALESCE(valor_original, valor) - COALESCE(valor_pago,0))
                                   --          WHERE status IN ('pendente','parcialmente_pago')
  valor_recebido                   -- mantém
}
```

Manter `valor_emprestado` como alias do `_total` por compatibilidade temporária (não obrigatório — pode remover já que só o admin consome).

### 2. Frontend: `UserReportPanel.tsx` + `types.ts`

- Adicionar `valor_emprestado_ativo` e `valor_emprestado_total` em `UserStats`.
- No grid de KPIs, trocar o card único "Total Emprestado" por dois cards:
  - **Em Circulação** → `valor_emprestado_ativo` (contratos ativos)
  - **Histórico Total** → `valor_emprestado_total` (todos os contratos)
- "A Receber" continua, agora refletindo saldo devedor real.
- Grid passa de `lg:grid-cols-4` para `lg:grid-cols-5` (5 cards: Clientes, Contratos, Em Circulação, Histórico, A Receber). Em mobile mantém `grid-cols-2`.

### 3. Validação

Após aplicar, comparar para um usuário de teste:
- "Em Circulação" do relatório admin == `total_emprestado` do dashboard daquele usuário.
- "A Receber" do relatório admin == `total_receber` do dashboard daquele usuário.

## Arquivos afetados

- Nova migration alterando `admin_get_user_stats`.
- `src/components/admin/types.ts` — campos novos em `UserStats`.
- `src/components/admin/UserReportPanel.tsx` — layout dos cards.

Sem mudança em RLS, grants ou outras telas.
