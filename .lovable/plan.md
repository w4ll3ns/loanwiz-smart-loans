## Centralizar autenticação no ProtectedRoute

### Objetivo
Eliminar flash de conteúdo em rotas autenticadas e centralizar a lógica de auth/redirect no `ProtectedRoute`, removendo a responsabilidade do `Layout`.

### Arquivos alterados

**1. `src/components/ProtectedRoute.tsx`**
- Adicionar prop `withLayout?: boolean` (default `true`).
- Importar `Layout`.
- Quando autenticado e `withLayout` for true, renderizar `<Layout>{children}</Layout>`; caso contrário, apenas `{children}`.
- Manter lógica atual: skeleton enquanto carrega, redirect `/auth` se sem role, redirect `/` se `requireAdmin && !isAdmin`.

**2. `src/App.tsx`**
- Substituir os wrappers `<Layout>...</Layout>` das rotas `/`, `/clientes`, `/contratos`, `/parcelas`, `/perfil` por `<ProtectedRoute>...</ProtectedRoute>`.
- Manter `/admin` com `<ProtectedRoute requireAdmin>`.
- Remover import de `Layout` se não for mais usado em App.tsx.

**3. `src/components/Layout.tsx`**
- Remover o `useEffect` que assina `onAuthStateChange`/`getSession` e redireciona para `/auth`.
- Remover o early-return `if (!user) return null` (auth já garantido pelo ProtectedRoute).
- Manter apenas: `getUser`/exibição de email, `updateUltimoAcesso`, `handleLogout`, navegação e UI.
- Carregar `user` via `supabase.auth.getUser()` em um `useEffect` simples (apenas para exibir email/nome no header).

**4. `src/pages/Admin.tsx`**
- Remover `import Layout from '@/components/Layout'`.
- Remover os wrappers `<Layout>...</Layout>` (loading state e return principal).
- Remover o `useEffect` que redireciona quando não-admin (ProtectedRoute já cuida).
- Manter o restante da lógica intacta.

### Critério de aceite
- Acessar qualquer rota deslogado redireciona direto para `/auth` sem flash de conteúdo.
- Admin acessa `/admin` normalmente com Layout renderizado.
- Auth centralizada em `ProtectedRoute`; `Layout` só lida com chrome/navegação.