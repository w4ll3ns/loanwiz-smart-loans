## Objetivo

Estabelecer guardrails para que migrations futuras nunca contenham dados pessoais (UUIDs, emails, telefones), e fornecer mecanismo seguro para promover usuários a admin sem hardcode.

A migration antiga (`20251204230240_*.sql`) permanece intocada — já foi aplicada e está no histórico público do Git. O foco é prevenção daqui em diante.

## Mudanças

### 1. Nova migration: `[timestamp]_add_seed_admin_documentation.sql`

Sem dados sensíveis. Apenas:

- `COMMENT ON TABLE public.user_roles` documentando que admins iniciais devem ser promovidos manualmente via SQL Editor ou via RPC `admin_promote_user`, e que UUIDs/emails nunca devem aparecer em migrations.
- Cria a RPC `admin_promote_user(p_user_id uuid)`:
  - `SECURITY DEFINER`, `SET search_path = public`
  - Valida `auth.uid() IS NOT NULL`
  - Valida `has_role(auth.uid(), 'admin')` — só admins existentes podem promover
  - Valida que o `p_user_id` existe em `profiles`
  - `INSERT INTO user_roles (user_id, role) VALUES (p_user_id, 'admin') ON CONFLICT (user_id, role) DO NOTHING`
  - Chama `insert_audit_log('promote_admin', p_user_id, ...)` para rastreabilidade
  - `REVOKE ALL ... FROM PUBLIC` + `GRANT EXECUTE ... TO authenticated`

Observação técnica: a tabela `user_roles` precisa de um `UNIQUE (user_id, role)` para o `ON CONFLICT` funcionar. Se a constraint já não existir, a migration adiciona via `ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS` (ou bloco `DO` checando `pg_constraint`).

### 2. Atualização em `docs/ARCHITECTURE.md`

Na seção **"Governança de Migrations" → "Regras"**, adicionar item novo:

> 8. **Nunca incluir dados pessoais em migrations** — UUIDs de usuários, emails, telefones, nomes ou qualquer PII são proibidos. Para promover um usuário a admin, usar a RPC `admin_promote_user(p_user_id)` via SQL Editor no dashboard do Supabase, ou inserir manualmente em `user_roles`. Nunca commitar identificadores reais no repositório.

E adicionar `admin_promote_user` à tabela de RPCs disponíveis na mesma página.

### 3. O que NÃO será feito

- Não reescrever histórico Git (sem rebase/force push).
- Não deletar nem alterar a migration antiga `20251204230240_*.sql`.
- Não revogar/alterar o role admin existente do usuário.

## Critério de aceite

- Nova migration criada sem nenhum UUID/email/telefone.
- RPC `admin_promote_user` disponível e gated por `has_role(..., 'admin')`.
- `docs/ARCHITECTURE.md` com a regra explícita anti-PII em migrations.
- Build OK, schema atualizado.

Aprovar para eu implementar.