## Objetivo

Corrigir dois problemas visuais no CSS do template compartilhado (`src/components/contratos/relatorioTemplate.ts`), refletindo automaticamente nos dois relatórios (detalhado e simplificado). Nenhuma mudança de dados, cálculos ou markup além do necessário.

## Arquivo único: `src/components/contratos/relatorioTemplate.ts`

Todas as alterações são no bloco `styles` (CSS embutido). O markup já gera a célula de status com `<span class="dot r"></span>Atrasado` e a faixa com `.strip .cell`, `.k`, `.v` e o selo `.tag` dentro de `.next` — então só o CSS precisa mudar.

### Problema 1 — Linha atrasada com fundo vermelho sólido

Hoje o CSS tem:
```text
tbody tr.late td{box-shadow:inset 3px 0 0 #b0322a}
```
Já não há background vermelho na linha — mas para garantir e atender ao critério, ajustar/confirmar para:
```text
tbody tr.late td { box-shadow: inset 3px 0 0 #b0322a; }
tbody tr.late:nth-child(even) { background: #f7f8f7; }
.st.r { color: #b0322a; font-weight: 600; }
.dot.r { background: #b0322a; }
```
Isso mantém zebra normal, faixa vermelha só na borda esquerda e o status `● Atrasado` legível, com Valor / Pago em / Valor pago visíveis.

### Problema 2 — Faixa de metadados desalinhada

Ajustar o grid da faixa para dar mais largura à primeira célula e tornar cada célula uma coluna flex com baseline única:
```text
.strip { grid-template-columns: 1.7fr 1fr 1fr 1fr 1fr; }
.strip .cell { display: flex; flex-direction: column; }
.strip .k { min-height: 2.4em; line-height: 1.2; }
.strip .v { margin-top: auto; }
.strip .next .v { white-space: nowrap; }
.strip .next .tag {
  display: inline-block; margin-top: 6px;
  font-size: 9.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
  background: #b0322a; color: #fff; padding: 2px 8px; border-radius: 4px;
}
```
Os rótulos não são renomeados nem encurtados; o alinhamento é resolvido só por `min-height` + `margin-top:auto`. O selo "EM ATRASO" passa a ficar em bloco controlado abaixo do valor.

## Critérios de aceitação
- Parcela atrasada: fundo zebra normal, faixa vermelha só na borda esquerda, `● Atrasado` legível, todos os valores visíveis.
- Valores da faixa alinhados na mesma base mesmo com rótulo em 2 linhas.
- Selo "EM ATRASO" abaixo do valor do próximo vencimento, sem quebra acidental.
- Vale para os dois relatórios; nenhum outro layout/dado/cálculo alterado.

## QA
Gerar PNG headless de exemplo (com 1 parcela atrasada e rótulos de tamanhos diferentes) para validar borda vermelha, legibilidade do status e alinhamento da faixa antes de concluir.