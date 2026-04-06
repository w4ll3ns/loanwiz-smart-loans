

# Sprint 6 — Dashboard Avançado, Relatório PDF e Notificações de Vencimento

## 6.1 Dashboard com mais gráficos
**Arquivo**: `src/pages/Dashboard.tsx`

Adicionar dois novos gráficos abaixo do gráfico de lucro mensal existente:

1. **Gráfico de Pizza — Distribuição por Status**: mostra proporção de parcelas Pendentes, Pagas, Atrasadas e Parcialmente Pagas usando `PieChart` do Recharts (já instalado)
2. **Gráfico de Barras — Capital Emprestado vs Recebido**: barras agrupadas comparando total emprestado, total recebido e total a receber por mês (últimos 6 meses)

Os dados já estão disponíveis na query existente — apenas processamento adicional no `useMemo`.

## 6.2 Relatório PDF avançado
**Arquivo**: `src/components/contratos/RelatorioGenerator.tsx`

Melhorar o PDF gerado com jsPDF (já instalado):
- **Cabeçalho**: título estilizado com linha separadora
- **Resumo financeiro**: box com total emprestado, total pago, saldo restante, percentual quitado
- **Tabela de parcelas**: com cores por status (verde/vermelho/cinza) e linhas alternadas
- **Rodapé**: data de geração e número da página
- Suporte a contratos com muitas parcelas (paginação automática já existente, apenas melhorar layout)

## 6.3 Notificações de vencimento (in-app)
**Arquivos**: `src/components/NotificacoesVencimento.tsx` (novo), `src/components/Layout.tsx`

- Criar componente com ícone de sino (`Bell`) no header, com badge numérico mostrando parcelas vencendo hoje ou amanhã
- Ao clicar, abre um `Popover` com lista das parcelas urgentes (cliente, valor, data)
- Cada item tem link para a página de parcelas
- Query dedicada ao montar o Layout buscando parcelas com `data_vencimento` = hoje ou amanhã e status pendente/parcialmente_pago
- Badge vermelho quando há vencimentos hoje, amarelo para amanhã

---

## Detalhes técnicos

- Recharts `PieChart` e `Cell` para gráfico de pizza com cores customizadas
- Dashboard calcula dados dos novos gráficos a partir da query de parcelas já existente (sem queries adicionais)
- Notificações usam `Popover` de `@/components/ui/popover` (já instalado)
- PDF usa apenas jsPDF sem html2canvas para o relatório avançado (mais rápido e menor)
- Responsivo: gráficos empilham verticalmente no mobile (grid-cols-1 md:grid-cols-2)

## Arquivos a criar/editar
1. `src/pages/Dashboard.tsx` — dois novos gráficos
2. `src/components/contratos/RelatorioGenerator.tsx` — PDF melhorado
3. `src/components/NotificacoesVencimento.tsx` — componente de notificações (novo)
4. `src/components/Layout.tsx` — adicionar sino de notificações no header

