import { supabase } from "@/integrations/supabase/client";

export interface RegistrarPagamentoParams {
  parcelaId: string;
  tipo: "total" | "juros" | "parcial";
  valor: number;
  dataPagamento: string;
  observacao?: string;
}

export interface PagamentoResult {
  valor_pago: number;
  novo_status: string;
  contrato_quitado: boolean;
}

export async function registrarPagamento(params: RegistrarPagamentoParams): Promise<PagamentoResult> {
  const { data, error } = await supabase.rpc("registrar_pagamento_parcela", {
    p_parcela_id: params.parcelaId,
    p_tipo: params.tipo,
    p_valor: params.valor,
    p_data_pagamento: params.dataPagamento,
    p_observacao: params.observacao || null,
  });

  if (error) throw error;
  return data as unknown as PagamentoResult;
}

export async function estornarPagamento(parcelaId: string): Promise<void> {
  const { error } = await supabase.rpc("estornar_pagamento_parcela", {
    p_parcela_id: parcelaId,
  });

  if (error) throw error;
}

export async function loadParcelasComContratos() {
  const { data, error } = await supabase
    .from("parcelas")
    .select(`
      *,
      contratos!inner(
        clientes!inner(nome),
        percentual,
        tipo_juros,
        valor_emprestado,
        numero_parcelas
      )
    `)
    .order("data_vencimento", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function loadHistoricoParcela(parcelaId: string) {
  const { data, error } = await supabase
    .from("parcelas_historico")
    .select("*")
    .eq("parcela_id", parcelaId)
    .order("data_pagamento", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function loadRecebidoHoje() {
  const hoje = new Date();
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0, 0);
  const fimHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59, 999);

  const { data, error } = await supabase
    .from("parcelas_historico")
    .select("valor_pago, parcela_id")
    .eq("tipo_evento", "pagamento")
    .gte("data_pagamento", inicioHoje.toISOString())
    .lt("data_pagamento", fimHoje.toISOString());

  if (error) throw error;
  return data || [];
}
