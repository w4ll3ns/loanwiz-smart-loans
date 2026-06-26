# Header com menu de avatar, foto de perfil e busca global (⌘K)

Tudo concentrado em `src/components/Layout.tsx`, mais a tela `/perfil`, uma migration e um bucket de storage. Sem mexer em rotas, nav inferior, dados ou cálculos. Tema claro/escuro usando tokens (sem cor fixa) e safe-area preservada.

## Parte A — Header + menu do avatar (`src/components/Layout.tsx`)

Lado direito do header (desktop e mobile) fica enxuto:
- **Desktop:** botão-campo de busca (Parte C) · `NotificacoesVencimento` · avatar.
- **Mobile:** lupa (Parte C) · `NotificacoesVencimento` · avatar (todos compactos).

Remover do header: `ThemeToggle`, botão do `InstallAppGuide`, botão de `LogOut` e o `Link /perfil` com o e-mail cru. À esquerda mantém logo + "WS Empréstimos" + badge "Admin" (quando `isAdmin`).

**Avatar:**
- `<Avatar>` com `AvatarImage` (avatar_url do profile) e `AvatarFallback` com iniciais.
- Helper `getIniciais(nome, email)` conforme especificado.
- Buscar `nome, avatar_url` de `profiles` do usuário logado (reaproveitar `useUserRole().profile` quando possível; `avatar_url` é adicionado na Parte B).

**Conteúdo do menu (idêntico nos dois modos):**
1. Cabeçalho: avatar maior + nome + e-mail (truncado) + badge "Admin" se for o caso.
2. **Meu perfil** → `Link to="/perfil"`.
3. **Instalar app** → aciona o diálogo do `InstallAppGuide` (refatorar para expor o diálogo controlado por estado; só aparece quando `showInstallButton`).
4. **Tema** → opções Claro/Escuro com `setTheme("light")`/`setTheme("dark")`, destacando a atual via `theme`.
5. Separador.
6. **Sair** (destrutivo) → abre `AlertDialog` "Deseja sair da conta?"; ao confirmar chama o `handleLogout` existente.

**Apresentação:**
- Desktop: `DropdownMenu` ancorado no avatar, alinhado à direita.
- Mobile: `Sheet` (`side="bottom"`) com itens de toque ≥44px e `env(safe-area-inset-bottom)` no rodapé.
- Não alterar alturas/estrutura dos headers nem o `env(safe-area-inset-top)` já aplicado.

## Parte B — Foto de perfil

- **Migration (tool de migração):** adicionar coluna `avatar_url text` (nullable) em `profiles`. Atualizar `update_own_profile` não é necessário — o upload salvará direto, mas como há restrição de update no profile, a foto será gravada via RPC: estender `update_own_profile` para aceitar `p_avatar_url text default null` e atualizar `avatar_url = COALESCE(p_avatar_url, avatar_url)` (mantém o restante intacto).
- **Storage:** criar bucket público `avatars`. Policies em `storage.objects`: leitura pública do bucket; insert/update/delete restritos ao próprio usuário (path por `auth.uid()`).
- **Tela `/perfil`:** card de foto com `<Avatar>` (preview), botão "Enviar foto" (input file), validação tipo imagem e tamanho ≤2MB, upload para `avatars/<user.id>/...`, salvar URL pública via `update_own_profile(p_avatar_url)`, e botão "Remover foto" (limpa `avatar_url`). Invalida a query `['user-role']` para refletir no header.

## Parte C — Busca global (⌘K)

- Listener global de teclado (`⌘K`/`Ctrl+K`) que abre/fecha o `CommandDialog`.
- Desktop: botão estilizado como campo ("Buscar cliente, contrato…" + atalho ⌘K). Mobile: ícone de lupa no header-right.
- Input com debounce (~250ms). Buscas em paralelo no Supabase:
  - `clientes` por nome (e telefone), limit 5.
  - `contratos` com join `clientes(nome)` filtrando por nome, limit 5.
  - `parcelas` em aberto (`pendente`/`parcialmente_pago`) com join `contratos(clientes(nome))`, limit 5.
- Resultados em `CommandGroup` ("Clientes", "Contratos", "Parcelas"), com estados "Carregando…" e "Nenhum resultado".
- Ao selecionar, fechar o dialog e navegar com o filtro:
  - Cliente → `/clientes?q=<nome>`.
  - Contrato → `/contratos?open=<id>` (já suportado) ou `?q=<nome>`.
  - Parcela → `/parcelas?q=<nome>`.
- Adicionar leitura de `?q=` em `Clientes.tsx` e `Parcelas.tsx` para pré-preencher `searchTerm` (Contratos ganha leitura de `?q=` também, além do `open` já existente).

## Detalhes técnicos

- Refactor de `InstallAppGuide`: separar o conteúdo do diálogo (`InstallAppDialog` controlado por `open/onOpenChange`) para ser acionado a partir do item de menu, mantendo o gate `showInstallButton`.
- `useTheme` já expõe `{ theme, setTheme }`; usar diretamente.
- Componentes shadcn reutilizados: `avatar`, `dropdown-menu`, `sheet`, `alert-dialog`, `command`.
- Tudo com tokens de tema (sem `text-white`/cores fixas).

## Arquivos afetados

- `src/components/Layout.tsx` (header, avatar menu, busca global, atalho)
- `src/components/InstallAppGuide.tsx` (expor diálogo controlado)
- `src/pages/Perfil.tsx` (upload de foto)
- `src/pages/Clientes.tsx`, `src/pages/Parcelas.tsx`, `src/pages/Contratos.tsx` (ler `?q=`)
- Migration: coluna `avatar_url` + ajuste em `update_own_profile`
- Storage: bucket `avatars` + policies

## Critérios de aceitação

- Header enxuto (sino + avatar, lupa no mobile); itens soltos removidos.
- Menu do avatar com cabeçalho, Meu perfil, Instalar app, seletor de tema, Sair com confirmação.
- Perfil acessível no mobile pelo menu.
- Avatar mostra foto quando `avatar_url` existir; senão iniciais.
- Upload de foto funciona e reflete no header.
- ⌘K e gatilhos abrem o `CommandDialog`; busca agrupada com debounce; seleção navega e filtra.
- Tema usa `setTheme` e reflete o atual; logout atrás de confirmação. Nada de rotas/nav/dados/cálculos alterado.
