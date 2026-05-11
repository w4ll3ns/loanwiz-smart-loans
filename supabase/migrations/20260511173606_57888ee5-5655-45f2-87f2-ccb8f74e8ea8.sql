
-- Revoke from PUBLIC (default grantee) on all SECURITY DEFINER functions, then re-grant
-- to authenticated only where appropriate. Keep has_role / is_user_active accessible
-- because they are referenced from RLS policies evaluated as the calling role.

-- Triggers / internal-only: no client access at all
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_api_usage_log() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_api_usage(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_api_rate_limit(uuid, text, integer) FROM PUBLIC, anon, authenticated;

-- User-callable RPCs: revoke from PUBLIC/anon, grant to authenticated only
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
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn.sig);
  END LOOP;
END $$;
