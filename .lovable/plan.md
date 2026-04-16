

# Relatório de Contratos Atrasados com Seleção

## O que será feito
Criar um componente de relatório de contratos atrasados com uma etapa de seleção: o usuário abre um dialog/sheet, vê a lista de contratos ativos com parcelas atrasadas, pode marcar/desmarcar quais incluir no relatório, e então gerar como PDF ou imagem PNG.

## Detalhes técnicos

### Novo componente: `src/components/contratos/RelatorioAtrasados.tsx`

1. **Botão trigger** — "Relatório Atrasados" com ícone `AlertTriangle`, renderizado no header da página de Contratos
2. **Dialog/Sheet de seleção** — ao clicar, abre um modal que:
   - Busca parcelas de todos os contratos ativos via Supabase (`parcelas` com join em `contratos` e `clientes`)
   - Agrupa por contrato/cliente, calculando: parcelas pagas, parcelas atrasadas (pendente + vencimento < hoje), valor atrasado
   - Filtra apenas contratos que têm ao menos 1 parcela atrasada
   - Exibe lista com checkboxes (usando `Checkbox` do shadcn) — cada linha mostra: nome do cliente, X pagas, Y atrasadas, R$ valor atrasado
   - Botão "Selecionar Todos" / "Desmarcar Todos"
   - Todos pré-selecionados por padrão
3. **Geração do relatório** — dois botões no rodapé do modal: "Baixar Imagem" e "Baixar PDF"
   - Gera HTML offscreen (mesmo padrão do `RelatorioGenerator`) com tabela dos contratos selecionados
   - Título: "RELATÓRIO DE CONTRATOS ATRASADOS", data de geração
   - Colunas: Cliente | Pagas | Atrasadas | Valor Atrasado
   - Totalizador no rodapé (total clientes, total parcelas atrasadas, valor total)
   - `html2canvas` → PNG, `jsPDF` → PDF
   - Web Share API para iOS (conforme padrão existente)
   - `escapeHtml` nos nomes de clientes

### `src/pages/Contratos.tsx`
- Importar e adicionar `<RelatorioAtrasados />` no `<PageHeader>`, ao lado do botão "Importar"
- Não precisa passar props — o componente busca os dados diretamente do Supabase

### Arquivos
- **Criar**: `src/components/contratos/RelatorioAtrasados.tsx`
- **Editar**: `src/pages/Contratos.tsx` (adicionar botão no header)
- **Editar**: `src/components/contratos/index.ts` (export)

Sem mudanças no banco de dados.

