
CREATE POLICY "Users can view their own api usage"
  ON public.api_usage_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own api usage"
  ON public.api_usage_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Block direct inserts to audit_logs"
  ON public.audit_logs AS RESTRICTIVE FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "Block direct updates to audit_logs"
  ON public.audit_logs AS RESTRICTIVE FOR UPDATE
  TO authenticated, anon
  USING (false);

CREATE POLICY "Block direct deletes from audit_logs"
  ON public.audit_logs AS RESTRICTIVE FOR DELETE
  TO authenticated, anon
  USING (false);

CREATE POLICY "Only admins can insert roles"
  ON public.user_roles AS RESTRICTIVE FOR INSERT
  TO authenticated, anon
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update roles"
  ON public.user_roles AS RESTRICTIVE FOR UPDATE
  TO authenticated, anon
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete roles"
  ON public.user_roles AS RESTRICTIVE FOR DELETE
  TO authenticated, anon
  USING (public.has_role(auth.uid(), 'admin'::app_role));

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_api_usage_log() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_api_usage(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_api_rate_limit(uuid, text, integer) FROM anon, authenticated;

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname IN (
        'admin_get_global_stats',
        'admin_get_user_clientes',
        'admin_get_user_contratos',
        'admin_get_user_stats',
        'insert_audit_log',
        'update_own_profile',
        'recalcular_contrato_parcelas',
        'criar_contrato_com_parcelas',
        'registrar_pagamento_parcela',
        'estornar_pagamento_parcela',
        'dashboard_stats',
        'excluir_contrato',
        'gerar_parcelas'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn.sig);
  END LOOP;
END $$;
