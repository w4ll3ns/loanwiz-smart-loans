
## Plano: Corrigir zoom automático em inputs no mobile (Safari)

### Problema

No Safari mobile (iOS), inputs com `font-size` menor que `16px` disparam zoom automático da página ao receber foco. Isso afeta todos os modais e formulários do sistema.

### Solução

Adicionar uma regra CSS global em `src/index.css` que força `font-size: 16px` em todos os campos de texto quando o dispositivo é touch (mobile). Isso previne o zoom sem desabilitar pinch-to-zoom do usuário.

### Alteração em `src/index.css`

Adicionar no final do bloco `@layer base`:

```css
@media (hover: none) and (pointer: coarse) {
  input:not([type="checkbox"]):not([type="radio"]):not([type="range"]),
  textarea,
  select,
  [contenteditable="true"],
  [role="textbox"] {
    font-size: 16px !important;
  }
}
```

Uma única alteração, um único arquivo. Corrige o problema em todo o sistema de uma vez.
