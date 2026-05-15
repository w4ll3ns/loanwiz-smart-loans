# Plano — Página /calendario

Adicionar página de calendário mensal mostrando recebimentos (passado) e previstos (hoje/futuro) por dia, com modal de detalhes.

## 1) Migration — 2 RPCs no Postgres

**`calendario_mensal(p_mes int, p_ano int) RETURNS jsonb`**
- `SECURITY DEFINER`, `SET search_path = public`.
- Valida `auth.uid()`, `p_mes 1..12`, `p_ano 2000..2100`.
- `generate_series` do 1º ao último dia do mês.
- Para cada dia: tipo (`passado` < hoje, `hoje` = hoje, `futuro` > hoje), valor (recebido se passado; saldo previsto se hoje/futuro), `qtd_movimentacoes`.
- `hoje`: adicionar `ja_recebido_hoje` (soma de `parcelas_historico` com `data_pagamento::date = CURRENT_DATE` e `tipo_evento='pagamento'`).
- Sempre retorna o dia mesmo com valor 0.
- Totais: `recebido_mes`, `previsto_mes`, `qtd_recebimentos_mes`, `qtd_previstos_mes`.
- Implementação com CTEs (`pagamentos_dia`, `previstos_dia`) agregando uma vez, depois `LEFT JOIN` na série de dias para evitar N+1.
- `REVOKE ... FROM PUBLIC, anon; GRANT EXECUTE TO authenticated`.

**`calendario_dia_detalhes(p_data date) RETURNS jsonb`**
- Validar auth.
- `recebimentos[]`: `parcelas_historico JOIN parcelas JOIN contratos JOIN clientes` (ownership), `data_pagamento::date = p_data`, `tipo_evento='pagamento'`. Inclui `evento_id`, `parcela_id`, `contrato_id`, `cliente_nome`, `numero_parcela`, `total_parcelas` (= `c.numero_parcelas`), `data_vencimento_parcela`, `valor_pago`, `tipo_pagamento`, `observacao`, `data_pagamento`. Ordenar por `data_pagamento ASC`.
- `previstos[]`: `parcelas` com `data_vencimento = p_data`, `status IN ('pendente','parcialmente_pago')`, ownership. `valor_previsto = COALESCE(valor_original, valor) - COALESCE(valor_pago, 0)`, `valor_ja_pago`, `dias_atraso = GREATEST(0, CURRENT_DATE - data_vencimento)`. Ordenar por `cliente_nome`.
- Totais agregados.
- `REVOKE/GRANT` padrão.

## 2) Frontend — `src/pages/Calendario.tsx`

- `PageHeader` "Calendário".
- Estado: `mesAtual` (Date), `dataSelecionada` (string|null), `isModalOpen`.
- Navegação de mês: botões `<` `>` ao redor de `format(mesAtual, "MMMM yyyy", { locale: ptBR })` capitalizado, botão "Hoje".
- 4 cards de resumo (mobile 2x2 / desktop 1x4): Recebido no mês (success), Previsto no mês (primary), Movimentações realizadas, Movimentações previstas.
- Grid 7 colunas com cabeçalho D S T Q Q S S; renderizar 42 células (6 semanas) começando no domingo anterior ao dia 1.
- Cada célula: altura mínima 70px mobile / 90px desktop, número no topo-esquerda, UM valor abaixo:
  - `passado` valor>0 → texto verde (`text-success` via design tokens).
  - `futuro` valor>0 → texto azul (`text-primary`).
  - `hoje` → previsto azul + abaixo (se `ja_recebido_hoje > 0`) "✓ R$ X já" verde menor.
  - valor=0 → célula vazia.
- Hoje: `border-2 border-primary` + leve fundo.
- Dias fora do mês: `text-muted-foreground/40`, sem valor, `disabled`.
- Hover desktop: `hover:bg-muted/50`. Click → abre modal.
- Acessibilidade: `<button>` com `aria-label` descritivo.
- Helper `formatarCompacto(valor)` → "R$ 1.2k" para mobile (text-[10px]); desktop usa formato pt-BR completo.
- Animação fade 200ms ao trocar mês; Skeleton em cada célula no loading; toast erro com retry.
- React Query: `['calendario', ano, mes]` staleTime 60s.

## 3) Frontend — `src/components/calendario/DetalheDiaModal.tsx`

- Dialog do shadcn. Título: data por extenso capitalizada. Subtítulo badge "Hoje"/"Dia passado"/"Dia futuro".
- Seção **Recebimentos** (se houver): por item — cliente (negrito), "Parcela N/T", badge tipo (Total/Juros/Parcial), valor verde, observação. Se `data_vencimento_parcela ≠ p_data`: badge "Pagamento antecipado" (venc futuro) ou "Pagamento atrasado" (venc passado). Botão "Ver contrato" → `navigate('/contratos')`. Footer "Total recebido".
- Seção **Previstos** (se houver): cliente, "Parcela N/T", valor azul. `dias_atraso > 0` → badge destrutiva. `valor_ja_pago > 0` → "Já pago: R$ Y · Falta: R$ Z". Botão "Baixar" → abre `PagamentoModal` existente passando a parcela.
- Estado vazio: ícone `CalendarOff` + "Nenhuma movimentação neste dia".
- Footer: botão Fechar.
- React Query: `['calendario-dia', dataSelecionada]`, `enabled: !!dataSelecionada && isModalOpen`.
- Após pagar/estornar via PagamentoModal: `queryClient.invalidateQueries({ queryKey: ['calendario'] })` e `['calendario-dia']` + invalidar queries de parcelas/dashboard já existentes.

## 4) Navegação e rota

- `src/components/Layout.tsx`: importar `CalendarDays`, adicionar `{ name: "Calendário", href: "/calendario", icon: CalendarDays }` ao `baseNavigation` entre Parcelas e (Perfil/Admin). Bottom nav mobile passa para 5 itens — ajustar padding/`text-[9px]` se necessário pra caber.
- `src/App.tsx`: importar `Calendario` e adicionar `<Route path="/calendario" element={<ProtectedRoute><Calendario /></ProtectedRoute>} />` acima do `*`.

## 5) Design system

Usar exclusivamente tokens HSL (`text-success`, `text-primary`, `text-destructive`, `text-muted-foreground`, `bg-muted`). Verificar se `--success` existe em `index.css`; se não, adicionar variável de cor verde no design system antes de usar.

## Critério de aceite

Conforme descrito no prompt: 4 cards corretos, 1 valor por dia (verde passado / azul hoje-futuro), navegação de mês, modal com seções condicionais, "Baixar" abre PagamentoModal e invalida cache, "Ver contrato" navega, mobile sem quebra, dias fora do mês atenuados e não clicáveis, sábado/domingo sem destaque diferente.
