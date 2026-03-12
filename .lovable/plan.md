

## Plano: Melhorias gerais de UX - Login, Loading, Timezone e Mobile

### 1. Login com logo e "Esqueci minha senha" (`src/pages/Auth.tsx`)

- Adicionar logo (`src/assets/logo.png`) acima do card de login
- Adicionar link "Esqueci minha senha" abaixo do campo de senha no form de login
- Criar funcionalidade de reset: ao clicar, exibir um form alternativo que pede apenas o email e chama `supabase.auth.resetPasswordForEmail()` com `redirectTo` para `/reset-password`
- Criar nova pagina `src/pages/ResetPassword.tsx` que escuta o evento `PASSWORD_RECOVERY` e exibe form para nova senha, chamando `supabase.auth.updateUser({ password })`
- Registrar rota `/reset-password` no `App.tsx`

### 2. Loading skeletons e empty states

Criar componente reutilizavel `src/components/LoadingSkeletons.tsx` com variantes:
- `DashboardSkeleton`: 5 cards skeleton + lista skeleton
- `TableSkeleton`: linhas de tabela skeleton
- `CardListSkeleton`: cards skeleton para views mobile

Adicionar estado `loading` em cada pagina:
- **Dashboard.tsx**: estado `loading` inicializado como `true`, setar `false` apos carregar dados. Enquanto `true`, mostrar `DashboardSkeleton`
- **Parcelas.tsx**: ja tem `loadingParcelas` -- usar para mostrar skeleton na listagem
- **Contratos.tsx**: adicionar estado `loading` similar
- **Clientes.tsx**: adicionar estado `loading` similar

Melhorar empty states com icone + texto descritivo em vez de apenas "Nenhum encontrado"

### 3. Corrigir bug de timezone (`toISOString().split('T')[0]`)

Substituir todas as ocorrencias de `new Date().toISOString().split('T')[0]` por `getLocalDateString()`:

**Parcelas.tsx** (2 ocorrencias):
- Linha 236: `setDataPagamento(getLocalDateString())`
- Linha 1081: `max={getLocalDateString()}`

**Contratos.tsx** (5 ocorrencias):
- Linha 293: `dataParcela.toISOString().split('T')[0]` -- substituir por helper local que formata a data sem UTC
- Linha 363: `new Date().toISOString().split('T')[0]` -- usar `getLocalDateString()`
- Linha 394: `new Date().toISOString().split('T')[0]` -- usar `getLocalDateString()`
- Linha 1278: `new Date().toISOString().split('T')[0]` -- usar `getLocalDateString()`
- Linha 1871: `max={new Date().toISOString().split('T')[0]}` -- usar `getLocalDateString()`

Copiar a funcao `getLocalDateString` para Contratos.tsx (ou extrair para `src/lib/utils.ts`)

### 4. Melhorar fontes e botoes mobile

**Parcelas.tsx** - Cards mobile:
- Aumentar fontes de `text-[10px]` para `text-xs` (12px)
- Aumentar fontes de `text-[11px]` para `text-sm` (14px)
- Aumentar altura dos botoes de `h-7` para `h-9` (36px -- minimo recomendado para touch)
- Aumentar fonte dos botoes de `text-[10px]` para `text-xs`
- Aumentar icones de `h-3 w-3` para `h-3.5 w-3.5`

### Arquivos modificados

| Arquivo | Acao |
|---|---|
| `src/pages/Auth.tsx` | Logo, "Esqueci minha senha", form de reset |
| `src/pages/ResetPassword.tsx` | Nova pagina para redefinir senha |
| `src/App.tsx` | Rota `/reset-password` |
| `src/components/LoadingSkeletons.tsx` | Componente reutilizavel de skeletons |
| `src/pages/Dashboard.tsx` | Loading state + skeleton |
| `src/pages/Parcelas.tsx` | Loading skeleton, fix timezone, fontes/botoes maiores |
| `src/pages/Contratos.tsx` | Loading skeleton, fix timezone |
| `src/pages/Clientes.tsx` | Loading skeleton |
| `src/lib/utils.ts` | Extrair `getLocalDateString` como funcao compartilhada |

