

# Rodada 2 — Correções Estruturais Pendentes

## Análise: O Que Já Está Feito vs Pendente

A Rodada 1 entregou as RPCs transacionais e o service layer. O frontend já usa as RPCs corretamente. O `client.ts` já usa `import.meta.env`. Portanto, o foco desta rodada é nos pontos que ficaram incompletos.

## Bloco 1 — Segurança de Ambiente

### 1.1 `.gitignore`
Adicionar `.env`, `.env.*`, `.env.local` ao `.gitignore`. O `.env` já existe no repositório (é auto-populado pela plataforma), mas o `.gitignore` precisa proteger contra versionamento acidental de `.env.local` ou variantes com secrets reais.

**Arquivo**: `.gitignore` — adicionar linhas de proteção.

## Bloco 2 — Corrigir Estado Inseguro no ContratoForm

### Problema
Linha 143 do `ContratoForm.tsx` faz `setState` durante render:
```
if (initialData && formData.clienteId !== initialData.clienteId) {
  setFormData({ ...defaultFormData, ...initialData });
}
```
Isso causa re-renders imprevisíveis e pode corromper o estado do formulário.

### Correção
Substituir por um `useEffect` com dependência em `initialData`, ou melhor, usar uma `key` no componente pai para forçar remontagem quando `initialData` muda. Na prática, mover a lógica para `useEffect` com guard correto.

**Arquivo**: `src/components/contratos/ContratoForm.tsx`

## Bloco 3 — Endurecer Edge Function `delete-user`

### Problemas Atuais
1. `verify_jwt = false` no config.toml — qualquer request chega à função
2. Deleções sequenciais sem proteção contra falha parcial
3. Sem registro de auditoria
4. Deleta `clientes` mas não deleta `contratos`, `parcelas`, `parcelas_historico` explicitamente (depende de cascatas que podem não existir em todas as tabelas)

### Correções
1. Mudar `verify_jwt = true` no `config.toml`
2. Adicionar registro de auditoria via `insert_audit_log` antes da exclusão
3. Adicionar validação de UUID no `user_id`
4. Melhorar ordem de deleção: deletar na ordem correta (historico → parcelas → contratos → clientes → roles → profiles → auth)
5. Se qualquer etapa intermediária falhar, retornar erro claro com contexto do que foi e não foi deletado
6. Usar Zod para validação de input

**Arquivos**: `supabase/functions/delete-user/index.ts`, `supabase/config.toml`

## Bloco 4 — Endurecer Edge Function `parse-comprovante`

### Correções
1. **Payload size limit**: rejeitar `image_base64` > 5MB (base64)
2. **Rate limit simples**: consultar `parcelas_historico` ou criar contador em memória (dado que é edge function stateless, usar uma tabela `api_usage` ou simplesmente um check no banco — consultar quantas chamadas o usuário fez nas últimas 24h)
3. **MIME type validation**: aceitar apenas `image/png`, `image/jpeg`, `image/webp`
4. **Timeout no fetch**: usar `AbortController` com 30s timeout na chamada à OpenAI
5. **Validação da saída**: verificar que `nome_cliente` é string, `valor` é number > 0, `data` é formato YYYY-MM-DD

**Arquivo**: `supabase/functions/parse-comprovante/index.ts`

**Migração SQL**: criar tabela `api_usage_log` para tracking de consumo (incremental, sem afetar dados existentes).

## Bloco 5 — Documentação Técnica Atualizada

Atualizar `docs/ARCHITECTURE.md` com:
- Seção de variáveis de ambiente necessárias
- Seção de governança de migrations (schema vs data fix)
- Seção de cuidados de deploy
- Seção de Edge Functions com suas proteções

**Arquivo**: `docs/ARCHITECTURE.md`

## Bloco 6 — Migração SQL (rate limit table)

Criar tabela `api_usage_log`:
```sql
CREATE TABLE IF NOT EXISTS api_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  function_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_usage_user_function ON api_usage_log(user_id, function_name, created_at);
ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;
-- Apenas inserção via SECURITY DEFINER, sem acesso direto
```

---

## Resumo de Arquivos Impactados

| Arquivo | Ação |
|---------|------|
| `.gitignore` | Adicionar proteções para `.env*` |
| `src/components/contratos/ContratoForm.tsx` | Corrigir setState durante render |
| `supabase/functions/delete-user/index.ts` | Auditoria, ordem de deleção, validação |
| `supabase/functions/parse-comprovante/index.ts` | Rate limit, payload limit, timeout, validação |
| `supabase/config.toml` | `verify_jwt = true` para delete-user |
| `docs/ARCHITECTURE.md` | Expandir com env vars, deploy, migrations |
| Migração SQL (nova) | Tabela `api_usage_log` |

## Riscos e Mitigações

- **delete-user com verify_jwt=true**: A chamada do frontend já envia o token via `supabase.functions.invoke()`, então a mudança é compatível.
- **ContratoForm useEffect**: Comportamento idêntico ao atual, apenas estruturalmente correto.
- **api_usage_log**: Tabela nova, sem impacto em dados existentes.
- **Nenhum dado existente é alterado ou deletado.**

## Checklist de Entrega

- [ ] `.gitignore` protege `.env*`
- [ ] ContratoForm sem setState durante render
- [ ] delete-user com verify_jwt, auditoria e ordem correta
- [ ] parse-comprovante com rate limit, payload limit e timeout
- [ ] Documentação expandida
- [ ] Migration limpa e incremental

