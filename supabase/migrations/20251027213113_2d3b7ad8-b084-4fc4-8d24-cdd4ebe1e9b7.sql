-- Adicionar coluna tipo_juros na tabela contratos
ALTER TABLE public.contratos
ADD COLUMN tipo_juros text NOT NULL DEFAULT 'simples' CHECK (tipo_juros IN ('simples', 'composto'));