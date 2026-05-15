## Atomizar updates administrativos com RPCs

### Migration (nova)

Criar 3 funções `SECURITY DEFINER` em `public`, todas validando `has_role(auth.uid(), 'admin')` e inserindo em `audit_logs` na mesma transação do UPDATE. Erro em qualquer ponto causa rollback automático.

**`admin_toggle_user_status(p_user_id uuid, p_ativo boolean) returns void`**
- Valida admin e existência do profile.
- `UPDATE profiles SET ativo = p_ativo, updated_at = now() WHERE id = p_user_id`. Se `NOT FOUND`, `RAISE EXCEPTION`.
- `INSERT INTO audit_logs(user_id, action, target_user_id, details) VALUES (auth.uid(), 'toggle_user', p_user_id, jsonb_build_object('ativo', p_ativo))`.

**`admin_update_user_plano(p_user_id uuid, p_plano text, p_data_expiracao date DEFAULT NULL) returns void`**
- Valida admin.
- Valida `p_plano IN ('teste','ativo','expirado','cancelado')` (`RAISE EXCEPTION 'Invalid plan'`).
- `UPDATE profiles SET status_plano = p_plano, data_expiracao_teste = COALESCE(p_data_expiracao, data_expiracao_teste), updated_at = now() WHERE id = p_user_id`. `NOT FOUND` → exception.
- Audit log com action `change_plan` e details `{ plano, data_expiracao }`.

**`admin_update_user_observacoes(p_user_id uuid, p_observacoes text) returns void`**
- Valida admin.
- `UPDATE profiles SET observacoes_admin = NULLIF(p_observacoes, ''), updated_at = now() WHERE id = p_user_id`. `NOT FOUND` → exception.
- Audit log com action `update_observacoes` e details `{ has_text: (p_observacoes IS NOT NULL AND length(p_observacoes) > 0) }` (evita logar texto livre).

**Permissões (padrão do projeto):**
```sql
REVOKE ALL ON FUNCTION public.admin_toggle_user_status(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_toggle_user_status(uuid, boolean) TO authenticated;
-- repetir para as outras 2
```

### Frontend (`src/pages/Admin.tsx`)

- `toggleUserStatus`: substituir o UPDATE direto e o `logAuditAction` por:
  `await supabase.rpc('admin_toggle_user_status', { p_user_id: userId, p_ativo: !currentStatus })`.
- `handleSaveObservacoes`: substituir por
  `await supabase.rpc('admin_update_user_observacoes', { p_user_id: selectedUser.id, p_observacoes: observacoesText })`. Remover update local manual? Manter o `setProfiles` otimista para UX.
- `handleSavePlano`: substituir por
  `await supabase.rpc('admin_update_user_plano', { p_user_id: selectedUser.id, p_plano: selectedPlano })` (sem `p_data_expiracao` por enquanto). Remover chamada manual a `logAuditAction`.
- Manter os `setProfiles(...)` locais para refletir UI imediata; em caso de erro RPC, o catch atual já mostra toast.
- Não tocar nas outras chamadas (`reset_password`, `delete_user`, `promote_admin` continuam como estão).

### Critério de aceite
- Cada ação administrativa (toggle, plano, observações) gera exatamente 1 entrada em `audit_logs`.
- Se a RPC falhar (validação, profile inexistente, etc.), nem o UPDATE nem o log são gravados (mesma transação).
- Não-admins recebem `RAISE EXCEPTION 'Not authorized'`.