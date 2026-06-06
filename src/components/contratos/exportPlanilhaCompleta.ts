import { supabase } from "@/integrations/supabase/client";
import { exportarXlsx, type PlanilhaAba } from "@/lib/exportXlsx";
import type { Contrato } from "./types";

const fmtMoeda = (v: number | null | undefined) =>
  v == null ? "" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtData = (d: string | null | undefined) => {
  if (!d) return "";
  // Datas tipo "date" (YYYY-MM-DD) → meio-dia local para evitar deslocamento de fuso
  const date = d.length === 10 ? new Date(`${d}T12:00:00`) : new Date(d);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR");
};

const fmtDataHora = (d: string | null | undefined) => {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR");
};

const statusLabel = (s: string) => {
  switch (s) {
    case "ativo": return "Ativo";
    case "quitado": return "Quitado";
    case "pago": return "Pago";
    case "pendente": return "Pendente";
    case "atrasado": return "Atrasado";
    case "parcialmente_pago": return "Parcialmente pago";
    default: return s;
  }
};

const eventoLabel = (e: string) => {
  switch (e) {
    case "pagamento": return "Pagamento";
    case "alteracao_data": return "Alteração de data";
    case "estorno": return "Estorno";
    default: return e;
  }
};

interface ParcelaRow {
  id: string;
  contrato_id: string;
  numero_parcela: number;
  valor: number;
  valor_original: number | null;
  data_vencimento: string;
  status: string;
  data_pagamento: string | null;
  valor_pago: number | null;
}

interface HistoricoRow {
  parcela_id: string;
  tipo_evento: string;
  tipo_pagamento: string | null;
  valor_pago: number | null;
  data_pagamento: string;
  data_vencimento_anterior: string | null;
  data_vencimento_nova: string | null;
  observacao: string | null;
}

/**
 * Busca parcelas e histórico dos contratos filtrados e gera o arquivo .xlsx
 * com as abas Contratos, Parcelas e Histórico.
 */
export async function exportarPlanilhaCompleta(contratos: Contrato[]) {
  const contratoIds = contratos.map((c) => c.id);
  const nomePorContrato = new Map(contratos.map((c) => [c.id, c.clientes?.nome || ""]));

  // Busca parcelas (em lotes para respeitar o limite do .in)
  const parcelas: ParcelaRow[] = [];
  for (let i = 0; i < contratoIds.length; i += 200) {
    const lote = contratoIds.slice(i, i + 200);
    const { data, error } = await supabase
      .from("parcelas")
      .select("id, contrato_id, numero_parcela, valor, valor_original, data_vencimento, status, data_pagamento, valor_pago")
      .in("contrato_id", lote)
      .order("numero_parcela");
    if (error) throw error;
    parcelas.push(...((data || []) as ParcelaRow[]));
  }

  const parcelaIds = parcelas.map((p) => p.id);
  const numeroParcelaPorId = new Map(parcelas.map((p) => [p.id, p.numero_parcela]));
  const contratoPorParcela = new Map(parcelas.map((p) => [p.id, p.contrato_id]));

  // Busca histórico em lotes
  const historico: HistoricoRow[] = [];
  for (let i = 0; i < parcelaIds.length; i += 200) {
    const lote = parcelaIds.slice(i, i + 200);
    if (lote.length === 0) break;
    const { data, error } = await supabase
      .from("parcelas_historico")
      .select("parcela_id, tipo_evento, tipo_pagamento, valor_pago, data_pagamento, data_vencimento_anterior, data_vencimento_nova, observacao")
      .in("parcela_id", lote)
      .order("data_pagamento");
    if (error) throw error;
    historico.push(...((data || []) as HistoricoRow[]));
  }

  // Aba Contratos
  const abaContratos: PlanilhaAba = {
    nome: "Contratos",
    headers: ["Cliente", "Valor Emprestado", "Percentual (%)", "Tipo de Juros", "Periodicidade", "Nº de Parcelas", "Data do Empréstimo", "Valor Total", "Status", "Observações"],
    rows: contratos.map((c) => [
      c.clientes?.nome || "",
      fmtMoeda(c.valor_emprestado),
      Number(c.percentual),
      c.tipo_juros || "simples",
      c.periodicidade,
      c.numero_parcelas,
      fmtData(c.data_emprestimo),
      fmtMoeda(c.valor_total),
      statusLabel(c.status),
      c.observacoes || "",
    ]),
  };

  // Aba Parcelas
  const abaParcelas: PlanilhaAba = {
    nome: "Parcelas",
    headers: ["Cliente", "Nº da Parcela", "Valor", "Valor Original", "Vencimento", "Status", "Data de Pagamento", "Valor Pago"],
    rows: parcelas.map((p) => [
      nomePorContrato.get(p.contrato_id) || "",
      p.numero_parcela,
      fmtMoeda(p.valor),
      fmtMoeda(p.valor_original),
      fmtData(p.data_vencimento),
      statusLabel(p.status),
      fmtData(p.data_pagamento),
      fmtMoeda(p.valor_pago),
    ]),
  };

  // Aba Histórico
  const abaHistorico: PlanilhaAba = {
    nome: "Histórico",
    headers: ["Cliente", "Nº da Parcela", "Tipo de Evento", "Tipo de Pagamento", "Valor Pago", "Data do Pagamento", "Vencimento Anterior", "Vencimento Novo", "Observação"],
    rows: historico.map((h) => {
      const contratoId = contratoPorParcela.get(h.parcela_id);
      return [
        (contratoId && nomePorContrato.get(contratoId)) || "",
        numeroParcelaPorId.get(h.parcela_id) ?? "",
        eventoLabel(h.tipo_evento),
        h.tipo_pagamento || "",
        fmtMoeda(h.valor_pago),
        fmtDataHora(h.data_pagamento),
        fmtData(h.data_vencimento_anterior),
        fmtData(h.data_vencimento_nova),
        h.observacao || "",
      ];
    }),
  };

  const hoje = new Date().toISOString().slice(0, 10);
  exportarXlsx(`contratos-parcelas-${hoje}.xlsx`, [abaContratos, abaParcelas, abaHistorico]);
}