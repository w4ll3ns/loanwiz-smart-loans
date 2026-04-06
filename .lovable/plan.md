

## Sprint 4 — Usabilidade Avancada

### 4.1 Busca em Contratos
**Arquivo**: `src/pages/Contratos.tsx`
- Adicionar estado `searchTerm` e campo `Input` com icone `Search` acima da listagem (no CardHeader, ao lado dos filtros de status)
- Filtrar `contratosFiltrados` pelo nome do cliente usando busca accent-insensitive (mesmo padrao de Clientes/Parcelas com `removerAcentos` de `src/lib/calculos.ts`)

### 4.2 Paginacao nas listagens
**Arquivos**: `src/pages/Contratos.tsx`, `src/pages/Clientes.tsx`, `src/pages/Parcelas.tsx`
- Adicionar estados `currentPage` e `itemsPerPage` (20 por pagina)
- Paginar client-side sobre os dados ja filtrados (os dados ja sao carregados integralmente)
- Renderizar controles de paginacao com botoes "Anterior / Proximo" e indicador "Pagina X de Y" abaixo da listagem
- Esconder paginacao quando total de itens <= itemsPerPage

### 4.3 Skeleton de loading em Contratos
**Arquivo**: `src/pages/Contratos.tsx`
- Adicionar estado `loading` (true ate `loadContratos` completar)
- Renderizar `TableSkeleton` (desktop) e `CardListSkeleton` (mobile) do `LoadingSkeletons.tsx` enquanto carrega
- Mesmo padrao ja usado em Clientes e Parcelas

### 4.4 Confirmacao ao fechar formulario de contrato
**Arquivo**: `src/components/contratos/ContratoForm.tsx`
- Detectar se o formulario tem dados preenchidos (qualquer campo diferente do valor inicial)
- Ao tentar fechar o Dialog (via `onOpenChange(false)`), se houver dados, exibir `AlertDialog` de confirmacao: "Tem certeza que deseja fechar? Os dados preenchidos serao perdidos."
- Se confirmar, limpar form e fechar; se cancelar, manter aberto

### Detalhes tecnicos

- A busca usa `removerAcentos()` ja existente em `src/lib/calculos.ts`
- Paginacao e client-side (sem `.range()` do Supabase) pois os volumes de dados por usuario sao pequenos (< 1000)
- Skeletons reutilizam `TableSkeleton` e `CardListSkeleton` de `src/components/LoadingSkeletons.tsx`
- O `AlertDialog` de confirmacao usa o componente ja instalado em `src/components/ui/alert-dialog.tsx`

### Arquivos a editar
1. `src/pages/Contratos.tsx` — busca, paginacao, skeleton
2. `src/pages/Clientes.tsx` — paginacao
3. `src/pages/Parcelas.tsx` — paginacao
4. `src/components/contratos/ContratoForm.tsx` — confirmacao ao fechar

