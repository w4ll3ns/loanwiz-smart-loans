# Calendário mobile: lista inline + pontos coloridos + RPC com atrasados

Reformular a UX do calendário **apenas em mobile** (< md). Desktop fica intocado. Aproveitar para corrigir bug da RPC `calendario_mensal` que omite atrasados.

## 1. Migration: `calendario_mensal` com atrasados

Nova migration que substitui apenas a função `calendario_mensal` (timezone já foi corrigido — manter `America/Sao_Paulo`).

Mudanças no CTE `computado` e no JSON:

- `valor` continua: recebido para passado, previsto para hoje/futuro.
- Novos campos por dia:
  - `valor_atrasado` numeric — `COALESCE(pr.valor, 0)` quando `dia < CURRENT_DATE`, senão 0.
  - `qtd_atrasados` int — análogo com `pr.qtd`.
- Sempre incluir os 6 campos no `jsonb_build_object` (drop o CASE hoje vs resto; manter `ja_recebido_hoje` zerado quando não for hoje).
- Novos totais: `total_atrasado_mes`, `qtd_atrasados_mes` (somar somente quando `tipo = 'passado'`).

Permissões: `REVOKE ALL ... FROM PUBLIC; GRANT EXECUTE ... TO authenticated;`.

## 2. Frontend

### 2.1 `src/components/calendario/MobileCalendarioView.tsx` (novo)

Props: `dias`, `mesAtual`, `dataSelecionada`, `onSelectDia`, `onAbrirModal`, `isLoading`.

- Header sticky com "D S T Q Q S S".
- Grid 7 col, 6 semanas. Dias fora do mês = `<div aria-hidden />` vazio.
- Cada dia do mês: `<button>` `aspect-square min-h-[44px] flex flex-col items-center justify-center`:
  - Número centralizado.
  - Linha de até 3 pontos (`h-1.5 w-1.5 rounded-full gap-0.5`):
    - verde (`bg-success`) — recebimento (`valor>0 && tipo='passado'`) ou (`tipo='hoje' && ja_recebido_hoje>0`).
    - azul (`bg-primary`) — previsto (`valor>0 && tipo!='passado'`).
    - laranja (`bg-destructive`) — `valor_atrasado>0`.
  - Hoje: `border-2 border-primary font-bold`.
  - Selecionado: `bg-muted font-semibold`.
  - Hoje + selecionado: ambos.
  - `aria-label`, `aria-selected`, `aria-current="date"`.
- Loading: skeletons pulsando.

Bloco de detalhes abaixo do grid:

- Header: "Quinta-feira, 15 de Maio" (capitalizado, ptBR) + botão ghost "Ver tudo" com `ExternalLink` → `onAbrirModal`.
- Linhas de totais (omitir as zeradas):
  - `Check` verde — Recebido: valor + (qtd).
  - `Clock` azul — Previsto: valor + (qtd).
  - `AlertTriangle` laranja — Atrasados: valor + (qtd).
- Lista das movimentações: `useQuery(['calendario-dia', dataSelecionada], rpc calendario_dia_detalhes)`, `enabled: !!dataSelecionada`.
  - Seção Recebimentos: cards compactos (cliente bold, "Parcela X/Y" + badge tipo, antecipado/atrasado, valor verde à direita). Sem botão "Ver contrato" inline.
  - Seção Previstos: cards com cliente, parcela, badge atraso, valor azul, e dois botões `flex-1`: "Baixar" (abre `PagamentoModal` local) e "Ver contrato" (`navigate(/contratos?open=...)`).
  - Vazio: `CalendarOff` + "Nenhuma movimentação neste dia.".
  - Loading: 2 skeletons.
- Reaproveita `PagamentoModal`; `onPagamentoConfirmado` invalida `['calendario']`, `['calendario-dia']`, `['parcelas']`, `['dashboard-stats']` (mesmas keys do modal atual), sem fechar nada.

### 2.2 `src/pages/Calendario.tsx`

- Estender tipo `DiaCalendario` com `valor_atrasado: number` e `qtd_atrasados: number` (+ totais novos no `CalendarioMensal`).
- Estado `dataSelecionada: string` (default = hoje em ISO local). Sincronizar ao trocar mês: hoje se for o mês atual, senão dia 1.
- `onSelectDia(iso)` apenas atualiza estado (não abre modal).
- Renderização condicional:
  - `<div className="md:hidden">`: cards de resumo reduzidos a 2 (Recebido/Previsto, grid 2 col) + `<MobileCalendarioView/>`.
  - `<div className="hidden md:block">`: 4 cards + grid atual exatamente como hoje (clique abre modal).
- `DetalheDiaModal` continua sendo aberto:
  - Em desktop: ao clicar célula (igual hoje).
  - Em mobile: somente via "Ver tudo" do bloco mobile.

## 3. Critérios de aceite

- Mobile: pontos coloridos (sem R$), tap seleciona, lista atualiza inline, "Ver tudo" abre modal.
- Parcela vencida e não paga aparece como ponto laranja no dia do vencimento; tocar mostra na lista de atrasados.
- Hoje + selecionado mostra borda azul + fundo cinza.
- Pagamento via "Baixar" inline atualiza lista sozinho.
- Desktop idêntico ao atual.

## Detalhes técnicos

- Cache compartilhado: queryKey `['calendario-dia', data]` é a mesma usada pelo modal — ao abrir "Ver tudo" não há refetch.
- Não criar nova RPC para a lista; usa `calendario_dia_detalhes`.
- Não tocar em bottom nav, page header, navegação de mês, nem no `DetalheDiaModal`.
