

## Plano: Corrigir responsividade mobile em todas as paginas

### Problemas identificados

1. **Parcelas.tsx** - Filtro de periodo com inputs `w-[140px]` fixos que nao se adaptam; cards de resumo em `grid-cols-2` ficam apertados em 390px; a div raiz tem `overflow-hidden` mas elementos internos podem vazar
2. **Contratos.tsx** - Tabela de listagem usa `overflow-x-auto` sem versao mobile em cards, causando scroll horizontal; tabela dentro do dialog de detalhes do contrato (preview) tambem usa `overflow-x-auto -mx-4`
3. **Dashboard.tsx** - Grid de 5 cards `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5` esta ok mas os valores monetarios grandes podem estourar
4. **Clientes.tsx** - Tabela com `overflow-x-auto` pode causar scroll horizontal
5. **Admin.tsx** - Tabelas de relatorios por usuario (clientes e contratos) usam `overflow-x-auto` sem versao mobile em cards

### Solucao

| Arquivo | Alteracao |
|---|---|
| `src/pages/Parcelas.tsx` | Filtro de periodo: inputs de data com `w-full` no mobile e `w-[140px]` no desktop; wrapper do container com `overflow-x-hidden` |
| `src/pages/Contratos.tsx` | Listagem principal: converter para cards no mobile (`md:hidden` / `hidden md:block`), similar ao padrao ja usado em Parcelas.tsx |
| `src/pages/Clientes.tsx` | Ja esta razoavel - apenas garantir `max-w-full` no container raiz |
| `src/pages/Dashboard.tsx` | Adicionar `break-all` ou `truncate` nos valores monetarios dos cards; ajustar grid para `grid-cols-2` no mobile |
| `src/pages/Admin.tsx` | Tabelas de relatorio: esconder colunas menos importantes no mobile; adicionar `min-w-0` nos containers |
| `src/index.css` | Adicionar regra global `html, body { overflow-x: hidden }` para prevenir scroll horizontal em qualquer pagina |

### Detalhes das alteracoes

**1. `src/index.css`** - Regra global anti-scroll horizontal:
```css
html, body { overflow-x: hidden; }
```

**2. `src/pages/Parcelas.tsx`**:
- Inputs de data no filtro de periodo: `className="w-full sm:w-[140px]"` em vez de `w-[140px]`
- Container dos inputs: `flex flex-col sm:flex-row` em vez de `flex flex-wrap`

**3. `src/pages/Contratos.tsx`**:
- Listagem principal: adicionar view mobile em cards (`md:hidden`) com nome do cliente, valor total, periodicidade e percentual
- Manter tabela desktop como `hidden md:block`

**4. `src/pages/Dashboard.tsx`**:
- Grid de cards: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` com valores usando `truncate`

**5. `src/pages/Admin.tsx`**:
- Tabelas de relatorio: esconder coluna "Telefone" e "Parcelas" no mobile com `hidden sm:table-cell`

