-- Adicionar coluna para justificativa de alteração de data na tabela parcelas
ALTER TABLE public.parcelas 
ADD COLUMN IF NOT EXISTS justificativa_alteracao_data TEXT;

-- Adicionar coluna para armazenar a data de vencimento original
ALTER TABLE public.parcelas 
ADD COLUMN IF NOT EXISTS data_vencimento_original DATE;