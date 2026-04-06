

# Sprint 5 — Funcionalidades Novas

## 5.1 Exportação CSV
**Arquivos**: `src/lib/exportCsv.ts` (novo), `src/pages/Clientes.tsx`, `src/pages/Contratos.tsx`, `src/pages/Parcelas.tsx`

Criar função utilitária `exportarCsv(filename, headers, rows)` que gera e faz download de um arquivo CSV UTF-8 com BOM (compatível com Excel).

Adicionar botão "Exportar CSV" (ícone `Download`) no `CardHeader` de cada listagem, exportando os dados **filtrados** atuais:
- **Clientes**: Nome, Telefone, Endereço, Observações
- **Contratos**: Cliente, Valor Emprestado, Valor Total, Parcelas, Status, Data Empréstimo
- **Parcelas**: Cliente, Nº Parcela, Valor, Vencimento, Status, Valor Pago, Data Pagamento

## 5.2 Tema Escuro
**Arquivos**: `src/hooks/useTheme.ts` (novo), `src/components/ThemeToggle.tsx` (novo), `src/components/Layout.tsx`, `src/main.tsx`

- Criar hook `useTheme` que lê/grava preferência em `localStorage` (`theme: light | dark | system`) e aplica classe `dark` no `<html>`
- Criar componente `ThemeToggle` com ícone Sol/Lua que alterna entre claro e escuro
- Adicionar `ThemeToggle` no header do Layout (desktop e mobile), ao lado do botão de logout
- As variáveis CSS `.dark` já estão definidas em `index.css` — nenhuma alteração de CSS necessária

## 5.3 Logs de Auditoria para Admin
**Migração SQL**: Criar tabela `audit_logs` e trigger/função para registro automático

```text
audit_logs
├── id (uuid, PK)
├── user_id (uuid, referência ao admin que executou)
├── action (text: 'toggle_user', 'delete_user', 'change_plan', etc.)
├── target_user_id (uuid, opcional)
├── details (jsonb, dados extras)
├── created_at (timestamptz)
```

RLS: apenas admins podem SELECT; INSERT via security definer function.

**Arquivo**: `src/pages/Admin.tsx`
- Criar função `logAuditAction()` que insere na tabela `audit_logs`
- Chamar `logAuditAction` nas ações existentes do admin: ativar/desativar usuário, alterar plano, excluir usuário, resetar senha
- Adicionar aba/seção "Logs de Auditoria" na página Admin com listagem dos últimos 100 logs (data, admin, ação, usuário alvo, detalhes)

---

## Detalhes Técnicos

- CSV usa `Blob` com `text/csv;charset=utf-8` e BOM `\uFEFF` para compatibilidade Excel
- Tema usa `matchMedia('(prefers-color-scheme: dark)')` para opção "system"
- A tabela `audit_logs` terá RLS restrita a admins usando `has_role(auth.uid(), 'admin')`
- Insert nos logs será feito via função `security definer` para garantir que o registro é criado mesmo com RLS restrita
- Nenhuma edge function necessária — tudo client-side + SQL

## Arquivos a criar/editar
1. `src/lib/exportCsv.ts` — utilitário de exportação (novo)
2. `src/pages/Clientes.tsx` — botão exportar
3. `src/pages/Contratos.tsx` — botão exportar
4. `src/pages/Parcelas.tsx` — botão exportar
5. `src/hooks/useTheme.ts` — hook de tema (novo)
6. `src/components/ThemeToggle.tsx` — toggle de tema (novo)
7. `src/components/Layout.tsx` — adicionar ThemeToggle
8. `src/main.tsx` — inicializar tema
9. `src/pages/Admin.tsx` — logs de auditoria + logAuditAction
10. **Migração SQL** — tabela `audit_logs`, RLS, função insert

