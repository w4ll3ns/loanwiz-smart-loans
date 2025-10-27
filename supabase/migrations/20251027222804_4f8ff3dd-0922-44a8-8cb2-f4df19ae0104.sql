-- Criar tabela de histórico de pagamentos
CREATE TABLE public.parcelas_pagamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parcela_id UUID NOT NULL REFERENCES public.parcelas(id) ON DELETE CASCADE,
  valor_pago NUMERIC NOT NULL,
  tipo_pagamento TEXT NOT NULL CHECK (tipo_pagamento IN ('total', 'juros', 'parcial')),
  data_pagamento TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.parcelas_pagamentos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own payment history"
ON public.parcelas_pagamentos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.parcelas p
    JOIN public.contratos c ON p.contrato_id = c.id
    JOIN public.clientes cl ON c.cliente_id = cl.id
    WHERE p.id = parcelas_pagamentos.parcela_id
    AND cl.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create payment history for their parcelas"
ON public.parcelas_pagamentos
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.parcelas p
    JOIN public.contratos c ON p.contrato_id = c.id
    JOIN public.clientes cl ON c.cliente_id = cl.id
    WHERE p.id = parcelas_pagamentos.parcela_id
    AND cl.user_id = auth.uid()
  )
);

-- Criar índice para melhor performance
CREATE INDEX idx_parcelas_pagamentos_parcela_id ON public.parcelas_pagamentos(parcela_id);

-- Adicionar coluna para armazenar o valor original da parcela
ALTER TABLE public.parcelas ADD COLUMN IF NOT EXISTS valor_original NUMERIC;

-- Atualizar parcelas existentes com valor_original
UPDATE public.parcelas SET valor_original = valor WHERE valor_original IS NULL;