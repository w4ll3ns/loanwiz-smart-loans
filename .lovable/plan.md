

# Relatório Flexível com Flags de Visibilidade

## Conceito

Transformar o componente `RelatorioAtrasados` em um gerador de relatórios flexível. Três switches/toggles no modal controlam quais colunas e dados aparecem no relatório:

- **Mostrar Pagas** — coluna "Pagas" (parcelas quitadas)
- **Mostrar Atrasadas** — coluna "Atrasadas" (vencidas e não pagas)
- **Mostrar Pendentes** — coluna "Pendentes" (ainda não vencidas)

O título do relatório se adapta automaticamente com base nos filtros ativos:
- Só atrasadas → "RELATÓRIO DE CONTRATOS ATRASADOS"
- Só pendentes → "RELATÓRIO DE CONTRATOS PENDENTES"
- Todas → "RELATÓRIO GERAL DE CONTRATOS"
- Atrasadas + Pendentes → "RELATÓRIO DE CONTRATOS EM ABERTO"

A lista de contratos exibidos no modal também filtra: se "Mostrar Atrasadas" está desligado e "Mostrar Pendentes" está ligado, mostra contratos que tenham pendentes (mesmo sem atrasadas).

## Mudanças técnicas

### `src/components/contratos/RelatorioAtrasados.tsx`

1. **Novo estado e interface de dados**:
   - Adicionar `parcPendentes` e `valorPendente` ao tipo `ContratoAtrasado`
   - Três estados booleanos: `showPagas`, `showAtrasadas` (default true), `showPendentes`
   - Na agregação de dados, contar também parcelas pendentes (status !== 'pago' e vencimento >= hoje)

2. **Filtro da lista no modal**:
   - Exibir apenas contratos que tenham dados relevantes para as flags ativas (ex: se só "Atrasadas" está ligado, filtra contratos com `parcAtrasadas > 0`)

3. **UI do modal** — adicionar 3 switches (usando `Switch` do shadcn) acima da lista de seleção, com labels curtos: "Pagas", "Atrasadas", "Pendentes"

4. **Geração HTML/PDF** — renderizar apenas as colunas cujas flags estão ativas:
   - Colunas dinâmicas na tabela (headers e células)
   - Resumo no topo mostra apenas os cards correspondentes às flags ativas
   - Título dinâmico conforme combinação de flags

### Nenhuma mudança em outros arquivos

## Detalhes de implementação

- Os switches ficam em uma linha horizontal compacta com `flex gap-4`, cada um com `Switch` + label
- A coluna "Valor Atrasado" aparece quando "Atrasadas" está ativo; adicionar "Valor Pendente" quando "Pendentes" está ativo
- O PDF e imagem usam arrays dinâmicos de colunas para montar headers e linhas
- Manter pelo menos uma flag ativa (desabilitar a última que restar)

