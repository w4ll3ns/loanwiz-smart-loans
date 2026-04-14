import { supabase } from "@/integrations/supabase/client";

export interface CriarContratoParams {
  clienteId: string;
  valorEmprestado: number;
  percentual: number;
  periodicidade: string;
  numeroParcelas: number;
  dataEmprestimo: string;
  tipoJuros: string;
  permiteSabado: boolean;
  permiteDomingo: boolean;
}

export async function criarContratoComParcelas(params: CriarContratoParams): Promise<string> {
  const { data, error } = await supabase.rpc("criar_contrato_com_parcelas", {
    p_cliente_id: params.clienteId,
    p_valor_emprestado: params.valorEmprestado,
    p_percentual: params.percentual,
    p_periodicidade: params.periodicidade,
    p_numero_parcelas: params.numeroParcelas,
    p_data_emprestimo: params.dataEmprestimo,
    p_tipo_juros: params.tipoJuros,
    p_permite_sabado: params.permiteSabado,
    p_permite_domingo: params.permiteDomingo,
  });

  if (error) throw error;
  return data as string;
}

export async function loadContratos() {
  const { data, error } = await supabase
    .from("contratos")
    .select("*, clientes(nome)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function loadClientes() {
  const { data, error } = await supabase
    .from("clientes")
    .select("id, nome")
    .order("nome");

  if (error) throw error;
  return data || [];
}

export async function loadParcelas(contratoId: string) {
  const { data, error } = await supabase
    .from("parcelas")
    .select("*")
    .eq("contrato_id", contratoId)
    .order("numero_parcela");

  if (error) throw error;
  return data || [];
}
