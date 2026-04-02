

## Plano: Corrigir políticas RLS do profiles para permitir operações de Admin

### Problema
A migração de segurança anterior criou uma política "Users can update own profile limited" que impede alterações nos campos `ativo`, `status_plano`, `data_expiracao_teste` e `observacoes_admin`. Isso é correto para usuários comuns, mas bloqueia admins de gerenciar usuários no painel Admin (`src/pages/Admin.tsx`).

Campos afetados no Admin:
- `toggleUserStatus` → atualiza `ativo`
- `handleSaveObservacoes` → atualiza `observacoes_admin`  
- `handleSavePlano` → atualiza `status_plano`

### Solução

**1. Migração SQL** — Adicionar política de UPDATE para admins:

```sql
-- Allow admins to update any profile field
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

Isso usa a função `has_role` que já existe no sistema.

**2. Nenhuma alteração no frontend** — O código do Admin.tsx já faz as queries corretas; só precisa da permissão no banco.

### Sobre o erro de publicação
O erro "sandbox head mismatch" é temporário e da infraestrutura do Lovable. Basta tentar publicar novamente após alguns minutos.

