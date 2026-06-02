## Objetivo

Aplicar a identidade visual formal/corporativa do HTML aprovado (`relatorio-simplificado-v2-formal.html`) aos **dois** relatórios da tela de detalhes do contrato, sem mudar os dados de cada um:

- **Detalhado** (`RelatorioGenerator.tsx`): todos os dados, inclusive sensíveis (valor emprestado, percentual/juros, resumo completo).
- **Simplificado** (`RelatorioSimplificadoGenerator.tsx`): sem dados sensíveis.

Ambos passam a usar **um template HTML compartilhado** e os **mesmos utilitários de exportação** (PNG + PDF gerados do mesmo HTML via html2canvas). A única diferença é o flag `simplificado`.

## Arquivos

### 1. `index.html` (alterar)
Trocar o `<link>` atual de fontes (Fraunces + Hanken Grotesk) pelo do novo design — Archivo + Libre Franklin:
```
family=Archivo:wght@500;600;700;800&family=Libre+Franklin:wght@400;500;600;700&display=swap
```
(mantendo os `preconnect`). As fontes antigas não são mais usadas por nenhum relatório.

### 2. `src/components/contratos/relatorioTemplate.ts` (novo)
Exporta `buildRelatorioHtml(contrato, parcelas, { simplificado }): { html: string; width: number }`.

Centraliza toda a lógica:
- **Totais**: `totalPago = Σ valor_pago`, `saldoRestante = valor_total − totalPago`, `pctQuitado` e fração "X de N parcelas".
- **Contadores**: pagas / atrasadas / pendentes (parcial conta como pendente nos contadores, mantendo `getStatusInfo`).
- **Próximo vencimento**: 1ª parcela não paga (menor `numero_parcela`); marca selo vermelho "Em atraso" se vencida.
- **`getStatusInfo(p)`** → `{ texto, classe }` com classes `g`/`a`/`r` (Pago=g, Pendente/Parcial=a, Atrasado=r), aplicando a paleta fixa em hex.
- **`escapeHtml`** para o nome do cliente.
- **Colunas dinâmicas**: `numero_parcelas <= 12` → 1 col (≈720px), `13–40` → 2 col (≈1040px), `>40` → 3 col (≈1380px). Distribuição uniforme em ordem (`Math.ceil(n/cols)` por coluna), cada coluna uma `<table>` própria com seu `<thead>`. Retorna `width` para o div temporário.
- **Markup**: replica fielmente o HTML aprovado — faixa de acento, header (marca + título + "Gerado em…" + bloco Contrato/Situação à direita), bloco Cliente, cards de resumo, strip de metadados (próximo vencimento âmbar + selo), seção parcelas com contadores e grid de colunas, rodapé. Todo CSS embutido inline ou em `<style>` dentro do HTML retornado, com cores em **hex fixo** (paleta do anexo), `font-variant-numeric: tabular-nums` nos valores/datas, e linha atrasada com `box-shadow: inset 3px 0 0 #b0322a`.

**Diferença pelo flag `simplificado`:**

```text
Bloco                                   Detalhado   Simplificado
Card "Valor emprestado"                    sim          não
Card "Juros (%) + tipo"                    sim          não
Card "Valor total devido" (escuro)         sim          sim
Cards "Total pago" / "Saldo restante"      sim          sim
Card "Quitação" + barra                    sim          sim
Strip (próx. venc., data, parcelas,        sim          sim
  periodicidade, valor parcela)
Tabela de parcelas (6 colunas)             sim          sim
```
No detalhado os cards extras entram na mesma fileira (grid ajustado para ~6 cards, mantendo o card escuro como âncora). No simplificado, mantém os 4 cards do anexo.

### 3. `src/components/contratos/relatorioExport.ts` (novo)
- `exportarPng(html, width, fileName, titulo, toast)`: cria div temporário (`position:absolute; left:-9999px; background:#fff; width`), injeta o HTML, `await document.fonts.ready`, `html2canvas(div, { scale: 2, backgroundColor: '#ffffff', logging: false })`, remove o div, `canvas.toBlob` → download + fluxo iOS (`navigator.share`/`navigator.canShare`) idêntico ao atual.
- `exportarPdf(html, width, fileName, toast)`: mesmo canvas → `jsPDF('p','mm','a4')` com o fatiamento multipágina do briefing.
- Função interna `gerarCanvas(html, width)` compartilhada entre os dois.

### 4. `src/components/contratos/RelatorioGenerator.tsx` (reescrever, fino)
Remove todo o HTML/PDF manual. Monta `fileName = contrato-${slug}-${dd-MM-yyyy}`, chama `buildRelatorioHtml(contrato, parcelas, { simplificado: false })` e usa `exportarPng`/`exportarPdf`. Botões mantidos: "Baixar Imagem" / "Baixar PDF".

### 5. `src/components/contratos/RelatorioSimplificadoGenerator.tsx` (reescrever, fino)
Igual, com `{ simplificado: true }`, `fileName = relatorio-simplificado-${slug}-${dd-MM-yyyy}`. Botões mantidos: "Imagem (simplificado)" / "PDF (simplificado)".

Nenhuma mudança em `ContratoDetails.tsx` (já renderiza os dois) nem em `index.ts`.

## Critérios de aceitação
- Os dois relatórios continuam na tela do contrato com seus botões atuais.
- Ambos usam o layout formal (Archivo + Libre Franklin, fundo branco, números tabulares, status com bolinhas, cards, próximo vencimento com selo, contadores, rodapé).
- Detalhado mostra dados sensíveis; simplificado não.
- Tabela em 1/2/3 colunas conforme quantidade, distribuída uniformemente em ordem.
- Linha atrasada destacada; próximo vencimento sinalizado.
- PNG e PDF de cada relatório saem idênticos (mesmo HTML); PDF A4 multipágina.
- `document.fonts.ready` aguardado; fluxo iOS preservado no PNG.
- Cálculos/status/dados inalterados — só layout e exportação.

## QA
Após implementar, gero PNG/PDF de exemplo num script headless (1, 20 e 45 parcelas) para validar colunas, fontes, cores, badges, selo de atraso e multipágina antes de concluir.