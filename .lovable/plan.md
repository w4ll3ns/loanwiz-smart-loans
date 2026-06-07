Criar uma migration aditiva com `CREATE OR REPLACE FUNCTION public.dashboard_stats()` que adiciona a nova chave `valor_vencido` ao jsonb_build_object do bloco "-- Totais de parcelas". Todo o restante da função permanece idêntico.

**Detalhe técnico:**
A nova chave calcula o somatório do valor restante (valor_original - valor_pago) de todas as parcelas com status pendente ou parcialmente_pago cuja data_vencimento já passou (vencidas). Aproveita o mesmo FROM/JOIN/WHERE do bloco existente, portanto não há alteração de escopo ou performance adicional.

A migration não cria/altera tabelas nem policies — apenas substitui a definição da função existente de forma aditiva.