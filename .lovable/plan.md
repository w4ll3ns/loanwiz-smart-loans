

# Sprint Estrutural — Hardening do LoanWiz Smart Loans

## Análise da Situação Atual

Base em produção: 53 clientes, 79 contratos, 242 parcelas, 355 registros de histórico.
Status existentes: contratos (`ativo`, `quitado`), parcelas (`pago`, `pendente`). Sem `parcialmente_pago` atualmente na base.

### Problemas Identificados (por prioridade)

1. **Criação de contrato não-transacional** — contrato pode ficar órfão se `gerar_parcelas` falhar
2. **Lógica de pagamento duplicada** em 3 locais: `PagamentoModal.tsx`, `ContratoDetails.tsx`, e `Parcelas.tsx` (handleMarcarPendente)
3. **Credenciais hardcoded** no `client.ts` (URL + anon key diretos no código)
4. **Dashboard faz 4 queries separadas** com `select("*")` e processa tudo no navegador
5. **Sem React Query** — dados buscados via `useEffect` manual, sem cache/invalidação
6. **Estorno inseguro** — deleta histórico e reseta parcela direto pelo frontend sem validação
7. **Falta auditoria** em operações financeiras (pagamento, estorno, exclusão de contrato)
8. **Sem foreign keys** declaradas nas tabelas (embora os dados sejam consistentes)

---

## Plano de Execução (7 blocos incrementais)

### Bloco 1 — Operações Financeiras Transacionais (Backend/SQL)

**Migração SQL**: Criar 4 RPCs SECURITY DEFINER transacionais:

1. **`criar_contrato_com_parcelas`** — recebe todos os parâmetros, cria contrato + parcelas numa única transação. Se qualquer etapa falhar, rollback automático. Registra log de auditoria.

2. **`registrar_pagamento_parcela`** — recebe `parcela_id`, `tipo_pagamento` (total/juros/parcial), `valor`, `data_pagamento`, `observacao`. Valida ownership via RLS chain, calcula novo status, atualiza parcela, insere histórico, verifica quitação do contrato — tudo atômico. Registra auditoria.

3. **`estornar_pagamento_parcela`** — recebe `parcela_id`. Valida ownership, reseta parcela, deleta histórico de pagamentos, reabre contrato se estava quitado. Registra auditoria.

4. **`dashboard_stats`** — RPC que retorna todos os KPIs agregados (totais, lucro, vencimentos, distribuição por status, capital mensal) numa única query, eliminando 4 roundtrips e processamento client-side.

**Impacto**: Nenhum dado alterado. Novas funções, contratos existentes intocados.

### Bloco 2 — Adaptar Frontend para RPCs

**Arquivos alterados**:
- `src/components/contratos/ContratoForm.tsx` — substituir insert+rpc por chamada única a `criar_contrato_com_parcelas`
- `src/components/contratos/ContratoDetails.tsx` — substituir lógica de pagamento inline por `registrar_pagamento_parcela`, estorno por `estornar_pagamento_parcela`
- `src/components/parcelas/PagamentoModal.tsx` — substituir lógica duplicada por chamada à RPC
- `src/pages/Parcelas.tsx` — substituir `handleMarcarPendente` por RPC de estorno
- `src/pages/Dashboard.tsx` — substituir 4 queries por chamada única a `dashboard_stats`

**Impacto**: Elimina duplicação de lógica em 3 pontos. Frontend passa a ser apenas view layer.

### Bloco 3 — Segurança e Configuração

**Arquivos alterados**:
- `src/integrations/supabase/client.ts` — usar `import.meta.env.VITE_SUPABASE_URL` e `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY` em vez de strings hardcoded

**Migração SQL** (incremental, sem destruição):
- Adicionar foreign keys com `IF NOT EXISTS` pattern: `contratos.cliente_id → clientes.id`, `parcelas.contrato_id → contratos.id`, `parcelas_historico.parcela_id → parcelas.id`
- Adicionar índices: `idx_parcelas_contrato_id`, `idx_parcelas_status`, `idx_contratos_cliente_id`, `idx_contratos_status`, `idx_parcelas_historico_parcela_id`

**Impacto**: Nenhum dado alterado. Apenas constraints e índices adicionados sobre dados existentes.

### Bloco 4 — React Query e Gerenciamento de Estado

**Novos arquivos**:
- `src/hooks/queries/useClientes.ts` — query + mutations com invalidação
- `src/hooks/queries/useContratos.ts` — query + mutations
- `src/hooks/queries/useParcelas.ts` — query + mutations
- `src/hooks/queries/useDashboard.ts` — query para dashboard stats

**Arquivos alterados**:
- `src/App.tsx` — configurar QueryClient com staleTime e retry adequados
- `src/pages/Clientes.tsx`, `Contratos.tsx`, `Parcelas.tsx`, `Dashboard.tsx` — substituir useState+useEffect por hooks React Query

**Impacto**: Cache consistente, invalidação automática após mutações, redução de refetch.

### Bloco 5 — Auditoria Expandida

**Migração SQL**: Expandir a RPC `insert_audit_log` para aceitar `entity_type` e `entity_id` opcionais (ADD COLUMN incremental, sem quebrar chamadas existentes).

**Arquivos alterados**:
- RPCs do Bloco 1 já incluem chamadas de auditoria internamente
- `src/pages/Clientes.tsx` — adicionar log em criação, edição e exclusão de cliente (via RPC ou chamada direta ao `insert_audit_log`)

**Impacto**: Logs antigos preservados. Novos campos opcionais (nullable).

### Bloco 6 — Organização de Código

**Novos arquivos**:
- `src/services/contratos.ts` — funções de acesso a dados (wrappers das RPCs)
- `src/services/parcelas.ts` — funções de acesso a dados
- `src/services/clientes.ts` — funções de acesso a dados

**Impacto**: Separação de responsabilidades. Frontend chama services, services chamam Supabase.

### Bloco 7 — Documentação e Testes

**Novos arquivos**:
- `docs/ARCHITECTURE.md` — visão geral, fluxos, convenções, RPCs
- `supabase/functions/tests/finance_test.ts` — testes das RPCs via edge function test runner

---

## Detalhes Técnicos

### RPC `criar_contrato_com_parcelas`
```text
Parâmetros: cliente_id, valor_emprestado, percentual, periodicidade,
            numero_parcelas, data_emprestimo, tipo_juros,
            permite_sabado, permite_domingo

Lógica:
  1. Validar que cliente pertence ao usuário (auth.uid())
  2. Validar is_user_active
  3. Calcular valor_total conforme tipo_juros
  4. INSERT contrato
  5. Chamar gerar_parcelas existente (reutiliza)
  6. INSERT audit_log
  7. RETURN contrato.id
  (tudo dentro de uma única transação PL/pgSQL)
```

### RPC `registrar_pagamento_parcela`
```text
Parâmetros: parcela_id, tipo (total/juros/parcial), valor, data_pagamento, observacao

Lógica:
  1. Validar ownership via JOIN clientes.user_id = auth.uid()
  2. Calcular valor a pagar conforme tipo
  3. INSERT parcelas_historico
  4. UPDATE parcela (valor_pago, status, data_pagamento)
  5. Se status='pago', verificar se todas parcelas do contrato são pagas → atualizar contrato
  6. INSERT audit_log
```

### RPC `dashboard_stats`
```text
Retorna JSON com:
  - total_emprestado, total_receber, total_recebido, lucro
  - clientes_ativos, contratos_ativos, parcelas_vencidas
  - proximos_vencimentos (array top 4)
  - lucro_mensal (array últimos 6 meses)
  - status_distribuicao (contagem por status)
  - capital_mensal (array últimos 6 meses)

Tudo calculado no banco com uma query eficiente.
```

### Status — Consistência

Status atuais na base: `ativo`/`quitado` (contratos), `pago`/`pendente` (parcelas).
O frontend já trata `parcialmente_pago` no código mas não existe na base. A RPC de pagamento definirá corretamente quando usar `parcialmente_pago` vs `pendente` baseado em `valor_pago > 0 AND valor_pago < valor_original`.

### Foreign Keys (adição segura)
```sql
ALTER TABLE contratos ADD CONSTRAINT fk_contratos_cliente
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
-- Não quebra dados existentes pois todos cliente_ids já são válidos
```

---

## Arquivos Impactados (resumo)

| Arquivo | Ação |
|---------|------|
| Migração SQL (novo) | 4 RPCs + FKs + índices + audit_logs expand |
| `src/integrations/supabase/client.ts` | Usar env vars |
| `src/components/contratos/ContratoForm.tsx` | Usar RPC transacional |
| `src/components/contratos/ContratoDetails.tsx` | Usar RPCs pagamento/estorno |
| `src/components/parcelas/PagamentoModal.tsx` | Usar RPC pagamento |
| `src/pages/Parcelas.tsx` | Usar RPC estorno, React Query |
| `src/pages/Dashboard.tsx` | Usar RPC dashboard_stats |
| `src/pages/Clientes.tsx` | React Query, auditoria |
| `src/pages/Contratos.tsx` | React Query |
| `src/App.tsx` | QueryClient config |
| `src/services/*.ts` (novos) | Service layer |
| `src/hooks/queries/*.ts` (novos) | React Query hooks |
| `docs/ARCHITECTURE.md` (novo) | Documentação |

## Riscos e Mitigações

- **Foreign keys**: verificar integridade antes de adicionar. Query de validação incluída na migração.
- **RPCs**: novas funções, não substituem as antigas imediatamente. Frontend migra gradualmente.
- **Dados existentes**: nenhuma coluna removida, nenhum dado deletado, nenhuma tabela recriada.
- **Rollback**: todas as migrações são aditivas (ADD COLUMN, ADD CONSTRAINT, CREATE FUNCTION).

## Ordem de Execução

1. Migração SQL (RPCs + FKs + índices) — sem impacto no frontend atual
2. Client.ts (env vars) — mudança mínima
3. Services + React Query hooks — novos arquivos
4. Páginas adaptadas — usar novos hooks e RPCs
5. Documentação

