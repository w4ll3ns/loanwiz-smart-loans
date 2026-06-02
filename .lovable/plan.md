## Objetivo

Adicionar um segundo relatório — **"Relatório Simplificado"** — na tela de detalhes do contrato, sem alterar o `RelatorioGenerator` existente. A nova versão é limpa, bonita e omite dados sensíveis (principal, percentual, tipo de juros e o resumo financeiro), adequada para compartilhar com o cliente.

## Arquivos alterados

### 1. `index.html` (novo)
Adicionar no `<head>` os links das Google Fonts Fraunces + Hanken Grotesk (com `preconnect`), para o layout renderizar com a tipografia aprovada.

### 2. `src/components/contratos/RelatorioSimplificadoGenerator.tsx` (novo)
Componente com props `{ contrato: Contrato; parcelas: Parcela[] }` (tipos importados de `./ContratoDetails`) e dois botões:
- **"Imagem (simplificado)"** → PNG
- **"PDF (simplificado)"** → PDF A4 multipágina

Estrutura interna:
- `escapeHtml` e `getStatusInfo` reaproveitados do componente atual (status: pago / parcialmente_pago→Parcial / vencida e não paga→Atrasado / Pendente), porém mapeando para as cores de badge do novo design.
- Função única `montarHtml()` que monta o markup aprovado num `div` temporário fora da tela (`position:absolute; left:-9999px; width:800px; background:#fff`), com cores fixas em hex e fontes Fraunces (títulos/valores) e Hanken Grotesk (corpo).
- Campos exibidos **somente**: nome do cliente, valor total devido (destaque), data do empréstimo, quantidade de parcelas, periodicidade, status, e a barra de quitação em % (`soma(valor_pago)/valor_total`). **Não** renderiza `valor_emprestado`, `percentual`, `tipo_juros` nem resumo "Emprestado/Saldo/Quitado em R$".
- Tabela de parcelas com colunas: Nº · Vencimento · Valor · Status (badge arredondado colorido) · Pagamento · Valor Pago.
- Geração: `await document.fonts.ready` → `html2canvas(tempDiv, { scale: 2, backgroundColor: '#ffffff', logging: false })` → remover o `tempDiv`. PNG e PDF partem do **mesmo canvas**.
  - **PNG**: `canvas.toBlob` reaproveitando o fluxo de download e o caminho iOS (`navigator.share`/`navigator.canShare`) idêntico ao componente atual.
  - **PDF**: A4 retrato, fatiamento multipágina conforme o trecho fornecido na tarefa.
- Nomes dos arquivos: `relatorio-simplificado-${nome.replace(/\s+/g,'-')}-${format(new Date(),'dd-MM-yyyy')}.png|.pdf`.
- `useToast` para feedback de sucesso/erro.

Cores dos badges (a partir do `getStatusInfo`):
```text
Pago     → fundo #e7f1ec, texto #0f6b4f
Pendente → fundo #fbf0db, texto #b87514
Parcial  → fundo #fbf0db, texto #b87514
Atrasado → fundo #f7e4e2, texto #b3261e
```

### 3. `src/components/contratos/index.ts` (alterado)
Adicionar `export { RelatorioSimplificadoGenerator } from './RelatorioSimplificadoGenerator';`.

### 4. `src/components/contratos/ContratoDetails.tsx` (alterado)
Importar o novo componente e renderizá-lo logo após `<RelatorioGenerator ... />` (linha ~147), dentro da mesma `div.flex.flex-wrap.gap-2`, mantendo o detalhado intacto.

## Critérios de aceitação (resumo)
- Relatório detalhado atual segue funcionando sem alteração.
- Novo gerador aparece ao lado dos botões existentes na tela do contrato.
- Simplificado mostra só os campos não sensíveis + barra de quitação + tabela completa.
- PNG e PDF saem do mesmo HTML via html2canvas; PDF em A4 multipágina; fontes e cores corretas; `document.fonts.ready` aguardado; fluxo iOS reaproveitado no PNG.

## QA
Após implementar, gero a imagem/PDF localmente em um script de teste com dados de exemplo, converto para imagem e inspeciono visualmente (overflow, cores, fontes, badges, multipágina) antes de concluir.
