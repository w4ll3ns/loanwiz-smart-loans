-- Adicionar política de DELETE para parcelas_pagamentos
CREATE POLICY "Users can delete their own payment history" 
ON parcelas_pagamentos 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1
    FROM parcelas p
    JOIN contratos c ON p.contrato_id = c.id
    JOIN clientes cl ON c.cliente_id = cl.id
    WHERE p.id = parcelas_pagamentos.parcela_id
    AND cl.user_id = auth.uid()
  )
);