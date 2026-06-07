# Refletir saídas de capital no calendário

A RPC já retorna os novos campos. É necessário apenas atualizar o frontend (3 arquivos) para exibi-los. Tudo em pt-BR com 2 casas, mantendo tema claro/escuro e responsividade.

## 1. Tipos
Atualizar as definições de tipo (duplicadas em `src/pages/Calendario.tsx` e `src/components/calendario/MobileCalendarioView.tsx`, e em `DetalheDiaModal.tsx`):
- `DiaCalendario`: adicionar `valor_saida?: number;` e `qtd_saidas?: number;`
- `CalendarioMensal.totais` (em `Calendario.tsx`): adicionar `total_emprestado_mes?: number;` e `qtd_emprestimos_mes?: number;`
- `DiaDetalhes`: adicionar lista `emprestimos: Emprestimo[];` e em `totais` `total_emprestado?: number;` e `qtd_emprestimos?: number;`
- Novo tipo `Emprestimo`: `{ contrato_id: string; cliente_nome: string; valor_emprestado: number; numero_parcelas: number; percentual: number; periodicidade: string; data_emprestimo: string; }`

## 2. Célula do dia (entrada vs saída)
Em ambos os grids (desktop em `Calendario.tsx`, mobile em `MobileCalendarioView.tsx`):
- Ler `valorSaida = info?.valor_saida ?? 0`.
- Quando `valorSaida > 0`, exibir uma linha adicional na célula com o valor de saída em **vermelho** (`text-destructive`) precedido de uma seta para baixo (`ArrowDown` do lucide, ou caractere "↓"), **separado** do valor de entrada (que permanece verde/azul). Não somar os valores — mostrar ambos empilhados.
- Atualizar o `aria-label` para mencionar "emprestado {valor}" quando houver saída.
- No mobile, usar o formato compacto (`formatarCompacto`/equivalente) já usado para o valor de entrada.

## 3. Totais do mês
Em `Calendario.tsx`, nos cards de resumo (desktop com 4 cards e mobile com 2 cards):
- Adicionar um indicador **"Emprestado"** usando `totais.total_emprestado_mes` (valor) e `totais.qtd_emprestimos_mes` (contagem), em vermelho, com ícone de saída (`ArrowDownCircle`/`TrendingDown`).
- Desktop: a grade passa de `grid-cols-4` para `grid-cols-5` para acomodar o novo card (ou reorganizar mantendo responsividade). Mobile: adicionar o card "Emprestado" à grade de resumo.

## 4. Seção "Empréstimos do dia" no detalhe
Em `DetalheDiaModal.tsx` (e replicar o painel inline no `MobileCalendarioView.tsx`):
- Adicionar uma `section` "Empréstimos do dia" listando cada contrato concedido: nome do cliente, valor emprestado (vermelho), nº de parcelas e percentual. Botão "Ver contrato" reaproveitando `handleVerContrato`.
- Rodapé da seção com subtotal `totais.total_emprestado` em vermelho.
- Posicionar a seção após Recebimentos/Previstos.
- Incluir `emprestimos` na verificação `temConteudo` (para que dias só com empréstimo não mostrem "Nenhuma movimentação"). No mobile, considerar `total_emprestado` no bloco de resumo do dia adicionando uma linha "Emprestado".

## Detalhes técnicos
- Cores via tokens semânticos: entradas `text-success`/`text-primary`, saídas `text-destructive`. Sem cores hardcoded.
- Ícones do `lucide-react` já disponível.
- Formatação com o helper `formatBRL` existente em cada arquivo.
- Mudanças puramente de apresentação; nenhuma alteração de RPC ou lógica de negócio.

## Validação
Abrir `/calendario` no preview (desktop e mobile) e confirmar: células com saída mostram valor vermelho separado, card "Emprestado" nos totais, e a seção "Empréstimos do dia" no detalhe de um dia com contrato concedido.
