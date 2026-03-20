

## Plano: Corrigir overflow horizontal na pagina de Parcelas no mobile

### Causa raiz

O problema e um bug classico de flexbox. No `Layout.tsx`, a estrutura e:

```text
div.flex.flex-1 (row direction)
  aside (hidden no mobile)
  main.flex-1.p-4   ← o problema esta aqui
```

O `<main>` e um flex child com `flex-1`, que por padrao tem `min-width: auto`. Isso significa que o elemento **nunca encolhe abaixo da largura natural do conteudo**. Quando os dados carregam e os cards de parcelas sao renderizados (com grids, botoes, textos), algum elemento interno e ligeiramente mais largo que a tela, e o `<main>` expande para acomodar, criando scroll horizontal.

Antes de carregar dados, o skeleton e simples e cabe. Depois, o conteudo real forca o overflow.

### Por que o Dashboard funciona

O Dashboard tem cards mais simples (sem `border-l-4`, sem 4 botoes de acao por card, sem grids aninhados), entao o conteudo natural cabe na tela.

### Solucao

Adicionar `min-w-0 overflow-x-hidden` ao `<main>` no Layout.tsx. Isso:
1. `min-w-0`: permite que o flex child encolha abaixo da largura do conteudo
2. `overflow-x-hidden`: garante que nenhum conteudo vaze horizontalmente

### Alteracao

| Arquivo | Acao |
|---|---|
| `src/components/Layout.tsx` | Linha 149: adicionar `min-w-0 overflow-x-hidden` ao className do `<main>` |

Alterar de:
```
<main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
```
Para:
```
<main className="flex-1 min-w-0 overflow-x-hidden p-4 md:p-6 pb-20 md:pb-6">
```

Isso corrige o problema na raiz (Layout) em vez de adicionar workarounds em cada pagina individual.

