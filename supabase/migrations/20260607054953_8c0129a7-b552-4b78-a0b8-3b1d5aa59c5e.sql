REVOKE EXECUTE ON FUNCTION public.recalcular_parcelas_futuras(uuid, interval, boolean, boolean)
  FROM PUBLIC, anon, authenticated;

DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
      AND p.proname IN ('calendario_mensal','calendario_dia_detalhes',
                        'excluir_cliente','excluir_parcela','excluir_evento_historico',
                        'alterar_data_parcela')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn.sig);
  END LOOP;
END $$;