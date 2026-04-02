
-- Create a security definer function to check if user is active
CREATE OR REPLACE FUNCTION public.is_user_active(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_user_id
      AND ativo = true
      AND status_plano IN ('teste', 'ativo')
      AND (status_plano != 'teste' OR data_expiracao_teste >= CURRENT_DATE)
  )
$$;

-- Drop old INSERT policies
DROP POLICY IF EXISTS "Users can create their own clientes" ON public.clientes;
DROP POLICY IF EXISTS "Users can create contratos for their own clientes" ON public.contratos;
DROP POLICY IF EXISTS "Users can create parcelas for their own contratos" ON public.parcelas;

-- Recreate INSERT policies with subscription check
CREATE POLICY "Users can create their own clientes"
ON public.clientes FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.is_user_active(auth.uid())
);

CREATE POLICY "Users can create contratos for their own clientes"
ON public.contratos FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM clientes
    WHERE clientes.id = contratos.cliente_id
      AND clientes.user_id = auth.uid()
  )
  AND public.is_user_active(auth.uid())
);

CREATE POLICY "Users can create parcelas for their own contratos"
ON public.parcelas FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM contratos
    JOIN clientes ON clientes.id = contratos.cliente_id
    WHERE contratos.id = parcelas.contrato_id
      AND clientes.user_id = auth.uid()
  )
  AND public.is_user_active(auth.uid())
);
