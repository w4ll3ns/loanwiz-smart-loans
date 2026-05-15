import type { TipoJuros } from "@/lib/calculos";

export interface Contrato {
  id: string;
  cliente_id: string;
  clientes?: { nome: string };
  valor_emprestado: number;
  percentual: number;
  periodicidade: "diario" | "semanal" | "quinzenal" | "mensal";
  numero_parcelas: number;
  data_emprestimo: string;
  valor_total: number;
  status: string;
  tipo_juros?: TipoJuros;
  permite_cobranca_sabado?: boolean;
  permite_cobranca_domingo?: boolean;
  observacoes?: string | null;
}

export interface Parcela {
  id: string;
  contrato_id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  status: string;
  data_pagamento: string | null;
  valor_pago: number | null;
  valor_original: number | null;
}