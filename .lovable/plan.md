## Objetivo

Aplicar a identidade visual/corporativa dos relatórios por contrato ao **Relatório de Atrasados** e unificar a exportação (PNG e PDF gerados a partir do mesmo HTML via `relatorioExport.ts`), sem alterar nenhuma consulta Supabase ou cálculo de agregação/totais.

## 1. Novo arquivo: `relatorioStyles.ts` (tokens compartilhados)

Extrair a paleta e helpers comuns para um módulo reutilizado pelos dois templates:

- `PAL` (tinta `#15201b`, tinta-2 `#3d4a44`, muted `#7a857f`, linha `#e3e7e4`, lineStrong `#c8cfcb`, marca `#0f6b4f`/escuro `#0a4f3a`, pago `#1d7a55`, atrasado `#b0322a`, pendente `#9a6310`, zebra `#f7f8f7`).
- `escapeHtml`.
- CSS comuns: faixa de acento verde no topo (`accent-top`), `.num` (tabular-nums), cabeçalho estilo extrato (`head`, `brand`, `head h1`, `.gen`, `.right`), rodapé (`foot`), reset base e fonte (`Libre Franklin`/`Archivo`).
- `relatorioTemplate.ts` passa a importar `PAL`/`escapeHtml`/blocos de CSS deste módulo (refactor leve — mesmo visual de hoje).

## 2. Novo arquivo: `relatorioAtrasadosTemplate.ts`

Exporta `buildRelatorioAtrasadosHtml(args)` recebendo os dados já calculados pelo componente (selectedDados, columns, cards, title, contadores) — **sem refazer agregação**. Gera HTML com:

- `width` ~960px.
- Faixa de acento verde + cabeçalho: esquerda "● WS Empréstimos" + título em **Title Case** (converter o resultado de `getReportTitle`, hoje em MAIÚSCULAS) + "Gerado em dd/MM/yyyy às HH:mm". Direita: resumo do filtro ativo (chips "Pagas"/"Atrasadas"/"Pendentes" conforme switches) e "Clientes: N".
- Cards de resumo no padrão novo (cards brancos, borda `#e3e7e4`, rótulo muted maiúsculo, valor Archivo bold). Card "Valor Atrasado" como âncora (card escuro `#15201b`/texto branco). Mantém exatamente os cards que `buildSummaryCards` decide.
- Tabela única: thead borda inferior `1.5px solid #15201b`, rótulos muted maiúsculos; linhas zebra `#f7f8f7`; numéricas à direita, contagens centralizadas e coloridas por status (texto colorido, sem fundo); cliente à esquerda.
- `tfoot`: linha âncora `#15201b` texto branco, "TOTAL (N clientes)" + totais por coluna.
- Rodapé discreto + data.

## 3. Refatorar `RelatorioAtrasados.tsx`

PRESERVAR intacto: modal, switches, seleção/checkboxes, contadores, `loadDados`, agregação, `filteredDados`, `selectedDados`, `buildDynamicColumns`, `getCellValue`, `getTotalValue`, `getReportTitle`, `buildSummaryCards`, linha de totais e filtros.

Mudanças:
- Remover imports `jsPDF`/`html2canvas` locais e a função `hexToRgb`.
- Remover a função `gerarPDF` (desenho manual) e o `buildHtml` antigo + `gerarImagem` manual.
- Ajustar cores das colunas/cards (`buildDynamicColumns`, `buildSummaryCards`) para a paleta nova (`#1d7a55`/`#b0322a`/`#9a6310`, e `#15201b` no lugar de `#333`) — apenas valores de cor, sem mudar a lógica de quais aparecem.
- `gerarImagem`/`gerarPDF` passam a montar HTML via `buildRelatorioAtrasadosHtml(...)` e chamar `exportarPng`/`exportarPdf` de `relatorioExport.ts` (que já aguarda `document.fonts.ready` e preserva fluxo iOS).
- Nome do arquivo: `relatorio-atrasados-${dd-MM-yyyy}.png|.pdf`.
- Botões "Baixar Imagem" / "Baixar PDF" e ícones mantidos.

## Critérios de aceitação

- Modal, filtros, seleção, colunas dinâmicas e totais funcionam como antes.
- Relatório (imagem e PDF) usa Archivo + Libre Franklin, fundo branco, faixa de acento verde, números tabulares, paleta nova, cards/cabeçalho/rodapé no padrão dos outros relatórios.
- PNG e PDF visualmente idênticos (mesmo HTML via html2canvas); PDF A4 multipágina.
- `gerarPDF` manual e `hexToRgb` removidos.
- Cores antigas (`#22c55e`, `#ef4444`, `#f59e0b`, `#333`, `#fef2f2`) não aparecem mais.
- Nenhuma consulta Supabase nem cálculo alterado.

## QA

Gerar PNG headless de exemplo (vários clientes, filtros variados) para validar faixa verde, cabeçalho, cards âncora, zebra, contagens coloridas e tfoot antes de concluir.
