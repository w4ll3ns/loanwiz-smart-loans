

## Plano: Filtro de Status nos Contratos

### Alteracoes em `src/pages/Contratos.tsx`

**1. Novo estado**
- `statusFilter`: `"ativos"` | `"quitados"` | `"todos"` (padrao: `"ativos"`)

**2. Filtro na listagem**
- Criar `contratosFiltrados` derivado de `contratos` filtrando por `status`:
  - `"ativos"` → `status === "ativo"`
  - `"quitados"` → `status === "quitado"`
  - `"todos"` → sem filtro

**3. UI**
- Adicionar um grupo de botoes (ou Select) na area do header da Card de listagem, ao lado do titulo, com as opcoes: **Ativos**, **Quitados**, **Todos**
- Atualizar o titulo da card para refletir o filtro selecionado e a contagem correta (`contratosFiltrados.length`)
- Usar `contratosFiltrados` no `.map()` da tabela em vez de `contratos`

### Arquivo modificado
| Arquivo | Acao |
|---|---|
| `src/pages/Contratos.tsx` | Adicionar estado de filtro, logica de filtragem, e botoes de filtro na UI |

