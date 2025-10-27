-- Add user_id to clientes table to link customers to authenticated users
ALTER TABLE public.clientes ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX idx_clientes_user_id ON public.clientes(user_id);

-- Drop existing overly permissive RLS policies on clientes
DROP POLICY IF EXISTS "Anyone can view clientes" ON public.clientes;
DROP POLICY IF EXISTS "Anyone can create clientes" ON public.clientes;
DROP POLICY IF EXISTS "Anyone can update clientes" ON public.clientes;
DROP POLICY IF EXISTS "Anyone can delete clientes" ON public.clientes;

-- Create secure RLS policies for clientes - users can only access their own customers
CREATE POLICY "Users can view their own clientes"
ON public.clientes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own clientes"
ON public.clientes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clientes"
ON public.clientes
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clientes"
ON public.clientes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Drop existing overly permissive RLS policies on contratos
DROP POLICY IF EXISTS "Anyone can view contratos" ON public.contratos;
DROP POLICY IF EXISTS "Anyone can create contratos" ON public.contratos;
DROP POLICY IF EXISTS "Anyone can update contratos" ON public.contratos;
DROP POLICY IF EXISTS "Anyone can delete contratos" ON public.contratos;

-- Create secure RLS policies for contratos - users can only access contracts for their own customers
CREATE POLICY "Users can view their own contratos"
ON public.contratos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clientes
    WHERE clientes.id = contratos.cliente_id
    AND clientes.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create contratos for their own clientes"
ON public.contratos
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clientes
    WHERE clientes.id = contratos.cliente_id
    AND clientes.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own contratos"
ON public.contratos
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clientes
    WHERE clientes.id = contratos.cliente_id
    AND clientes.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clientes
    WHERE clientes.id = contratos.cliente_id
    AND clientes.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own contratos"
ON public.contratos
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clientes
    WHERE clientes.id = contratos.cliente_id
    AND clientes.user_id = auth.uid()
  )
);

-- Drop existing overly permissive RLS policies on parcelas
DROP POLICY IF EXISTS "Anyone can view parcelas" ON public.parcelas;
DROP POLICY IF EXISTS "Anyone can create parcelas" ON public.parcelas;
DROP POLICY IF EXISTS "Anyone can update parcelas" ON public.parcelas;
DROP POLICY IF EXISTS "Anyone can delete parcelas" ON public.parcelas;

-- Create secure RLS policies for parcelas - users can only access installments for their own contracts
CREATE POLICY "Users can view their own parcelas"
ON public.parcelas
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.contratos
    JOIN public.clientes ON clientes.id = contratos.cliente_id
    WHERE contratos.id = parcelas.contrato_id
    AND clientes.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create parcelas for their own contratos"
ON public.parcelas
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contratos
    JOIN public.clientes ON clientes.id = contratos.cliente_id
    WHERE contratos.id = parcelas.contrato_id
    AND clientes.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own parcelas"
ON public.parcelas
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.contratos
    JOIN public.clientes ON clientes.id = contratos.cliente_id
    WHERE contratos.id = parcelas.contrato_id
    AND clientes.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contratos
    JOIN public.clientes ON clientes.id = contratos.cliente_id
    WHERE contratos.id = parcelas.contrato_id
    AND clientes.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own parcelas"
ON public.parcelas
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.contratos
    JOIN public.clientes ON clientes.id = contratos.cliente_id
    WHERE contratos.id = parcelas.contrato_id
    AND clientes.user_id = auth.uid()
  )
);

-- Recreate gerar_parcelas function with authentication and authorization checks
CREATE OR REPLACE FUNCTION public.gerar_parcelas(
  p_contrato_id uuid,
  p_numero_parcelas integer,
  p_valor_parcela numeric,
  p_data_inicio date,
  p_periodicidade text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i INTEGER;
  data_vencimento DATE;
  data_base DATE;
BEGIN
  -- Authentication check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Authorization check: verify user owns the contract
  IF NOT EXISTS (
    SELECT 1 FROM public.contratos c
    JOIN public.clientes cl ON c.cliente_id = cl.id
    WHERE c.id = p_contrato_id
    AND cl.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to generate installments for this contract';
  END IF;

  -- Input validation
  IF p_numero_parcelas <= 0 THEN
    RAISE EXCEPTION 'Number of installments must be positive';
  END IF;

  IF p_valor_parcela <= 0 THEN
    RAISE EXCEPTION 'Installment value must be positive';
  END IF;

  IF p_periodicidade NOT IN ('diario', 'semanal', 'quinzenal', 'mensal') THEN
    RAISE EXCEPTION 'Invalid periodicidade: %. Must be diario, semanal, quinzenal, or mensal', p_periodicidade;
  END IF;

  -- Calculate base date for first installment based on periodicity
  CASE p_periodicidade
    WHEN 'diario' THEN
      data_base := p_data_inicio + INTERVAL '1 day';
    WHEN 'semanal' THEN
      data_base := p_data_inicio + INTERVAL '1 week';
    WHEN 'quinzenal' THEN
      data_base := p_data_inicio + INTERVAL '15 days';
    WHEN 'mensal' THEN
      data_base := p_data_inicio + INTERVAL '1 month';
  END CASE;

  -- Generate installments
  FOR i IN 1..p_numero_parcelas LOOP
    CASE p_periodicidade
      WHEN 'diario' THEN
        data_vencimento := data_base + ((i - 1) * INTERVAL '1 day');
      WHEN 'semanal' THEN
        data_vencimento := data_base + ((i - 1) * INTERVAL '1 week');
      WHEN 'quinzenal' THEN
        data_vencimento := data_base + ((i - 1) * INTERVAL '15 days');
      WHEN 'mensal' THEN
        data_vencimento := data_base + ((i - 1) * INTERVAL '1 month');
    END CASE;

    INSERT INTO public.parcelas (
      contrato_id,
      numero_parcela,
      valor,
      data_vencimento,
      status
    ) VALUES (
      p_contrato_id,
      i,
      p_valor_parcela,
      data_vencimento,
      'pendente'
    );
  END LOOP;
END;
$$;