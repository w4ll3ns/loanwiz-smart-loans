-- Atualizar constraint para incluir o novo tipo 'parcela'
ALTER TABLE public.contratos 
DROP CONSTRAINT IF EXISTS contratos_tipo_juros_check;

ALTER TABLE public.contratos
ADD CONSTRAINT contratos_tipo_juros_check 
CHECK (tipo_juros IN ('simples', 'parcela', 'composto'));