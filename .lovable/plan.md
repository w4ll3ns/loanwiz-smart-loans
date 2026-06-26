## Corrigir safe-area no mobile (iPhone barra de gestos)

### Problema
A nav inferior mobile está com botões sobre a zona de gesto do iPhone porque `env(safe-area-inset-bottom)` retorna 0 — `viewport-fit=cover` não está habilitado no `index.html`.

### Arquivos alterados
1. `index.html`
2. `src/components/Layout.tsx`

### Mudanças detalhadas

#### 1. `index.html` — habilitar safe-area
Trocar a meta viewport:
```html
<!-- de -->
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<!-- para -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

#### 2. `src/components/Layout.tsx` — nav inferior (mobile)
Aplicar padding inferior com piso mínimo:
```tsx
style={{
  paddingTop: '0.5rem',
  paddingBottom: 'max(0.75rem, calc(0.5rem + env(safe-area-inset-bottom)))',
}}
```
A fileira de botões (`h-[46px]` etc.) permanece inalterada.

#### 3. `src/components/Layout.tsx` — proteger o topo
Adicionar `style={{ paddingTop: 'env(safe-area-inset-top)' }}` nos dois `<header>` (desktop e mobile), mantendo classes e altura atuais.

#### 4. `src/components/Layout.tsx` — ajustar padding do `<main>`
Aumentar o padding inferior mobile para garantir que o conteúdo não fique escondido atrás da nav agora que ela respeita a safe-area:
```tsx
pb-[calc(6rem+env(safe-area-inset-bottom))]
```
(ou equivalente `pb-24` ajustado se o cálculo dinâmico não for viável com Tailwind classes puras).

### Critérios de aceitação
- Botões do meio da nav ficam acima da zona de gesto no iPhone.
- Espaçamento inferior se adapta ao modelo (piso mínimo quando inset = 0).
- Header não fica sob o notch/status bar.
- Nenhum conteúdo fica escondido atrás da barra inferior.
- Layout, rotas, itens e pílula ativa permanecem iguais.