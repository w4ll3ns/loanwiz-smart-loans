-- Renomear a tabela para refletir seu novo propósito
ALTER TABLE public.parcelas_pagamentos RENAME TO parcelas_historico;

-- Adicionar coluna tipo_evento para identificar o tipo de registro
ALTER TABLE public.parcelas_historico 
ADD COLUMN tipo_evento TEXT NOT NULL DEFAULT 'pagamento';

-- Tornar valor_pago nullable pois nem todo evento terá valor
ALTER TABLE public.parcelas_historico 
ALTER COLUMN valor_pago DROP NOT NULL;

-- Adicionar colunas para registrar alterações de data
ALTER TABLE public.parcelas_historico 
ADD COLUMN data_vencimento_anterior DATE,
ADD COLUMN data_vencimento_nova DATE;

-- Adicionar constraint para validar tipo_evento
ALTER TABLE public.parcelas_historico
ADD CONSTRAINT parcelas_historico_tipo_evento_check 
CHECK (tipo_evento IN ('pagamento', 'alteracao_data', 'estorno'));

-- Atualizar as RLS policies (as policies antigas serão mantidas automaticamente com o novo nome da tabela)
-- Apenas renomeamos para clareza nos comentários
COMMENT ON TABLE public.parcelas_historico IS 'Histórico geral de eventos nas parcelas: pagamentos, alterações de data, estornos, etc.';

-- Criar índice para melhorar performance nas consultas por tipo de evento
CREATE INDEX idx_parcelas_historico_tipo_evento ON public.parcelas_historico(tipo_evento);
CREATE INDEX idx_parcelas_historico_parcela_tipo ON public.parcelas_historico(parcela_id, tipo_evento);