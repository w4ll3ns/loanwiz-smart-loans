

## Plano: Corrigir cards cortados - remover padding do #root

### Causa raiz

O arquivo `src/App.css` contem estilos boilerplate do Vite que nunca foram removidos:

```css
#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;    /* <-- 32px de cada lado! */
  text-align: center;
}
```

Em uma tela de 390px, isso reduz a area util para ~326px. Somado ao `p-4` (16px) do Layout, sobram apenas ~294px para o conteudo. Os cards de Parcelas com `border-l-4`, grids e padding interno estouram esse espaco.

### Solucao

Remover **todo o conteudo** de `src/App.css` (ou pelo menos as regras do `#root`). Esses estilos sao restos do template inicial do Vite e nao sao usados pelo sistema -- todo o styling vem do Tailwind via `index.css`.

Tambem simplificar o container raiz de `Parcelas.tsx` removendo os workarounds (`min-w-0 max-w-full overflow-hidden`) que foram adicionados para compensar o problema real.

### Alteracoes

| Arquivo | Acao |
|---|---|
| `src/App.css` | Remover todo o conteudo (estilos boilerplate nao utilizados) |
| `src/pages/Parcelas.tsx` | Simplificar container raiz: trocar `w-full min-w-0 max-w-full overflow-hidden` por apenas `space-y-4 md:space-y-6` (mesmo padrao do Dashboard) |

