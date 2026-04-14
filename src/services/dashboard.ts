import { supabase } from "@/integrations/supabase/client";

export interface DashboardData {
  total_emprestado: number;
  total_receber: number;
  total_recebido: number;
  lucro: number;
  clientes_ativos: number;
  contratos_ativos: number;
  parcelas_vencidas: number;
  proximos_vencimentos: Array<{
    cliente: string;
    valor: number;
    data: string;
    status: "vencido" | "vence_hoje" | "proximo";
  }>;
  lucro_mensal: Array<{
    mes: string;
    lucro: number;
  }>;
  status_distribuicao: Array<{
    name: string;
    value: number;
  }>;
  capital_mensal: Array<{
    mes: string;
    emprestado: number;
    recebido: number;
  }>;
}

export async function loadDashboardStats(): Promise<DashboardData> {
  const { data, error } = await supabase.rpc("dashboard_stats");

  if (error) throw error;
  return data as unknown as DashboardData;
}
