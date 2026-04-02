import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Check, X, Calendar, AlertTriangle, Trash2, Undo2, FileText, Banknote, TrendingUp } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { AccessRestrictedModal } from "@/components/AccessRestrictedModal";

import { getLocalDateString } from "@/lib/utils";

interface Parcela {
  id: string;
  contrato_id: string;
  numero_parcela: number;
  valor: number;
  valor_original: number;
  data_vencimento: string;
  data_vencimento_original?: string;
  data_pagamento?: string;
  valor_pago?: number;
  status: string;
  contratos?: {
    clientes?: {
      nome: string;
    };
    percentual?: number;
    tipo_juros?: string;
    valor_emprestado?: number;
    numero_parcelas?: number;
  };
}

interface HistoricoParcela {
  id: string;
  data_pagamento: string;
  valor_pago: number | null;
  tipo_pagamento: string | null;
  observacao: string | null;
  created_at: string;
  tipo_evento: string;
  data_vencimento_anterior: string | null;
  data_vencimento_nova: string | null;
}

export default function Parcelas() {
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pendente");
  const [mostrarTodas, setMostrarTodas] = useState(false);
  const [dataInicioDashboard, setDataInicioDashboard] = useState<string>("");
  const [dataFimDashboard, setDataFimDashboard] = useState<string>("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [parcelaToDelete, setParcelaToDelete] = useState<string | null>(null);
  const [isPagamentoDialogOpen, setIsPagamentoDialogOpen] = useState(false);
  const [isHistoricoDialogOpen, setIsHistoricoDialogOpen] = useState(false);
  const [isEditarDataDialogOpen, setIsEditarDataDialogOpen] = useState(false);
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [parcelaToPay, setParcelaToPay] = useState<Parcela | null>(null);
  const [parcelaHistorico, setParcelaHistorico] = useState<Parcela | null>(null);
  const [parcelaToEditData, setParcelaToEditData] = useState<Parcela | null>(null);
  const [historico, setHistorico] = useState<HistoricoParcela[]>([]);
  const [filtroTipoEvento, setFiltroTipoEvento] = useState<string>("todos");
  const [tipoPagamento, setTipoPagamento] = useState<string>("total");
  const [valorPagamento, setValorPagamento] = useState<string>("");
  const [observacaoPagamento, setObservacaoPagamento] = useState<string>("");
  const [novaDataVencimento, setNovaDataVencimento] = useState<string>("");
  const [justificativaAlteracao, setJustificativaAlteracao] = useState<string>("");
  const [dataPagamento, setDataPagamento] = useState<string>("");
  const [totalRecebidoHoje, setTotalRecebidoHoje] = useState<number>(0);
  const [pagamentosHoje, setPagamentosHoje] = useState<number>(0);
  const [parcelasRecebidoHojeIds, setParcelasRecebidoHojeIds] = useState<string[]>([]);
  const [cardFilter, setCardFilter] = useState<"recebido_hoje" | "vencido" | null>(null);
  const { toast } = useToast();
  const { canCreate, userEmail } = useUserRole();

  // Função para remover acentos (busca normalizada)
  const removerAcentos = (texto: string): string => {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  // Função para formatar data corretamente (evita problema de timezone)
  const formatDate = (dateString: string) => {
    return format(new Date(dateString + 'T00:00:00'), 'dd/MM/yyyy');
  };

  useEffect(() => {
    loadParcelas();
    loadRecebidoHoje();
  }, []);

  const loadRecebidoHoje = async () => {
    try {
      // Criar limites do dia LOCAL em formato ISO (com timezone correto)
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

      const total = data?.reduce((acc, p) => acc + (Number(p.valor_pago) || 0), 0) || 0;
      setTotalRecebidoHoje(total);
      setPagamentosHoje(data?.length || 0);
      const ids = [...new Set(data?.map(p => p.parcela_id) || [])];
      setParcelasRecebidoHojeIds(ids);
    } catch (error) {
      console.error("Erro ao carregar recebidos hoje:", error);
    }
  };

  const loadParcelas = async () => {
    try {
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
      setParcelas(data || []);
    } catch (error: any) {
      toast({
        title: "Não foi possível carregar as parcelas",
        description: "Verifique sua conexão com a internet e tente novamente.",
        variant: "destructive",
      });
    }
  };

  const calcularDiasAtraso = (dataVencimento: string) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const vencimento = new Date(dataVencimento + 'T00:00:00');
    const diffTime = hoje.getTime() - vencimento.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  // Filtro para o dashboard (apenas por período de datas)
  const dashboardParcelas = parcelas.filter(parcela => {
    if (!dataInicioDashboard && !dataFimDashboard) {
      return true; // Mostra tudo se não tiver período definido
    }
    
    const dataVencimento = new Date(parcela.data_vencimento + 'T00:00:00');
    
    if (dataInicioDashboard && dataFimDashboard) {
      const dataInicio = new Date(dataInicioDashboard + 'T00:00:00');
      const dataFim = new Date(dataFimDashboard + 'T23:59:59');
      return dataVencimento >= dataInicio && dataVencimento <= dataFim;
    } else if (dataInicioDashboard) {
      const dataInicio = new Date(dataInicioDashboard + 'T00:00:00');
      return dataVencimento >= dataInicio;
    } else if (dataFimDashboard) {
      const dataFim = new Date(dataFimDashboard + 'T23:59:59');
      return dataVencimento <= dataFim;
    }
    
    return true;
  });

  // Filtro para a lista (por busca, status e período de 7 dias)
  const filteredParcelas = parcelas.filter(parcela => {
    // Se um card filter está ativo, aplicar filtro específico
    if (cardFilter === "recebido_hoje") {
      return parcelasRecebidoHojeIds.includes(parcela.id);
    }
    if (cardFilter === "vencido") {
      return (parcela.status === "pendente" || parcela.status === "parcialmente_pago") && calcularDiasAtraso(parcela.data_vencimento) > 0;
    }

    const clienteNome = parcela.contratos?.clientes?.nome || "";
    const matchesSearch = removerAcentos(clienteNome.toLowerCase()).includes(removerAcentos(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "todos" || parcela.status === statusFilter;
    
    // Filtrar por data - próximos 7 dias se não estiver mostrando todas
    if (!mostrarTodas) {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const dataLimite = new Date();
      dataLimite.setDate(hoje.getDate() + 7);
      dataLimite.setHours(23, 59, 59, 999);
      const dataVencimento = new Date(parcela.data_vencimento + 'T00:00:00');
      
      // Sempre mostrar parcelas vencidas (status pendente e data no passado)
      const estaVencida = parcela.status === "pendente" && dataVencimento < hoje;
      const dentroDosPróximos7Dias = dataVencimento >= hoje && dataVencimento <= dataLimite;
      
      return matchesSearch && matchesStatus && (estaVencida || dentroDosPróximos7Dias);
    }
    
    return matchesSearch && matchesStatus;
  });

  const calcularJuros = (parcela: Parcela) => {
    const percentual = parcela.contratos?.percentual || 0;
    const numeroParcelas = parcela.contratos?.numero_parcelas || 1;
    const valorEmprestado = Number(parcela.contratos?.valor_emprestado || 0);
    
    // Juros calculados sobre o valor emprestado proporcional à parcela
    const valorPrincipalParcela = valorEmprestado / numeroParcelas;
    return (valorPrincipalParcela * percentual) / 100;
  };

  const abrirModalPagamento = (parcela: Parcela) => {
    setParcelaToPay(parcela);
    setTipoPagamento("total");
    // Para quitação, usar o valor original completo
    const valorOriginal = Number(parcela.valor_original || parcela.valor);
    setValorPagamento(valorOriginal.toString());
    setObservacaoPagamento("");
    setDataPagamento(getLocalDateString());
    setIsPagamentoDialogOpen(true);
  };

  const handleConfirmarPagamento = async () => {
    if (!parcelaToPay) return;

    try {
      let valorPagar = 0;
      let tipoPag = tipoPagamento;
      const valorOriginal = Number(parcelaToPay.valor_original || parcelaToPay.valor);

      if (tipoPagamento === "total") {
        // Quitar a parcela - paga o valor original completo
        valorPagar = valorOriginal;
      } else if (tipoPagamento === "juros") {
        valorPagar = calcularJuros(parcelaToPay);
        tipoPag = "juros";
      } else if (tipoPagamento === "personalizado") {
        valorPagar = Number(valorPagamento);
        tipoPag = "parcial";
      }

      // Registrar pagamento no histórico
      const { error: historicoError } = await supabase
        .from("parcelas_historico")
        .insert({
          parcela_id: parcelaToPay.id,
          valor_pago: valorPagar,
          tipo_pagamento: tipoPag,
          data_pagamento: new Date().toISOString(),
          observacao: observacaoPagamento.trim() || null,
          tipo_evento: "pagamento",
        } as any);

      if (historicoError) throw historicoError;

      // Atualizar valor pago total (para registro/histórico)
      const novoValorPago = (Number(parcelaToPay.valor_pago) || 0) + valorPagar;
      
      // Determinar status - só marca como "pago" quando for quitação (pagamento total)
      const novoStatus = tipoPagamento === "total" ? "pago" : "pendente";

      // Atualizar parcela
      const updateData: any = {
        valor_pago: novoValorPago,
        status: novoStatus,
        data_pagamento: dataPagamento,
      };

      // Se não tiver valor_original ainda, definir
      if (!parcelaToPay.valor_original) {
        updateData.valor_original = parcelaToPay.valor;
      }

      const { error: updateError } = await supabase
        .from("parcelas")
        .update(updateData)
        .eq("id", parcelaToPay.id);

      if (updateError) throw updateError;

      toast({
        title: novoStatus === "pago" ? "Parcela quitada!" : "Pagamento parcial registrado",
        description: novoStatus === "pago"
          ? `Parcela quitada com R$ ${valorPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          : `Valor pago: R$ ${valorPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Ainda deve: R$ ${valorOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      });

      // Se a parcela foi marcada como paga, verificar se todas as parcelas do contrato estão pagas
      if (novoStatus === "pago" && parcelaToPay.contrato_id) {
        const { data: todasParcelas, error: parcelasError } = await supabase
          .from("parcelas")
          .select("status")
          .eq("contrato_id", parcelaToPay.contrato_id);

        if (!parcelasError && todasParcelas) {
          const todasPagas = todasParcelas.every(p => p.status === "pago");
          
          if (todasPagas) {
            // Atualizar status do contrato para quitado
            const { error: contratoError } = await supabase
              .from("contratos")
              .update({ status: "quitado" })
              .eq("id", parcelaToPay.contrato_id);

            if (!contratoError) {
              toast({
                title: "Contrato quitado! 🎉",
                description: "Todas as parcelas foram pagas. O contrato foi marcado como quitado.",
              });
            }
          }
        }
      }

      setIsPagamentoDialogOpen(false);
      setParcelaToPay(null);
      setTipoPagamento("total");
      setValorPagamento("");
      setObservacaoPagamento("");
      loadParcelas();
      loadRecebidoHoje();
    } catch (error: any) {
      toast({
        title: "Não foi possível processar o pagamento",
        description: "Verifique os valores informados e sua conexão com a internet.",
        variant: "destructive",
      });
    }
  };

  const handleMarcarPendente = async (parcelaId: string) => {
    try {
      // Deletar histórico de pagamentos (manter apenas alterações de data)
      const { error: deleteHistoricoError } = await supabase
        .from("parcelas_historico")
        .delete()
        .eq("parcela_id", parcelaId)
        .eq("tipo_evento", "pagamento");

      if (deleteHistoricoError) throw deleteHistoricoError;

      // Resetar parcela
      const { error } = await supabase
        .from("parcelas")
        .update({
          status: "pendente",
          data_pagamento: null,
          valor_pago: 0,
        })
        .eq("id", parcelaId);

      if (error) throw error;

      toast({
        title: "Pagamentos desfeitos",
        description: "A parcela foi resetada e o histórico de pagamentos foi limpo.",
      });

      loadParcelas();
    } catch (error: any) {
      toast({
        title: "Não foi possível desfazer os pagamentos",
        description: "Verifique sua conexão com a internet e tente novamente.",
        variant: "destructive",
      });
    }
  };

  const loadHistorico = async (parcela: Parcela) => {
    try {
      const { data, error } = await supabase
        .from("parcelas_historico")
        .select("*")
        .eq("parcela_id", parcela.id)
        .order("data_pagamento", { ascending: false });

      if (error) throw error;

      setHistorico(data || []);
      setParcelaHistorico(parcela);
      setFiltroTipoEvento("todos"); // Reset filter when opening
      setIsHistoricoDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Não foi possível carregar o histórico",
        description: "Verifique sua conexão com a internet e tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleExcluirPagamento = async (registroId: string) => {
    if (!parcelaHistorico) return;

    try {
      // Buscar o registro para saber o tipo
      const { data: registroData, error: fetchError } = await supabase
        .from("parcelas_historico")
        .select("tipo_evento")
        .eq("id", registroId)
        .single();

      if (fetchError) throw fetchError;

      // Deletar o registro específico
      const { error: deleteError } = await supabase
        .from("parcelas_historico")
        .delete()
        .eq("id", registroId);

      if (deleteError) throw deleteError;

      // Se for um pagamento, recalcular valores
      if (registroData.tipo_evento === "pagamento") {
        // Buscar pagamentos restantes
        const { data: pagamentosRestantes, error: fetchPagamentosError } = await supabase
          .from("parcelas_historico")
          .select("valor_pago")
          .eq("parcela_id", parcelaHistorico.id)
          .eq("tipo_evento", "pagamento");

        if (fetchPagamentosError) throw fetchPagamentosError;

        // Calcular novo total pago
        const novoValorPago = pagamentosRestantes?.reduce(
          (sum, p) => sum + Number(p.valor_pago || 0), 
          0
        ) || 0;

        const valorOriginal = Number(parcelaHistorico.valor_original || parcelaHistorico.valor);

        // Atualizar parcela
        const { error: updateError } = await supabase
          .from("parcelas")
          .update({
            valor_pago: novoValorPago,
            status: novoValorPago >= valorOriginal ? "pago" : "pendente",
            data_pagamento: novoValorPago >= valorOriginal ? getLocalDateString() : null,
          })
          .eq("id", parcelaHistorico.id);

        if (updateError) throw updateError;
      }

      toast({
        title: "Registro excluído",
        description: "O registro foi removido do histórico.",
      });

      // Recarregar histórico e parcelas
      await loadHistorico(parcelaHistorico);
      loadParcelas();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir registro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!parcelaToDelete) return;

    try {
      const { error } = await supabase
        .from("parcelas")
        .delete()
        .eq("id", parcelaToDelete);

      if (error) throw error;

      toast({
        title: "Parcela excluída",
        description: "Parcela removida com sucesso.",
      });

      setIsDeleteDialogOpen(false);
      setParcelaToDelete(null);
      loadParcelas();
    } catch (error: any) {
      toast({
        title: "Não foi possível excluir a parcela",
        description: "Verifique sua conexão com a internet e tente novamente.",
        variant: "destructive",
      });
    }
  };

  const abrirModalEditarData = (parcela: Parcela) => {
    setParcelaToEditData(parcela);
    setNovaDataVencimento(parcela.data_vencimento);
    setJustificativaAlteracao("");
    setIsEditarDataDialogOpen(true);
  };

  const handleEditarDataVencimento = async () => {
    if (!parcelaToEditData) return;

    if (!justificativaAlteracao.trim()) {
      toast({
        title: "Justificativa obrigatória",
        description: "Você deve informar o motivo da alteração da data de vencimento.",
        variant: "destructive",
      });
      return;
    }

    if (novaDataVencimento === parcelaToEditData.data_vencimento) {
      toast({
        title: "Data não alterada",
        description: "A nova data deve ser diferente da data atual.",
        variant: "destructive",
      });
      return;
    }

    try {
      const updateData: any = {
        data_vencimento: novaDataVencimento,
        justificativa_alteracao_data: justificativaAlteracao.trim(),
      };

      // Se ainda não tem data_vencimento_original, salvar a data atual como original
      if (!parcelaToEditData.data_vencimento_original) {
        updateData.data_vencimento_original = parcelaToEditData.data_vencimento;
      }

      const { error } = await supabase
        .from("parcelas")
        .update(updateData)
        .eq("id", parcelaToEditData.id);

      if (error) throw error;

      // Registrar alteração no histórico
      console.log("Registrando alteração de data no histórico...", {
        parcela_id: parcelaToEditData.id,
        tipo_evento: "alteracao_data",
        data_vencimento_anterior: parcelaToEditData.data_vencimento,
        data_vencimento_nova: novaDataVencimento,
      });

      const { error: historicoError } = await supabase
        .from("parcelas_historico")
        .insert({
          parcela_id: parcelaToEditData.id,
          tipo_evento: "alteracao_data",
          data_vencimento_anterior: parcelaToEditData.data_vencimento,
          data_vencimento_nova: novaDataVencimento,
          observacao: justificativaAlteracao.trim(),
          data_pagamento: new Date().toISOString(),
        } as any);

      if (historicoError) {
        console.error("Erro ao registrar no histórico:", historicoError);
        toast({
          title: "Data alterada com ressalvas",
          description: `A data de vencimento foi alterada, mas o histórico não pôde ser salvo. Motivo: ${historicoError.message}`,
          variant: "destructive",
        });
      } else {
        console.log("Alteração registrada no histórico com sucesso!");
      }

      toast({
        title: "Data de vencimento alterada",
        description: `Nova data: ${format(new Date(novaDataVencimento + 'T00:00:00'), 'dd/MM/yyyy')}`,
      });

      setIsEditarDataDialogOpen(false);
      setParcelaToEditData(null);
      setNovaDataVencimento("");
      setJustificativaAlteracao("");
      loadParcelas();
    } catch (error: any) {
      toast({
        title: "Erro ao alterar data",
        description: "Não foi possível alterar a data de vencimento.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (parcela: Parcela) => {
    if (parcela.status === "pago") {
      return <Badge variant="default" className="bg-success">Pago Total</Badge>;
    }

    if (parcela.status === "parcialmente_pago") {
      const diasAtraso = calcularDiasAtraso(parcela.data_vencimento);
      if (diasAtraso > 0) {
        return <Badge className="bg-amber-500 text-white">Parcial - Atrasado ({diasAtraso}d)</Badge>;
      }
      return <Badge className="bg-amber-500 text-white">Pago Parcial</Badge>;
    }

    const diasAtraso = calcularDiasAtraso(parcela.data_vencimento);
    if (diasAtraso > 0) {
      return <Badge variant="destructive">Atrasado ({diasAtraso}d)</Badge>;
    }
    
    return <Badge variant="secondary">Pendente</Badge>;
  };

  // Cálculos do dashboard usam dashboardParcelas (filtrado apenas por período)
  const totalPendente = dashboardParcelas
    .filter(p => p.status !== "pago")
    .reduce((acc, p) => acc + Number(p.valor_original || p.valor), 0);

  const totalPago = dashboardParcelas
    .reduce((acc, p) => acc + (Number(p.valor_pago) || 0), 0);

  const totalJurosRecebido = dashboardParcelas
    .filter(p => p.status === "pago" || p.status === "parcialmente_pago")
    .reduce((acc, p) => {
      const valorEmprestado = Number(p.contratos?.valor_emprestado || 0);
      const numeroParcelas = p.contratos?.numero_parcelas || 1;
      const principalParcela = valorEmprestado / numeroParcelas;
      const pago = Number(p.valor_pago) || 0;
      const lucro = pago - principalParcela;
      return acc + Math.max(lucro, 0);
    }, 0);

  const totalVencido = dashboardParcelas
    .filter(p => (p.status === "pendente" || p.status === "parcialmente_pago") && calcularDiasAtraso(p.data_vencimento) > 0)
    .reduce((acc, p) => acc + Number(p.valor_original || p.valor), 0);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-xl md:text-3xl font-bold truncate">Gestão de Parcelas</h1>
      </div>

      {/* Filtro de Período do Dashboard */}
      <Card className="w-full">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-medium">Filtrar Período</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pb-4">
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
            <div className="flex-1 min-w-0">
              <Label htmlFor="data-inicio" className="text-xs mb-1 block">Data Inicial</Label>
              <Input
                id="data-inicio"
                type="date"
                value={dataInicioDashboard}
                onChange={(e) => setDataInicioDashboard(e.target.value)}
                className="w-full sm:w-[140px] h-8 text-base md:text-xs"
              />
            </div>
            <div className="flex-1 min-w-0">
              <Label htmlFor="data-fim" className="text-xs mb-1 block">Data Final</Label>
              <Input
                id="data-fim"
                type="date"
                value={dataFimDashboard}
                onChange={(e) => setDataFimDashboard(e.target.value)}
                className="w-full sm:w-[140px] h-8 text-base md:text-xs"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDataInicioDashboard("");
                setDataFimDashboard("");
              }}
              className="h-8 text-xs px-3"
            >
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo */}
      <div className="grid gap-1.5 md:gap-4 grid-cols-2 md:grid-cols-5 w-full min-w-0">
        <Card
          className={`min-w-0 overflow-hidden border-l-4 border-l-primary cursor-pointer transition-shadow hover:shadow-md ${cardFilter === "recebido_hoje" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setCardFilter(cardFilter === "recebido_hoje" ? null : "recebido_hoje")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-2 md:px-3 pt-2 md:pt-3">
            <CardTitle className="text-xs md:text-sm font-medium truncate">Recebido Hoje</CardTitle>
            <Banknote className="h-3 w-3 md:h-4 md:w-4 text-primary flex-shrink-0 ml-1" />
          </CardHeader>
          <CardContent className="px-2 md:px-3 pb-2 md:pb-3">
            <div className="text-sm md:text-2xl font-bold text-primary truncate">
              R$ {totalRecebidoHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {pagamentosHoje} pagamento{pagamentosHoje !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-2 md:px-3 pt-2 md:pt-3">
            <CardTitle className="text-xs md:text-sm font-medium truncate">A Receber (Pendente)</CardTitle>
            <Calendar className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0 ml-1" />
          </CardHeader>
          <CardContent className="px-2 md:px-3 pb-2 md:pb-3">
            <div className="text-sm md:text-2xl font-bold truncate">
              R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {dashboardParcelas.filter(p => p.status !== "pago").length} parcelas a quitar
            </p>
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-2 md:px-3 pt-2 md:pt-3">
            <CardTitle className="text-xs md:text-sm font-medium truncate">Total Recebido</CardTitle>
            <Check className="h-3 w-3 md:h-4 md:w-4 text-success flex-shrink-0 ml-1" />
          </CardHeader>
          <CardContent className="px-2 md:px-3 pb-2 md:pb-3">
            <div className="text-sm md:text-2xl font-bold text-success truncate">
              R$ {totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              Inclui parciais e quitações
            </p>
          </CardContent>
        </Card>

        <Card
          className={`min-w-0 overflow-hidden cursor-pointer transition-shadow hover:shadow-md ${cardFilter === "vencido" ? "ring-2 ring-destructive" : ""}`}
          onClick={() => setCardFilter(cardFilter === "vencido" ? null : "vencido")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-2 md:px-3 pt-2 md:pt-3">
            <CardTitle className="text-xs md:text-sm font-medium truncate">Total Vencido</CardTitle>
            <AlertTriangle className="h-3 w-3 md:h-4 md:w-4 text-destructive flex-shrink-0 ml-1" />
          </CardHeader>
          <CardContent className="px-2 md:px-3 pb-2 md:pb-3">
            <div className="text-sm md:text-2xl font-bold text-destructive truncate">
              R$ {totalVencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {dashboardParcelas.filter(p => (p.status === "pendente" || p.status === "parcialmente_pago") && calcularDiasAtraso(p.data_vencimento) > 0).length} parcelas em atraso
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="w-full overflow-hidden">
        <CardContent className="pt-3 pb-3 px-3 md:px-6">
          <div className="flex flex-col md:flex-row gap-2 w-full">
            <div className="flex-1 relative w-full min-w-0">
              <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-7 w-full h-8 text-base md:text-xs"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40 h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Parcelas */}
      <Card className="w-full overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-base md:text-lg">
              Parcelas ({filteredParcelas.length})
              {!mostrarTodas && !cardFilter && <span className="text-sm font-normal text-muted-foreground ml-2 hidden sm:inline">(Próximos 7 dias)</span>}
            </CardTitle>
            {cardFilter && (
              <Badge
                variant="secondary"
                className="cursor-pointer text-xs"
                onClick={() => setCardFilter(null)}
              >
                {cardFilter === "recebido_hoje" ? "Recebido Hoje" : "Vencidas"} ✕
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMostrarTodas(!mostrarTodas)}
            className="text-xs sm:text-sm w-full sm:w-auto"
          >
            {mostrarTodas ? "Próximos 7 Dias" : "Ver Todas"}
          </Button>
        </CardHeader>
        <CardContent className="p-0 md:p-6">
          {/* View Mobile - Cards */}
          <div className="md:hidden space-y-3 p-2 w-full min-w-0 max-w-full">
            {filteredParcelas.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                Nenhuma parcela encontrada
              </div>
            ) : (
              filteredParcelas.map((parcela) => (
                <Card key={parcela.id} className="border-l-4 min-w-0 overflow-hidden" style={{
                  borderLeftColor: 
                    parcela.status === "pago" ? "hsl(var(--success))" : 
                    calcularDiasAtraso(parcela.data_vencimento) > 0 ? "hsl(var(--destructive))" : 
                    "hsl(var(--warning))"
                }}>
                  <CardContent className="p-3 space-y-2">
                    {/* Header do Card */}
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="font-semibold text-sm truncate">{parcela.contratos?.clientes?.nome}</p>
                        <p className="text-xs text-muted-foreground">Parcela {parcela.numero_parcela}</p>
                      </div>
                      <div className="flex-shrink-0">
                        {getStatusBadge(parcela)}
                      </div>
                    </div>

                    {/* Informações Principais */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="overflow-hidden">
                        <p className="text-muted-foreground text-xs">Valor</p>
                        <p className="font-semibold text-sm break-all">R$ {Number(parcela.valor_original || parcela.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        {parcela.valor_pago && parcela.valor_pago > 0 && (
                          <p className="text-xs text-success break-all">
                            Pago: R$ {Number(parcela.valor_pago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        )}
                        {parcela.status === "parcialmente_pago" && parcela.valor_pago && (
                          <p className="text-xs text-amber-600 break-all">
                            Resta: R$ {(Number(parcela.valor_original || parcela.valor) - Number(parcela.valor_pago)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-muted-foreground text-xs">Vencimento</p>
                        <p className="font-semibold text-sm">{formatDate(parcela.data_vencimento)}</p>
                        {calcularDiasAtraso(parcela.data_vencimento) > 0 && (
                          <p className="text-xs text-destructive">
                            {calcularDiasAtraso(parcela.data_vencimento)}d atraso
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex flex-col gap-1.5 pt-1.5 border-t w-full">
                      <div className="flex gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => abrirModalEditarData(parcela)}
                          className="flex-1 h-9 text-xs px-2"
                        >
                          <Calendar className="h-3.5 w-3.5 mr-1" />
                          Editar Data
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadHistorico(parcela)}
                          className="flex-1 h-9 text-xs px-2"
                        >
                          <FileText className="h-3.5 w-3.5 mr-1" />
                          Histórico
                        </Button>
                      </div>
                      <div className="flex gap-1.5">
                        {parcela.status !== "pago" ? (
                          <Button
                            size="sm"
                            onClick={() => abrirModalPagamento(parcela)}
                            className="flex-1 bg-success hover:bg-success/90 h-9 text-xs px-2"
                          >
                            <Check className="h-3.5 w-3.5 mr-1" />
                            Baixar
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarcarPendente(parcela.id)}
                            className="flex-1 text-warning hover:bg-warning hover:text-warning-foreground h-9 text-xs px-2"
                          >
                            <Undo2 className="h-3.5 w-3.5 mr-1" />
                            Desfazer
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setParcelaToDelete(parcela.id);
                            setIsDeleteDialogOpen(true);
                          }}
                          className="flex-1 text-destructive hover:bg-destructive hover:text-destructive-foreground h-9 text-xs px-2"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Excluir
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* View Desktop - Table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Cliente</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="hidden lg:table-cell">Pagamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParcelas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhuma parcela encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredParcelas.map((parcela) => (
                    <TableRow key={parcela.id}>
                      <TableCell className="font-medium">
                        {parcela.contratos?.clientes?.nome}
                      </TableCell>
                      <TableCell className="text-sm">{parcela.numero_parcela}</TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-col">
                          <span>R$ {Number(parcela.valor_original || parcela.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          {parcela.valor_pago && parcela.valor_pago > 0 && (
                            <span className="text-xs text-muted-foreground">
                              Pago: R$ {Number(parcela.valor_pago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(parcela.data_vencimento)}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {parcela.data_pagamento 
                          ? formatDate(parcela.data_pagamento)
                          : "-"
                        }
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(parcela)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => abrirModalEditarData(parcela)}
                            title="Editar data de vencimento"
                          >
                            <Calendar className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => loadHistorico(parcela)}
                            title="Ver histórico"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          {parcela.status !== "pago" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => abrirModalPagamento(parcela)}
                              className="text-success hover:bg-success hover:text-success-foreground"
                              title="Baixar parcela"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMarcarPendente(parcela.id)}
                              className="text-warning hover:bg-warning hover:text-warning-foreground"
                              title="Desfazer pagamento"
                            >
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setParcelaToDelete(parcela.id);
                              setIsDeleteDialogOpen(true);
                            }}
                            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            title="Excluir parcela"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Confirmação de Pagamento */}
      <Dialog open={isPagamentoDialogOpen} onOpenChange={setIsPagamentoDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento</DialogTitle>
            <DialogDescription>
              {parcelaToPay && (
                <>
                  Parcela {parcelaToPay.numero_parcela} - {parcelaToPay.contratos?.clientes?.nome}
                  <br />
                  Valor Original: R$ {Number(parcelaToPay.valor_original || parcelaToPay.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  <br />
                  {parcelaToPay.valor_pago && parcelaToPay.valor_pago > 0 && (
                    <>
                      Já Pago (parcial): R$ {Number(parcelaToPay.valor_pago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      <br />
                      Restante a Quitar: R$ {Number(parcelaToPay.valor_original || parcelaToPay.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <RadioGroup value={tipoPagamento} onValueChange={setTipoPagamento}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="total" id="total" />
                <Label htmlFor="total" className="cursor-pointer flex-1">
                  Quitar Parcela (Valor Original)
                  {parcelaToPay && (
                    <span className="block text-sm text-muted-foreground">
                      R$ {Number(parcelaToPay.valor_original || parcelaToPay.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <RadioGroupItem value="juros" id="juros" />
                <Label htmlFor="juros" className="cursor-pointer flex-1">
                  Pagar Apenas Juros
                  {parcelaToPay && (
                    <span className="block text-sm text-muted-foreground">
                      R$ {calcularJuros(parcelaToPay).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({parcelaToPay.contratos?.percentual}%)
                    </span>
                  )}
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <RadioGroupItem value="personalizado" id="personalizado" />
                <Label htmlFor="personalizado" className="cursor-pointer">Valor Personalizado</Label>
              </div>
            </RadioGroup>

            {tipoPagamento === "personalizado" && (
              <div className="space-y-2">
                <Label htmlFor="valor-personalizado">Valor</Label>
                <Input
                  id="valor-personalizado"
                  type="number"
                  step="0.01"
                  value={valorPagamento}
                  onChange={(e) => setValorPagamento(e.target.value)}
                  placeholder="Digite o valor"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="data-pagamento">Data do Pagamento</Label>
              <Input
                id="data-pagamento"
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                max={getLocalDateString()}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacao">Observação (opcional)</Label>
              <Textarea
                id="observacao"
                value={observacaoPagamento}
                onChange={(e) => setObservacaoPagamento(e.target.value)}
                placeholder="Digite uma observação sobre este pagamento..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsPagamentoDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmarPagamento}>
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Histórico */}
      <Dialog open={isHistoricoDialogOpen} onOpenChange={setIsHistoricoDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[80vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Histórico da Parcela</DialogTitle>
            <DialogDescription>
              Visualize todos os eventos relacionados a esta parcela, incluindo pagamentos e alterações de data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Filtro por tipo de evento */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Label htmlFor="filtro-tipo" className="text-sm">Filtrar por:</Label>
              <Select value={filtroTipoEvento} onValueChange={setFiltroTipoEvento}>
                <SelectTrigger id="filtro-tipo" className="w-full sm:w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Eventos</SelectItem>
                  <SelectItem value="pagamento">Pagamentos</SelectItem>
                  <SelectItem value="alteracao_data">Alterações de Data</SelectItem>
                  <SelectItem value="estorno">Estornos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {historico.filter(item => filtroTipoEvento === "todos" || item.tipo_evento === filtroTipoEvento).length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhum registro {filtroTipoEvento !== "todos" ? `de ${filtroTipoEvento === "pagamento" ? "pagamentos" : filtroTipoEvento === "alteracao_data" ? "alterações de data" : "estornos"}` : ""} no histórico desta parcela.
              </p>
            ) : (
              <>
                {/* View Desktop - Tabela */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Detalhes</TableHead>
                        <TableHead>Observação</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historico
                        .filter(item => filtroTipoEvento === "todos" || item.tipo_evento === filtroTipoEvento)
                        .map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            {format(new Date(item.data_pagamento), "dd/MM/yyyy HH:mm", {
                              locale: ptBR,
                            })}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                item.tipo_evento === "pagamento" 
                                  ? "default" 
                                  : item.tipo_evento === "alteracao_data" 
                                  ? "secondary" 
                                  : "destructive"
                              }
                              className={
                                item.tipo_evento === "pagamento"
                                  ? "bg-success hover:bg-success/80"
                                  : item.tipo_evento === "alteracao_data"
                                  ? "bg-warning hover:bg-warning/80 text-warning-foreground"
                                  : ""
                              }
                            >
                              {item.tipo_evento === "pagamento" && "Pagamento"}
                              {item.tipo_evento === "alteracao_data" && "Alteração de Data"}
                              {item.tipo_evento === "estorno" && "Estorno"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {item.tipo_evento === "pagamento" && item.valor_pago && (
                              <span>
                                R$ {item.valor_pago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} - {item.tipo_pagamento}
                              </span>
                            )}
                            {item.tipo_evento === "alteracao_data" && item.data_vencimento_anterior && item.data_vencimento_nova && (
                              <span>
                                {format(new Date(item.data_vencimento_anterior + 'T00:00:00'), "dd/MM/yyyy")} → {format(new Date(item.data_vencimento_nova + 'T00:00:00'), "dd/MM/yyyy")}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{item.observacao || "-"}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleExcluirPagamento(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* View Mobile - Cards */}
                <div className="md:hidden space-y-3">
                  {historico
                    .filter(item => filtroTipoEvento === "todos" || item.tipo_evento === filtroTipoEvento)
                    .map((item) => (
                      <Card key={item.id} className="p-3">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1 flex-1">
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(item.data_pagamento), "dd/MM/yyyy HH:mm", {
                                  locale: ptBR,
                                })}
                              </div>
                              <Badge 
                                variant={
                                  item.tipo_evento === "pagamento" 
                                    ? "default" 
                                    : item.tipo_evento === "alteracao_data" 
                                    ? "secondary" 
                                    : "destructive"
                                }
                                className={
                                  item.tipo_evento === "pagamento"
                                    ? "bg-success hover:bg-success/80"
                                    : item.tipo_evento === "alteracao_data"
                                    ? "bg-warning hover:bg-warning/80 text-warning-foreground"
                                    : ""
                                }
                              >
                                {item.tipo_evento === "pagamento" && "Pagamento"}
                                {item.tipo_evento === "alteracao_data" && "Alteração de Data"}
                                {item.tipo_evento === "estorno" && "Estorno"}
                              </Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleExcluirPagamento(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          <div className="text-sm">
                            {item.tipo_evento === "pagamento" && item.valor_pago && (
                              <div className="font-medium">
                                R$ {item.valor_pago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} - {item.tipo_pagamento}
                              </div>
                            )}
                            {item.tipo_evento === "alteracao_data" && item.data_vencimento_anterior && item.data_vencimento_nova && (
                              <div className="font-medium">
                                {format(new Date(item.data_vencimento_anterior + 'T00:00:00'), "dd/MM/yyyy")} → {format(new Date(item.data_vencimento_nova + 'T00:00:00'), "dd/MM/yyyy")}
                              </div>
                            )}
                          </div>
                          
                          {item.observacao && (
                            <div className="text-xs text-muted-foreground">
                              <span className="font-medium">Obs:</span> {item.observacao}
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição de Data */}
      <Dialog open={isEditarDataDialogOpen} onOpenChange={setIsEditarDataDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Data de Vencimento</DialogTitle>
            <DialogDescription>
              {parcelaToEditData && (
                <>
                  Parcela {parcelaToEditData.numero_parcela} - {parcelaToEditData.contratos?.clientes?.nome}
                  <br />
                  Data Atual: {formatDate(parcelaToEditData.data_vencimento)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nova-data">Nova Data de Vencimento</Label>
              <Input
                id="nova-data"
                type="date"
                value={novaDataVencimento}
                onChange={(e) => setNovaDataVencimento(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="justificativa">Justificativa *</Label>
              <Textarea
                id="justificativa"
                value={justificativaAlteracao}
                onChange={(e) => setJustificativaAlteracao(e.target.value)}
                placeholder="Informe o motivo da alteração da data de vencimento..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsEditarDataDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditarDataVencimento}>
              Confirmar Alteração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="w-[95vw] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta parcela? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="w-full sm:w-auto bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Acesso Restrito */}
      <AccessRestrictedModal
        open={isAccessModalOpen}
        onOpenChange={setIsAccessModalOpen}
        userEmail={userEmail}
      />
    </div>
  );
}
