# LoanWiz Smart Loans — Arquitetura Técnica

## Visão Geral

Sistema SaaS multi-tenant para gestão de empréstimos pessoais. Construído com React 18 + Vite + Tailwind CSS no frontend e Supabase (PostgreSQL + Auth + Edge Functions) no backend.

## Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Query
- **Backend**: Supabase (PostgreSQL 15), Row Level Security, PL/pgSQL RPCs
- **Auth**: Supabase Auth (email/password)
- **Deploy**: Lovable Cloud

## Isolamento Multi-Tenant

Cada usuário vê apenas seus dados. O isolamento é garantido por RLS:

- `clientes.user_id = auth.uid()` — filtro direto
- `contratos` — filtro via JOIN com `clientes`
- `parcelas` — filtro via JOIN com `contratos → clientes`
- `parcelas_historico` — filtro via JOIN com `parcelas → contratos → clientes`

Administradores usam funções `SECURITY DEFINER` dedicadas (prefixo `admin_*`) para acessar dados cross-tenant.

## Fluxos Principais

### Criação de Contrato
1. Frontend chama RPC `criar_contrato_com_parcelas` com todos os parâmetros
2. RPC valida ownership do cliente, status do usuário, e inputs
3. Calcula valor total conforme tipo de juros (simples/parcela/composto)
4. Insere contrato + gera parcelas numa **única transação atômica**
5. Se qualquer etapa falhar, rollback automático

### Pagamento de Parcela
1. Frontend chama RPC `registrar_pagamento_parcela` com parcela_id, tipo (total/juros/parcial), valor e data
2. RPC valida ownership, calcula novo status
3. Insere histórico em `parcelas_historico`
4. Atualiza parcela (valor_pago, status, data_pagamento)
5. Se todas parcelas do contrato ficam pagas → marca contrato como `quitado`
6. Tudo atômico

### Estorno de Pagamento
1. Frontend chama RPC `estornar_pagamento_parcela`
2. RPC deleta histórico de pagamentos da parcela
3. Reseta parcela para `pendente`
4. Se contrato estava `quitado`, reabre para `ativo`

### Dashboard
1. Frontend chama RPC `dashboard_stats` — **uma única query**
2. RPC retorna JSON com todos os KPIs agregados no banco
3. Frontend apenas renderiza os dados

## RPCs Disponíveis

| Função | Tipo | Descrição |
|--------|------|-----------|
| `criar_contrato_com_parcelas` | SECURITY DEFINER | Criação atômica de contrato + parcelas |
| `registrar_pagamento_parcela` | SECURITY DEFINER | Pagamento atômico com verificação de quitação |
| `estornar_pagamento_parcela` | SECURITY DEFINER | Estorno seguro com reabertura de contrato |
| `dashboard_stats` | SECURITY DEFINER | KPIs agregados numa única consulta |
| `recalcular_contrato_parcelas` | SECURITY DEFINER | Recálculo de juros/parcelas pendentes |
| `gerar_parcelas` | SECURITY DEFINER | Geração de parcelas (usado internamente) |
| `is_user_active` | SECURITY DEFINER | Verifica se usuário está ativo/assinante |
| `has_role` | SECURITY DEFINER | Verifica role do usuário |

## Status

### Contratos
- `ativo` — contrato em andamento
- `quitado` — todas as parcelas pagas

### Parcelas
- `pendente` — aguardando pagamento
- `pago` — quitada integralmente

## Estrutura de Diretórios

```
src/
├── components/          # Componentes React
│   ├── contratos/       # ContratoForm, ContratoDetails, RelatorioGenerator
│   ├── parcelas/        # PagamentoModal, HistoricoModal, EditarDataModal
│   └── ui/              # shadcn/ui components
├── hooks/               # Custom hooks
├── integrations/supabase/ # Client e tipos gerados
├── lib/                 # Utilitários (cálculos, formatação)
├── pages/               # Páginas principais
└── services/            # Camada de acesso a dados (wrappers de RPCs)
```

## Ambiente

Variáveis obrigatórias no `.env`:
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

**Nunca** hardcode credenciais no código. O `client.ts` usa `import.meta.env`.

## Migrations

Todas as migrations são aditivas e reversíveis:
- Nunca remover colunas sem estratégia de transição
- Sempre usar `IF NOT EXISTS` para constraints e índices
- Foreign keys com `ON DELETE CASCADE` para integridade referencial

## Segurança

- RLS ativo em todas as tabelas
- Funções administrativas protegidas com `has_role(auth.uid(), 'admin')`
- `is_user_active()` valida assinatura antes de INSERT em tabelas críticas
- Edge Functions requerem JWT válido
- Credenciais via variáveis de ambiente, nunca hardcoded
