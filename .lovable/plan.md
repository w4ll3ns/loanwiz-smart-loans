

# Auditoria Completa do Sistema WS Emprestimos

## 1. SEGURANCA

### 1.1 Criticos (Corrigir Imediatamente)

**A. `verify_jwt = false` no config.toml**
O arquivo `supabase/config.toml` mantém `verify_jwt = false` para a edge function `parse-comprovante`. Embora haja validação JWT no código, a camada de segurança do Supabase está desligada. Qualquer falha no código permite acesso anônimo.
- **Ação**: Alterar para `verify_jwt = true` no `config.toml`.

**B. Leaked Password Protection desabilitada**
O scanner Supabase reporta que a proteção contra senhas vazadas está desativada.
- **Ação**: Habilitar em Authentication > Settings no painel Supabase.

**C. CSS ocultando badge Lovable via injection**
A linha final do `index.css` esconde elementos do Lovable via CSS. Isso viola os termos de serviço e pode causar problemas na publicação.
- **Ação**: Remover a regra CSS ou usar `set_badge_visibility` (requer plano Pro+).

### 1.2 Medio

**D. Contratos.tsx: 2284 linhas em um único arquivo**
Componente monolítico com lógica de criação, edição, pagamento, importação de comprovante, geração de PDF/imagem — tudo em um só arquivo. Dificulta manutenção e aumenta risco de bugs.

**E. Deleção de usuário incompleta no Admin**
`handleDeleteUser` exclui clientes, roles e profiles, mas não remove o usuário do `auth.users`. O registro de autenticação permanece, e o usuário pode continuar logando.
- **Ação**: Criar uma edge function com `service_role` para deletar via `supabase.auth.admin.deleteUser()`.

**F. Parcelas_historico sem política UPDATE explícita**
O scanner alerta que não há política UPDATE. Embora isso bloqueie updates por padrão, uma política explícita de negação é melhor prática.

### 1.3 Baixo

**G. Profiles sem INSERT policy**
Intencional (trigger `handle_new_user` cria profiles via `SECURITY DEFINER`), mas vale documentar.

---

## 2. USABILIDADE

### 2.1 Problemas Encontrados

**A. Sem proteção de rota para Admin**
A rota `/admin` não usa o `Layout` wrapper. Qualquer usuário pode acessar a URL diretamente — o redirect só acontece no `useEffect`, gerando flash de conteúdo.
- **Ação**: Criar um componente `ProtectedRoute` que valida role antes de renderizar.

**B. Sem feedback de loading global**
Dashboard, Clientes e Parcelas têm skeletons, mas Contratos não tem skeleton — mostra página vazia enquanto carrega.

**C. Sem paginação**
Todas as listagens (clientes, contratos, parcelas) carregam todos os dados. Com centenas de registros, a performance vai degradar (limite Supabase: 1000 rows).
- **Ação**: Implementar paginação ou infinite scroll.

**D. Sem confirmação ao sair sem salvar**
Formulários de criação de contrato não alertam se o usuário fechar o modal com dados preenchidos.

**E. Sem busca em Contratos**
Clientes e Parcelas têm campo de busca. Contratos não tem — apenas filtro por status.

**F. Dashboard não mostra lucro/rentabilidade**
Exibe total emprestado, a receber e recebido, mas não calcula o lucro líquido (recebido - emprestado) que é a métrica mais importante.

---

## 3. FUNCIONALIDADES AUSENTES

### 3.1 Alta Prioridade

**A. Perfil do Usuário**
Não existe tela para o usuário editar seu próprio nome, telefone ou senha. A função `update_own_profile` existe no banco mas não tem UI.

**B. Notificações de vencimento**
Sem push notifications ou lembretes de parcelas vencendo. O sistema é PWA mas não usa a capacidade de notificações.

**C. Exportação de dados**
Sem exportação de relatórios gerais (CSV/Excel de todas as parcelas, clientes ou contratos). Só existe PDF/imagem por contrato individual.

### 3.2 Media Prioridade

**D. Logs de auditoria para admin**
O admin pode ativar/desativar usuários, alterar planos, excluir dados — sem nenhum registro de quem fez o quê e quando.

**E. Renovação automática de trial**
Quando o trial expira, o sistema apenas bloqueia. Sem email automático avisando que o trial está acabando.

**F. Tema escuro**
As variáveis CSS para `.dark` existem mas não há toggle na interface.

---

## 4. QUALIDADE DE CODIGO

### 4.1 Refatorações Recomendadas

| Problema | Arquivo | Ação |
|----------|---------|------|
| Arquivo com 2284 linhas | Contratos.tsx | Extrair em componentes: ContratoForm, ContratoDetails, PagamentoDialog, ImportComprovante, RelatorioGenerator |
| Arquivo com 1426 linhas | Parcelas.tsx | Extrair: ParcelasList, PagamentoModal, HistoricoModal, EditarDataModal |
| Duplicação de lógica de pagamento | Contratos.tsx + Parcelas.tsx | Criar hook `usePagamento()` |
| Duplicação de `calcularJuros` | Contratos.tsx + Parcelas.tsx | Extrair para `lib/calculos.ts` |
| Queries sem error boundary | Todas as páginas | Implementar React Error Boundary global |
| `any` type usado extensivamente | Contratos.tsx, Parcelas.tsx | Tipar corretamente |

### 4.2 Performance

- **Dashboard faz 3 queries separadas** (clientes, contratos, parcelas) em série — poderia usar `Promise.all` e/ou uma RPC que retorna tudo.
- **Contratos carrega todos os contratos e clientes** no mount — sem lazy loading.
- **Service Worker cacheia Supabase requests** por 24h — dados desatualizados podem ser servidos do cache. Configuração `NetworkFirst` mitiga, mas o `maxAgeSeconds` de 24h é agressivo.

---

## 5. PLANO DE ACAO SUGERIDO (por prioridade)

### Sprint 1 — Segurança (1-2 dias)
1. Alterar `verify_jwt = true` no config.toml
2. Remover CSS de ocultação do badge Lovable
3. Habilitar leaked password protection no Supabase
4. Criar edge function para deletar usuários completa (auth + dados)

### Sprint 2 — Usabilidade (2-3 dias)
5. Criar componente ProtectedRoute para Admin
6. Adicionar busca em Contratos
7. Implementar tela de Perfil do Usuário
8. Adicionar paginação nas listagens

### Sprint 3 — Qualidade (3-5 dias)
9. Refatorar Contratos.tsx em componentes menores
10. Refatorar Parcelas.tsx em componentes menores
11. Extrair hooks compartilhados (usePagamento, useCalculo)
12. Adicionar Error Boundaries

### Sprint 4 — Funcionalidades (3-5 dias)
13. Exportação de dados (CSV/Excel)
14. Dashboard com métrica de lucro
15. Toggle de tema escuro
16. Logs de auditoria no admin

