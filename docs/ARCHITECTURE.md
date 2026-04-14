# LoanWiz Smart Loans — Arquitetura Técnica

## Visão Geral

Sistema SaaS multi-tenant para gestão de empréstimos pessoais. Construído com React 18 + Vite + Tailwind CSS no frontend e Supabase (PostgreSQL + Auth + Edge Functions) no backend.

## Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Query
- **Backend**: Supabase (PostgreSQL 15), Row Level Security, PL/pgSQL RPCs
- **Auth**: Supabase Auth (email/password)
- **Deploy**: Lovable Cloud

## Variáveis de Ambiente

### Frontend (auto-populadas pela plataforma)
```
VITE_SUPABASE_URL          — URL do projeto Supabase
VITE_SUPABASE_PUBLISHABLE_KEY — Chave pública (anon key)
VITE_SUPABASE_PROJECT_ID   — ID do projeto Supabase
```

O arquivo `.env` é auto-gerado pela plataforma. **Nunca** versionar `.env.local` ou variantes com secrets reais.

### Edge Functions (disponíveis automaticamente no Supabase)
```
SUPABASE_URL               — URL do projeto
SUPABASE_ANON_KEY          — Chave anon
SUPABASE_SERVICE_ROLE_KEY  — Chave service_role (privada, nunca expor)
OPENAI_API_KEY             — API key da OpenAI (configurada nos secrets do Supabase)
```

### Segurança de Credenciais
- O `client.ts` usa exclusivamente `import.meta.env.VITE_*`
- Nenhuma credencial é hardcoded no código
- `.gitignore` protege `.env.local`, `.env.*.local` contra versionamento acidental
- Chaves privadas (service_role, OpenAI) ficam apenas nos secrets do Supabase

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
| `log_api_usage` | SECURITY DEFINER | Registra uso de API para rate limiting |
| `check_api_rate_limit` | SECURITY DEFINER | Verifica limite de uso (50 chamadas/24h) |

## Edge Functions

### `parse-comprovante`
Extrai dados de comprovantes PIX via GPT-4o.

**Proteções:**
- `verify_jwt = true` no config.toml
- Validação JWT via `getClaims()`
- Rate limit: 50 chamadas/24h por usuário (via `api_usage_log`)
- Payload limit: 5MB máximo
- MIME types aceitos: PNG, JPEG, WebP
- Timeout: 30s na chamada à OpenAI
- Validação de saída: nome (string), valor (number > 0), data (YYYY-MM-DD)

### `delete-user`
Exclusão completa de usuário pelo admin.

**Proteções:**
- `verify_jwt = true` no config.toml
- Validação JWT + verificação de role admin
- Validação de UUID no input
- Prevenção de auto-exclusão
- Auditoria registrada ANTES da exclusão
- Ordem de deleção referencial: historico → parcelas → contratos → clientes → roles → profiles → auth
- Report de progresso em caso de falha parcial

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

## Governança de Migrations

### Tipos de Alteração

| Tipo | Onde | Exemplo |
|------|------|---------|
| **Schema migration** | `supabase/migrations/` | CREATE TABLE, ALTER TABLE, CREATE FUNCTION |
| **Data fix operacional** | Script avulso ou RPC admin | UPDATE específico de registro, correção pontual |

### Regras

1. **Migrations são apenas para schema** — estrutura de tabelas, funções, índices, políticas RLS
2. **Nunca incluir INSERT/UPDATE/DELETE de dados operacionais** em migrations
3. **Correções pontuais de dados** devem ser feitas via SQL Editor no dashboard ou via RPCs administrativas
4. **Toda migration deve ser incremental** — ADD COLUMN, CREATE IF NOT EXISTS, nunca DROP destrutivo
5. **Usar `IF NOT EXISTS`** para constraints, índices e tabelas quando possível
6. **Foreign keys com `ON DELETE CASCADE`** quando fizer sentido para integridade referencial
7. **Sempre testar em ambiente de desenvolvimento** antes de aplicar em produção

### Rollback

- Migrations são aditivas — rollback consiste em nova migration que desfaz a anterior
- Nunca remover colunas sem período de transição
- Dados existentes devem ser preservados em qualquer cenário

## Cuidados de Deploy

1. **Migrations rodam automaticamente** ao fazer deploy pela Lovable
2. **Edge Functions são deployadas automaticamente** — verificar logs após deploy
3. **Verificar secrets** no dashboard do Supabase antes do deploy (OPENAI_API_KEY, etc.)
4. **Testar RLS** após alterações em políticas — usar SQL Editor com `SET ROLE`
5. **Monitorar** edge function logs após alterações
6. **Nunca** fazer DROP TABLE ou DROP COLUMN sem backup e período de transição

## Segurança

- RLS ativo em todas as tabelas
- Funções administrativas protegidas com `has_role(auth.uid(), 'admin')`
- `is_user_active()` valida assinatura antes de INSERT em tabelas críticas
- Edge Functions requerem JWT válido (`verify_jwt = true`)
- Rate limiting via `api_usage_log` para funções custosas
- Credenciais via variáveis de ambiente, nunca hardcoded
- Auditoria de ações administrativas via `audit_logs`
