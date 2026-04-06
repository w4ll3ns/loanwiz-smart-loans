

## Sprint 5 — Funcionalidades Novas ✅

### 5.1 Exportação CSV ✅
- Utilitário `src/lib/exportCsv.ts` com BOM UTF-8
- Botões "Exportar CSV" em Clientes, Contratos e Parcelas

### 5.2 Tema Escuro ✅
- Hook `src/hooks/useTheme.ts` com persistência localStorage
- Componente `ThemeToggle` no header (desktop e mobile)
- Inicialização em `main.tsx`

### 5.3 Logs de Auditoria ✅
- Tabela `audit_logs` com RLS admin-only
- Função `insert_audit_log` security definer
- Logging em: toggle_user, delete_user, change_plan, reset_password
- Seção "Logs de Auditoria" na página Admin
