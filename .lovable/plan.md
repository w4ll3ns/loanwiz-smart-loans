## Problema

No mobile, a barra de navegação inferior usa `position: fixed`. No iOS Safari, elementos `fixed` "saltam"/flutuam durante a rolagem por inércia (momentum scroll) e quando a barra de ferramentas do navegador aparece/some — por isso, ao rolar, a barra sobe junto e aparece no meio da tela (como na captura).

## Solução

Em vez de depender de `position: fixed` (instável no iOS), transformar o `Layout` num container de altura fixa onde o conteúdo rola internamente e a barra fica ancorada como item flex no rodapé. Assim a barra nunca se move durante a rolagem.

### Mudanças em `src/components/Layout.tsx`

1. **Container raiz**: trocar `min-h-screen ... flex flex-col` por altura travada na viewport e sem overflow externo:
   - `h-[100dvh] overflow-hidden bg-background flex flex-col` (com fallback `h-screen`).
2. **Área de conteúdo (`<main>`)**: torná-la a região rolável interna:
   - adicionar `overflow-y-auto` e `overscroll-contain`;
   - remover o `pb-[calc(6rem+...)]` extra (não é mais necessário, pois a barra deixa de sobrepor o conteúdo).
3. **Barra inferior (`<nav>` mobile)**: remover `fixed bottom-0 left-0 right-0` e torná-la um item flex normal no fim da coluna:
   - `md:hidden shrink-0 z-50 border-t ...` mantendo o mesmo estilo visual, paddings e `env(safe-area-inset-bottom)`.
4. Garantir que o wrapper intermediário (`<div>` que envolve aside + main) use `flex-1 min-h-0` para permitir o scroll interno do `<main>`.

### Resultado

A barra inferior fica fixa de forma estável no rodapé em iOS/Android, sem subir durante a rolagem, preservando safe-area, tema claro/escuro e a pílula do item ativo.

## Detalhes técnicos

- `100dvh` resolve a variação de altura da barra do Safari; `overflow-hidden` no raiz + `overflow-y-auto` no `<main>` move o scroll para dentro do app em vez do `body`, eliminando o jitter do `fixed`.
- Nenhuma lógica de dados, rotas ou navegação muda — apenas posicionamento/CSS.
