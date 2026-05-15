import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getLocalDateString } from "@/lib/utils";
import { calcularJurosParcela, calcularValorTotal, TipoJuros } from "@/lib/calculos";
import type { Contrato, Parcela } from "../types";

interface UseContratoDetailsArgs {
  contrato: Contrato | null;
  parcelas: Parcela[];
  onContratoUpdated: () => void;
  onParcelasUpdated: (contratoId: string) => void;
  onClose: () => void;
}

export function useContratoDetails({
  contrato,
  parcelas,
  onContratoUpdated,
  onParcelasUpdated,
  onClose,
}: UseContratoDetailsArgs) {
  const { toast } = useToast();

  // Delete
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Pagamento
  const [isPagamentoDialogOpen, setIsPagamentoDialogOpen] = useState(false);
  const [parcelaToPay, setParcelaToPay] = useState<Parcela | null>(null);
  const [tipoPagamento, setTipoPagamento] = useState<string>("total");
  const [valorPagamento, setValorPagamento] = useState<string>("");
  const [dataPagamento, setDataPagamento] = useState<string>("");

  // Editar juros
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    tipoJuros: "simples" as TipoJuros,
    percentual: "",
  });
  const [isEditLoading, setIsEditLoading] = useState(false);

  // Histórico
  const [historicoModalOpen, setHistoricoModalOpen] = useState(false);
  const [parcelaHistorico, setParcelaHistorico] = useState<Parcela | null>(null);
  const [historicoData, setHistoricoData] = useState<any[]>([]);

  // Editar data
  const [editarDataOpen, setEditarDataOpen] = useState(false);
  const [parcelaEditarData, setParcelaEditarData] = useState<any>(null);

  // Observações
  const [isEditingObs, setIsEditingObs] = useState(false);
  const [obsText, setObsText] = useState(contrato?.observacoes || "");
  const [isSavingObs, setIsSavingObs] = useState(false);

  const prevContratoId = useRef(contrato?.id);
  useEffect(() => {
    if (contrato && contrato.id !== prevContratoId.current) {
      setObsText(contrato.observacoes || "");
      setIsEditingObs(false);
    }
    prevContratoId.current = contrato?.id;
  }, [contrato]);

  const calcularJuros = (_parcela: Parcela) => {
    if (!contrato) return 0;
    return calcularJurosParcela(
      Number(contrato.valor_emprestado),
      contrato.numero_parcelas,
      Number(contrato.percentual)
    );
  };

  const handleSaveObs = async () => {
    if (!contrato) return;
    setIsSavingObs(true);
    try {
      const { error } = await supabase
        .from("contratos")
        .update({ observacoes: obsText || null })
        .eq("id", contrato.id);
      if (error) throw error;
      toast({ title: "Observações salvas" });
      setIsEditingObs(false);
      onContratoUpdated();
    } catch (error: any) {
      toast({ title: "Erro ao salvar observações", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingObs(false);
    }
  };

  const abrirEditarData = (parcela: Parcela) => {
    if (!contrato) return;
    setParcelaEditarData({
      id: parcela.id,
      data_vencimento: parcela.data_vencimento,
      data_vencimento_original: (parcela as any).data_vencimento_original,
      numero_parcela: parcela.numero_parcela,
      contratos: { clientes: { nome: contrato.clientes?.nome || "" } },
    });
    setEditarDataOpen(true);
  };

  const loadHistorico = async (parcela: Parcela) => {
    try {
      const { data, error } = await supabase
        .from("parcelas_historico")
        .select("*")
        .eq("parcela_id", parcela.id)
        .order("data_pagamento", { ascending: false });
      if (error) throw error;
      setParcelaHistorico(parcela as any);
      setHistoricoData(data || []);
      setHistoricoModalOpen(true);
    } catch (error: any) {
      toast({ title: "Erro ao carregar histórico", description: error.message, variant: "destructive" });
    }
  };

  const abrirModalPagamento = (parcela: Parcela) => {
    setParcelaToPay(parcela);
    setTipoPagamento("total");
    setValorPagamento(parcela.valor.toString());
    setDataPagamento(getLocalDateString());
    setIsPagamentoDialogOpen(true);
  };

  const handleConfirmarPagamento = async () => {
    if (!parcelaToPay || !contrato) return;
    try {
      const { registrarPagamento } = await import("@/services/parcelas");

      let tipo: "total" | "juros" | "parcial" = "total";
      let valor = 0;

      if (tipoPagamento === "total") {
        tipo = "total";
        valor = Number(parcelaToPay.valor_original || parcelaToPay.valor);
      } else if (tipoPagamento === "juros") {
        tipo = "juros";
        valor = calcularJuros(parcelaToPay);
      } else if (tipoPagamento === "personalizado") {
        tipo = "parcial";
        valor = Number(valorPagamento);
      }

      const result = await registrarPagamento({
        parcelaId: parcelaToPay.id,
        tipo,
        valor,
        dataPagamento,
      });

      toast({
        title: result.novo_status === "pago" ? "Parcela quitada!" : "Pagamento parcial registrado",
        description: result.novo_status === "pago"
          ? `Parcela quitada com R$ ${result.valor_pago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
          : `Valor pago: R$ ${result.valor_pago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      });

      if (result.contrato_quitado) {
        toast({ title: "Contrato quitado! 🎉", description: "Todas as parcelas foram pagas." });
      }

      setIsPagamentoDialogOpen(false);
      setParcelaToPay(null);
      onParcelasUpdated(contrato.id);
      onContratoUpdated();
    } catch (error: any) {
      toast({
        title: "Não foi possível processar o pagamento",
        description: "Verifique os valores informados e sua conexão.",
        variant: "destructive",
      });
    }
  };

  const handleDesfazerPagamento = async (parcelaId: string) => {
    if (!contrato) return;
    try {
      const { estornarPagamento } = await import("@/services/parcelas");
      await estornarPagamento(parcelaId);
      toast({ title: "Pagamentos desfeitos", description: "A parcela foi resetada." });
      onParcelasUpdated(contrato.id);
      onContratoUpdated();
    } catch (error: any) {
      toast({ title: "Erro", description: "Não foi possível desfazer.", variant: "destructive" });
    }
  };

  const abrirModalEdicao = () => {
    if (!contrato) return;
    setEditFormData({
      tipoJuros: (contrato.tipo_juros || "simples") as TipoJuros,
      percentual: String(contrato.percentual),
    });
    setIsEditDialogOpen(true);
  };

  const calcularPreviewEdicao = () => {
    if (!contrato) return null;
    const valor = Number(contrato.valor_emprestado);
    const percent = editFormData.percentual ? parseFloat(editFormData.percentual) : Number(contrato.percentual);
    const numParcelas = contrato.numero_parcelas;
    if (!valor || !percent || !numParcelas) return null;

    const valorTotalNovo = calcularValorTotal(valor, percent, numParcelas, editFormData.tipoJuros);
    const parcelasPagas = parcelas.filter(p => p.status === "pago");
    const parcelasPendentes = parcelas.filter(p => p.status === "pendente");
    const valorJaPago = parcelasPagas.reduce((acc, p) => acc + Number(p.valor_pago || 0), 0);
    const valorRestante = valorTotalNovo - valorJaPago;
    const valorNovaParcela = parcelasPendentes.length > 0 ? valorRestante / parcelasPendentes.length : 0;

    return {
      valorTotalAnterior: Number(contrato.valor_total),
      valorTotalNovo,
      valorJaPago,
      valorRestante,
      valorNovaParcela,
      parcelasPagas: parcelasPagas.length,
      parcelasPendentes: parcelasPendentes.length,
    };
  };

  const handleEditContrato = async () => {
    if (!contrato) return;
    setIsEditLoading(true);
    try {
      const { error } = await supabase.rpc("recalcular_contrato_parcelas", {
        p_contrato_id: contrato.id,
        p_tipo_juros: editFormData.tipoJuros,
        p_percentual: editFormData.percentual ? parseFloat(editFormData.percentual) : null,
      });
      if (error) throw error;
      toast({ title: "Contrato atualizado", description: "Parcelas recalculadas com sucesso." });
      setIsEditDialogOpen(false);
      onContratoUpdated();
      onParcelasUpdated(contrato.id);
    } catch (error: any) {
      toast({ title: "Erro ao editar contrato", description: error.message, variant: "destructive" });
    } finally {
      setIsEditLoading(false);
    }
  };

  const handleDeleteContrato = async () => {
    if (!contrato) return;
    try {
      const { error } = await supabase.rpc("excluir_contrato", { p_contrato_id: contrato.id });
      if (error) throw error;
      toast({ title: "Contrato excluído", description: "Contrato e parcelas removidos." });
      setIsDeleteDialogOpen(false);
      onClose();
      onContratoUpdated();
    } catch (error: any) {
      const msg = String(error?.message || "");
      let descricao = "Não foi possível excluir.";
      if (msg.includes("Cannot delete contract with payments")) {
        descricao = "Este contrato já possui pagamentos registrados e não pode ser excluído.";
      } else if (msg.includes("Cannot delete a settled contract")) {
        descricao = "Contratos quitados não podem ser excluídos.";
      } else if (msg.includes("Not authorized")) {
        descricao = "Você não tem permissão para excluir este contrato.";
      }
      toast({ title: "Erro ao excluir", description: descricao, variant: "destructive" });
      setIsDeleteDialogOpen(false);
    }
  };

  return {
    // delete
    isDeleteDialogOpen, setIsDeleteDialogOpen, handleDeleteContrato,
    // pagamento
    isPagamentoDialogOpen, setIsPagamentoDialogOpen,
    parcelaToPay, tipoPagamento, setTipoPagamento,
    valorPagamento, setValorPagamento,
    dataPagamento, setDataPagamento,
    abrirModalPagamento, handleConfirmarPagamento,
    handleDesfazerPagamento,
    calcularJuros,
    // editar juros
    isEditDialogOpen, setIsEditDialogOpen,
    editFormData, setEditFormData,
    isEditLoading, abrirModalEdicao, handleEditContrato,
    calcularPreviewEdicao,
    // histórico
    historicoModalOpen, setHistoricoModalOpen,
    parcelaHistorico, historicoData, loadHistorico,
    // editar data
    editarDataOpen, setEditarDataOpen,
    parcelaEditarData, abrirEditarData,
    // observações
    isEditingObs, setIsEditingObs,
    obsText, setObsText,
    isSavingObs, handleSaveObs,
  };
}