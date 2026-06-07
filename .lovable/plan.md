## Objetivo
Tornar o card "Juros Recebidos" (Total Juros Recebido) em `src/pages/Parcelas.tsx` clicável e abrir um modal de detalhamento/auditoria do lucro, com a mesma lista servindo de fonte de verdade para o card e o modal.

## Mudanças em `src/pages/Parcelas.tsx`

### 1. Expandir a busca do histórico
No `loadParcelas`, ampliar o select dos eventos:
```ts
.select('id, parcela_id, tipo_pagamento, valor_pago, data_pagamento')
```
Atualizar o tipo do estado `historicoPagamentos` para incluir `id` e `data_pagamento`.

### 2. Fonte de verdade única (substitui o cálculo atual de `totalJurosRecebido`)
```ts
const mapaParcela = new Map(dashboardParcelas.map(p => [p.id, p]));
const idsDashboard = new Set(dashboardParcelas.map(p => p.id));

const lucroDoEvento = (e, parcela) => {
  const valor = Number(e.valor_pago) || 0;
  if (e.tipo_pagamento === 'juros' || e.tipo_pagamento === 'parcial') return valor;
  if (e.tipo_pagamento === 'total') {
    const c = parcela?.contratos;
    const principal = Number(c?.valor_emprestado || 0) / (c?.numero_parcelas || 1);
    return Math.max(valor - principal, 0);
  }
  return 0;
};

const detalhesLucro = (historicoPagamentos || [])
  .filter(e => idsDashboard.has(e.parcela_id))
  .map(e => { /* id, data, cliente, numeroParcela, tipo, valorPago, principal, lucro */ })
  .sort((a, b) => +new Date(b.data) - +new Date(a.data));

const totalJurosRecebido = detalhesLucro.reduce((acc, d) => acc + d.lucro, 0);
```
Remover o bloco antigo `idsDashboard`/`mapaContrato`/`totalJurosRecebido` (do ajuste anterior) para evitar duplicidade.

### 3. Card clicável
- Novo estado: `const [lucroModalAberto, setLucroModalAberto] = useState(false);`
- No card "Juros Recebidos" (linhas 387-394): adicionar `cursor-pointer` + hover (padrão dos outros cards) e `onClick={() => setLucroModalAberto(true)}`.

### 4. Modal de detalhamento
Usar `Dialog` de `@/components/ui/dialog` (importar `Dialog, DialogContent, DialogHeader, DialogTitle`).
- Título: "Detalhamento do lucro recebido".
- Linha explicativa curta sobre a regra (juros/parcial = 100%; total = juro embutido).
- Lista responsiva de `detalhesLucro`: `Table` em telas largas (`hidden md:table`), cards empilhados no mobile (`md:hidden`). Colunas: Data (pt-BR), Cliente, Parcela (#numeroParcela), Tipo (badge Juros/Parcial/Total), Valor pago (R$), Lucro (R$).
- Para `tipo === 'total'`, texto discreto abaixo do valor: "valor R$X − principal R$Y".
- Rodapé com resumo derivado de `detalhesLucro`: Recebido em juros, Recebido em parciais, Juro dos quitados, Total geral + contagem de lançamentos. Conteúdo rolável com rodapé fixo.
- Vazio: `EmptyState` ("Nenhum lucro recebido ainda").
- Todos os valores em pt-BR com 2 casas.

### 5. Sem alterações
Demais cards e a lista de parcelas permanecem intactos.

## Observações técnicas
- `EmptyState` e `Badge` já importados; `Table*` já importados. Adicionar apenas o import de `Dialog`.
- A nova `historicoPagamentos` já busca por `parcela_id IN ids`, respeitando RLS por usuário.