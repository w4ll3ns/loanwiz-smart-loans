-- Create customers table
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT,
  endereco TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contracts table
CREATE TABLE public.contratos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  valor_emprestado DECIMAL(12,2) NOT NULL,
  percentual DECIMAL(5,2) NOT NULL,
  data_emprestimo DATE NOT NULL,
  periodicidade TEXT NOT NULL CHECK (periodicidade IN ('diario', 'semanal', 'quinzenal', 'mensal')),
  numero_parcelas INTEGER NOT NULL,
  valor_total DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'quitado', 'cancelado')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create installments table
CREATE TABLE public.parcelas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  numero_parcela INTEGER NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'vencido')),
  data_pagamento DATE,
  valor_pago DECIMAL(12,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcelas ENABLE ROW LEVEL SECURITY;

-- Create policies for clientes
CREATE POLICY "Anyone can view clientes" 
ON public.clientes 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create clientes" 
ON public.clientes 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update clientes" 
ON public.clientes 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete clientes" 
ON public.clientes 
FOR DELETE 
USING (true);

-- Create policies for contratos
CREATE POLICY "Anyone can view contratos" 
ON public.contratos 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create contratos" 
ON public.contratos 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update contratos" 
ON public.contratos 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete contratos" 
ON public.contratos 
FOR DELETE 
USING (true);

-- Create policies for parcelas
CREATE POLICY "Anyone can view parcelas" 
ON public.parcelas 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create parcelas" 
ON public.parcelas 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update parcelas" 
ON public.parcelas 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete parcelas" 
ON public.parcelas 
FOR DELETE 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_clientes_updated_at
BEFORE UPDATE ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contratos_updated_at
BEFORE UPDATE ON public.contratos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_parcelas_updated_at
BEFORE UPDATE ON public.parcelas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_contratos_cliente_id ON public.contratos(cliente_id);
CREATE INDEX idx_contratos_data_emprestimo ON public.contratos(data_emprestimo);
CREATE INDEX idx_contratos_status ON public.contratos(status);

CREATE INDEX idx_parcelas_contrato_id ON public.parcelas(contrato_id);
CREATE INDEX idx_parcelas_data_vencimento ON public.parcelas(data_vencimento);
CREATE INDEX idx_parcelas_status ON public.parcelas(status);

-- Create function to generate installments
CREATE OR REPLACE FUNCTION public.gerar_parcelas(
  p_contrato_id UUID,
  p_numero_parcelas INTEGER,
  p_valor_parcela DECIMAL,
  p_data_inicio DATE,
  p_periodicidade TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i INTEGER;
  data_vencimento DATE;
BEGIN
  FOR i IN 1..p_numero_parcelas LOOP
    CASE p_periodicidade
      WHEN 'diario' THEN
        data_vencimento := p_data_inicio + (i * INTERVAL '1 day');
      WHEN 'semanal' THEN
        data_vencimento := p_data_inicio + (i * INTERVAL '1 week');
      WHEN 'quinzenal' THEN
        data_vencimento := p_data_inicio + (i * INTERVAL '15 days');
      WHEN 'mensal' THEN
        data_vencimento := p_data_inicio + (i * INTERVAL '1 month');
    END CASE;

    INSERT INTO public.parcelas (
      contrato_id,
      numero_parcela,
      valor,
      data_vencimento
    ) VALUES (
      p_contrato_id,
      i,
      p_valor_parcela,
      data_vencimento
    );
  END LOOP;
END;
$$;