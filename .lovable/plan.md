

# Próximas Sprints — WS Empréstimos

Sprints 1 (Segurança) e 2 (Usabilidade base) já foram concluídas, além do gráfico de lucro mensal e correção do cálculo de lucro no Dashboard. Abaixo estão as próximas sprints pendentes.

---

## Sprint 3 — Qualidade de Código (Refatoração)

O objetivo é quebrar os dois arquivos monolíticos em componentes menores e extrair lógica compartilhada.

### 3.1 Refatorar `Contratos.tsx` (2284 linhas)
Extrair em componentes separados:
- `ContratoForm` — formulário de criação/edição com preview de cálculo
- `ContratoDetails` — modal/sheet de detalhes do contrato
- `PagamentoDialog` — dialog de registro de pagamento
- `ImportComprovante` — upload e parsing de comprovante
- `RelatorioGenerator` — geração de PDF/imagem do contrato

### 3.2 Refatorar `Parcelas.tsx` (1426 linhas)
Extrair:
- `ParcelasList` — listagem com filtros e busca
- `PagamentoModal` — modal de pagamento de parcela
- `HistoricoModal` — modal do histórico de pagamentos
- `EditarDataModal` — modal de edição de data de vencimento

### 3.3 Extrair lógica compartilhada
- `src/lib/calculos.ts` — funções `calcularJuros`, cálculo de lucro por parcela
- `src/hooks/usePagamento.ts` — hook de registro de pagamento (usado por Contratos e Parcelas)
- Tipar corretamente props e estados (remover usos de `any`)

---

## Sprint 4 — Usabilidade Avançada

### 4.1 Busca em Contratos
Adicionar campo de busca por nome do cliente, similar ao que já existe em Clientes e Parcelas.

### 4.2 Paginação nas listagens
Implementar paginação com botões "Anterior / Próximo" e contagem de registros em:
- Clientes
- Contratos
- Parcelas
Usando `.range()` do Supabase para carregar 20 registros por vez.

### 4.3 Skeleton de loading em Contratos
Adicionar skeleton de carregamento enquanto dados são buscados (já existe em Dashboard, Clientes e Parcelas).

### 4.4 Confirmação ao fechar formulário
Alert ao tentar fechar modal de criação de contrato com dados preenchidos.

---

## Sprint 5 — Funcionalidades Novas

### 5.1 Exportação de dados (CSV/Excel)
Botão de exportação em cada listagem (Clientes, Contratos, Parcelas) gerando CSV com os dados filtrados.

### 5.2 Tema escuro
Adicionar toggle de tema no header/perfil. As variáveis CSS `.dark` já existem no `index.css`.

### 5.3 Logs de auditoria para Admin
Criar tabela `audit_logs` no Supabase registrando ações do admin (ativar/desativar usuário, excluir dados, alterar plano) com timestamp e user_id. Exibir na página Admin.

---

## Ordem sugerida

Cada sprint pode ser implementada independentemente. A sugestão é:

1. **Sprint 3** primeiro — facilita manutenção futura de tudo que vem depois
2. **Sprint 4** — melhora a experiência do usuário imediatamente
3. **Sprint 5** — adiciona valor com funcionalidades novas

Qual sprint deseja iniciar?

