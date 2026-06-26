## Problema

Na correção anterior, o `Layout` passou a usar `h-[100dvh]` (dynamic viewport height) com a barra inferior como item flex no rodapé da coluna.

O `dvh` representa a viewport **dinâmica**: quando a barra de ferramentas do navegador/webview está visível (como no seu print), `100dvh` fica **maior que a área realmente visível**. Resultado: o rodapé (a barra de navegação) é empurrado para baixo da dobra — por isso a pílula "Dashboard" aparece cortada no fim da tela e fica quase impossível de tocar.

```text
┌──────────────┐  ← topo (header)
│  conteúdo    │
│   ...        │
├──────────────┤  ← fim da área VISÍVEL (svh)
│  NAV (corte) │  ← cai aqui no print, parcialmente fora
└──────────────┘  ← fim de 100dvh (fora da tela)
```

## Solução

Trocar a unidade de altura do container raiz de `dvh` para **`svh`** (small viewport height). O `svh` é a viewport **menor/garantida** (com a barra do navegador presente), então a coluna inteira — incluindo a barra inferior — sempre cabe na área visível e fica tocável. Quando a barra do navegador some, sobra apenas um respiro de fundo embaixo, sem cortar nada.

### Mudanças em `src/components/Layout.tsx`

1. **Container raiz** — trocar a altura:
   - de `h-screen h-[100dvh] overflow-hidden bg-background flex flex-col`
   - para `h-screen h-[100svh] overflow-hidden bg-background flex flex-col`
   - (`h-screen` permanece como fallback para navegadores sem suporte a `svh`).

2. **Barra inferior (`<nav>` mobile)** — manter ancorada como item flex (`shrink-0`), preservando o `env(safe-area-inset-bottom)`. Ajustar o padding inferior para um valor mais enxuto, garantindo respiro sem empurrar demais:
   - `paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))'` (em vez de `calc(0.5rem + env(...))`), evitando padding duplicado em aparelhos com safe-area.

3. Nenhuma outra mudança: header sticky, sidebar desktop, scroll interno do `<main>` (`overflow-y-auto`), tema claro/escuro e a pílula do item ativo continuam idênticos.

## Resultado

A barra inferior fica sempre dentro da área visível, totalmente clicável, sem cortar a pílula ativa — estável tanto com a barra do navegador visível quanto recolhida, no iOS e Android, sem regredir a correção do jitter de rolagem.

## Detalhes técnicos

- `svh` (small viewport) garante que o app nunca exceda a área visível atual; `dvh` muda de tamanho e, com a toolbar presente, ultrapassa a tela. Como o scroll é interno ao `<main>`, dimensionar pela viewport menor não causa conteúdo inacessível — apenas mantém o rodapé sempre visível.
- Nenhuma lógica de dados, rotas ou navegação muda — apenas CSS/posicionamento.
