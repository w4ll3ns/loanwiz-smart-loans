import { useState, useEffect } from "react";
import { format } from "date-fns";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, FileText, Eye, Trash2, Undo2, Download, Pencil, RefreshCw, Upload, Loader2, ArrowRightLeft } from "lucide-react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getLocalDateString } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { AccessRestrictedModal } from "@/components/AccessRestrictedModal";

// Input validation schema for contract form
const contratoSchema = z.object({
  clienteId: z.string().uuid('Selecione um cliente válido'),
  valorEmprestado: z.string().refine(val => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0 && num <= 100000000;
  }, 'Valor emprestado deve ser positivo e menor que 100 milhões'),
  percentual: z.string().refine(val => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0 && num <= 1000;
  }, 'Percentual deve ser entre 0.01% e 1000%'),
  periodicidade: z.enum(['diario', 'semanal', 'quinzenal', 'mensal'], {
    errorMap: () => ({ message: 'Selecione uma periodicidade válida' })
  }),
  numeroParcelas: z.string().refine(val => {
    const num = parseInt(val);
    return !isNaN(num) && num >= 1 && num <= 365;
  }, 'Número de parcelas deve ser entre 1 e 365'),
  dataEmprestimo: z.string().refine(val => {
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, 'Data do empréstimo é obrigatória'),
  tipoJuros: z.enum(['simples', 'parcela', 'composto']),
  permiteCobrancaSabado: z.boolean(),
  permiteCobrancaDomingo: z.boolean()
});

interface Contrato {
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
  tipo_juros?: "simples" | "parcela" | "composto";
  permite_cobranca_sabado?: boolean;
  permite_cobranca_domingo?: boolean;
}

interface Cliente {
  id: string;
  nome: string;
}

interface PreviewParcela {
  numero: number;
  data: string;
  valor: number;
}

interface Parcela {
  id: string;
  contrato_id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  status: string;
  data_pagamento: string | null;
  valor_pago: number | null;
}

interface DadosComprovante {
  nome_cliente: string;
  valor: number;
  data: string;
  chave_pix?: string;
  tipo_chave?: string;
}

export default function Contratos() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isContratoDetailsOpen, setIsContratoDetailsOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [contratoToDelete, setContratoToDelete] = useState<string | null>(null);
  const [selectedContrato, setSelectedContrato] = useState<Contrato | null>(null);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [previewData, setPreviewData] = useState<any>(null);
  const [isPagamentoDialogOpen, setIsPagamentoDialogOpen] = useState(false);
  const [parcelaToPay, setParcelaToPay] = useState<Parcela | null>(null);
  const [tipoPagamento, setTipoPagamento] = useState<string>("total");
  const [valorPagamento, setValorPagamento] = useState<string>("");
  const [dataPagamento, setDataPagamento] = useState<string>("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    tipoJuros: "simples" as "simples" | "parcela" | "composto",
    percentual: ""
  });
  const [isEditLoading, setIsEditLoading] = useState(false);
  const { toast } = useToast();
  const { canCreate, userEmail } = useUserRole();

  // Import comprovante states
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isImportLoading, setIsImportLoading] = useState(false);
  const [dadosComprovante, setDadosComprovante] = useState<DadosComprovante | null>(null);
  const [importStep, setImportStep] = useState<"upload" | "review">("upload");
  const [showClienteOverride, setShowClienteOverride] = useState(false);
  const [clienteOverrideType, setClienteOverrideType] = useState<"existing" | "new">("existing");
  const [selectedOverrideClienteId, setSelectedOverrideClienteId] = useState("");
  const [novoClienteNome, setNovoClienteNome] = useState("");

  const [statusFilter, setStatusFilter] = useState<"ativos" | "quitados" | "todos">("ativos");

  const contratosFiltrados = contratos.filter((c) => {
    if (statusFilter === "ativos") return c.status === "ativo";
    if (statusFilter === "quitados") return c.status === "quitado";
    return true;
  });

  const [formData, setFormData] = useState({
    clienteId: "",
    valorEmprestado: "",
    percentual: "",
    periodicidade: "" as "diario" | "semanal" | "quinzenal" | "mensal" | "",
    numeroParcelas: "",
    dataEmprestimo: "",
    tipoJuros: "simples" as "simples" | "parcela" | "composto",
    permiteCobrancaSabado: true,
    permiteCobrancaDomingo: false
  });

  useEffect(() => {
    loadContratos();
    loadClientes();
  }, []);

  const loadContratos = async () => {
    try {
      const { data, error } = await supabase
        .from("contratos")
        .select(`
          *,
          clientes(nome)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContratos((data || []) as Contrato[]);
    } catch (error: any) {
      toast({
        title: "Não foi possível carregar os contratos",
        description: "Verifique sua conexão com a internet e tente novamente.",
        variant: "destructive",
      });
    }
  };

  const loadClientes = async () => {
    try {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome")
        .order("nome");

      if (error) throw error;
      setClientes(data || []);
    } catch (error: any) {
      toast({
        title: "Não foi possível carregar os clientes",
        description: "Verifique sua conexão com a internet e tente novamente.",
        variant: "destructive",
      });
    }
  };

  const calcularContrato = () => {
    const valor = parseFloat(formData.valorEmprestado);
    const percent = parseFloat(formData.percentual);
    const parcelas = parseInt(formData.numeroParcelas);
    
    if (!valor || !percent || !parcelas) return null;

    let valorTotal: number;
    
    if (formData.tipoJuros === "parcela") {
      // Juros por parcela: percentual × número de parcelas
      // Exemplo: 10% × 3 parcelas = 30% total
      valorTotal = valor + (valor * (percent / 100) * parcelas);
    } else if (formData.tipoJuros === "composto") {
      // Juros compostos: M = C × (1 + i)^n (juros sobre juros)
      // Exemplo: 10% ao mês por 3 meses
      // Mês 1: 10.000 × 1.10 = 11.000
      // Mês 2: 11.000 × 1.10 = 12.100
      // Mês 3: 12.100 × 1.10 = 13.310
      valorTotal = valor * Math.pow(1 + (percent / 100), parcelas);
    } else {
      // Juros simples: percentual fixo sobre o valor total
      // Exemplo: 10% de 10.000 = 1.000 de juros total
      valorTotal = valor + (valor * percent / 100);
    }
    
    const valorParcela = valorTotal / parcelas;

    return {
      valorTotal,
      valorParcela,
      lucro: valorTotal - valor
    };
  };

  const getExplicacaoJuros = () => {
    const valor = parseFloat(formData.valorEmprestado) || 10000;
    const percent = parseFloat(formData.percentual) || 10;
    const parcelas = parseInt(formData.numeroParcelas) || 3;

    switch (formData.tipoJuros) {
      case "simples":
        const jurosSimples = valor * (percent / 100);
        return `Juros Fixo: O percentual (${percent}%) é aplicado uma única vez sobre o valor emprestado. Exemplo: ${percent}% de R$ ${valor.toLocaleString('pt-BR')} = R$ ${jurosSimples.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de juros total.`;
      
      case "parcela":
        const jurosParcela = valor * (percent / 100) * parcelas;
        return `Juros por Parcela: O percentual (${percent}%) é multiplicado pelo número de parcelas (${parcelas}x). Exemplo: ${percent}% × ${parcelas} parcelas = ${percent * parcelas}% total. Juros = R$ ${jurosParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`;
      
      case "composto":
        const valorFinal = valor * Math.pow(1 + (percent / 100), parcelas);
        return `Juros Composto: Os juros incidem sobre o montante do mês anterior (juros sobre juros). Exemplo com ${parcelas} meses: Mês 1: R$ ${(valor * (1 + percent/100)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, Mês 2: R$ ${(valor * Math.pow(1 + percent/100, 2)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, Mês 3: R$ ${valorFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`;
      
      default:
        return "";
    }
  };

  const gerarParcelas = (dataInicio: string, periodicidade: string, numeroParcelas: number): PreviewParcela[] => {
    const parcelas: PreviewParcela[] = [];
    const dataBase = new Date(dataInicio);
    
    for (let i = 1; i <= numeroParcelas; i++) {
      const dataParcela = new Date(dataBase);
      
      switch (periodicidade) {
        case "diario":
          dataParcela.setDate(dataBase.getDate() + i);
          break;
        case "semanal":
          dataParcela.setDate(dataBase.getDate() + (i * 7));
          break;
        case "quinzenal":
          dataParcela.setDate(dataBase.getDate() + (i * 15));
          break;
        case "mensal":
          dataParcela.setMonth(dataBase.getMonth() + i);
          break;
      }
      
      parcelas.push({
        numero: i,
        data: getLocalDateString(dataParcela),
        valor: calcularContrato()?.valorParcela || 0
      });
    }
    
    return parcelas;
  };

  const handlePreview = () => {
    const calculo = calcularContrato();
    if (!calculo) return;

    const cliente = clientes.find(c => c.id === formData.clienteId);
    const parcelas = gerarParcelas(formData.dataEmprestimo, formData.periodicidade, parseInt(formData.numeroParcelas));

    setPreviewData({
      cliente: cliente?.nome,
      ...formData,
      ...calculo,
      parcelas
    });
    setIsPreviewOpen(true);
  };

  const loadParcelas = async (contratoId: string) => {
    try {
      const { data, error } = await supabase
        .from("parcelas")
        .select("*")
        .eq("contrato_id", contratoId)
        .order("numero_parcela");

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

  const handleContratoClick = async (contrato: Contrato) => {
    setSelectedContrato(contrato);
    await loadParcelas(contrato.id);
    // Recarregar o contrato específico para pegar status atualizado
    const { data: contratoAtualizado } = await supabase
      .from("contratos")
      .select(`
        *,
        clientes(nome)
      `)
      .eq("id", contrato.id)
      .single();
    
    if (contratoAtualizado) {
      setSelectedContrato(contratoAtualizado as Contrato);
    }
    setIsContratoDetailsOpen(true);
  };

  const handleRenovarContrato = (contrato: Contrato) => {
    // Preencher o formulário com os dados do contrato original
    setFormData({
      clienteId: contrato.cliente_id,
      valorEmprestado: contrato.valor_emprestado.toString(),
      percentual: contrato.percentual.toString(),
      periodicidade: contrato.periodicidade,
      numeroParcelas: contrato.numero_parcelas.toString(),
      dataEmprestimo: getLocalDateString(), // Data de hoje
      tipoJuros: contrato.tipo_juros || "simples",
      permiteCobrancaSabado: contrato.permite_cobranca_sabado ?? true,
      permiteCobrancaDomingo: contrato.permite_cobranca_domingo ?? false
    });
    
    // Fechar modal de detalhes e abrir o de criação
    setIsContratoDetailsOpen(false);
    setIsDialogOpen(true);
    
    toast({
      title: "Renovação de contrato",
      description: `Formulário preenchido com dados do contrato de ${contrato.clientes?.nome}. Revise e confirme.`,
    });
  };

  const calcularJuros = (parcela: Parcela) => {
    if (!selectedContrato) return 0;
    const percentual = Number(selectedContrato.percentual) || 0;
    const numeroParcelas = selectedContrato.numero_parcelas || 1;
    const valorEmprestado = Number(selectedContrato.valor_emprestado || 0);
    
    // Juros calculados sobre o valor emprestado proporcional à parcela
    const valorPrincipalParcela = valorEmprestado / numeroParcelas;
    return (valorPrincipalParcela * percentual) / 100;
  };

  const abrirModalPagamento = (parcela: Parcela) => {
    setParcelaToPay(parcela);
    setTipoPagamento("total");
    setValorPagamento(parcela.valor.toString());
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
          tipo_evento: "pagamento",
        } as any);

      if (historicoError) throw historicoError;

      // Acumular valor pago
      const novoValorPago = (Number(parcelaToPay.valor_pago) || 0) + valorPagar;

      // Só marca como "pago" quando for quitação (pagamento total)
      const novoStatus = tipoPagamento === "total" ? "pago" : "pendente";

      // Atualizar parcela
      const updateData: any = {
        valor_pago: novoValorPago,
        status: novoStatus,
        data_pagamento: dataPagamento,
      };

      // Preservar valor_original se não existir
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

      // Verificar quitação do contrato apenas se parcela foi totalmente paga
      if (novoStatus === "pago" && parcelaToPay.contrato_id) {
        const { data: todasParcelas, error: parcelasError } = await supabase
          .from("parcelas")
          .select("status")
          .eq("contrato_id", parcelaToPay.contrato_id);

        if (!parcelasError && todasParcelas) {
          const todasPagas = todasParcelas.every(p => p.status === "pago");
          
          if (todasPagas) {
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
      
      if (selectedContrato) {
        await loadParcelas(selectedContrato.id);
        const { data: contratoAtualizado } = await supabase
          .from("contratos")
          .select(`
            *,
            clientes(nome)
          `)
          .eq("id", selectedContrato.id)
          .single();
        
        if (contratoAtualizado) {
          setSelectedContrato(contratoAtualizado as Contrato);
        }
      }
      
      await loadContratos();
    } catch (error: any) {
      toast({
        title: "Não foi possível processar o pagamento",
        description: "Verifique os valores informados e sua conexão com a internet.",
        variant: "destructive",
      });
    }
  };

  const handleDesfazerPagamento = async (parcelaId: string) => {
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
        description: "A parcela foi resetada e o histórico foi limpo.",
      });

      if (selectedContrato) {
        await loadParcelas(selectedContrato.id);
      }
    } catch (error: any) {
      toast({
        title: "Não foi possível desfazer os pagamentos",
        description: "Verifique sua conexão com a internet e tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Funções para edição de contrato
  const calcularPreviewEdicao = () => {
    if (!selectedContrato) return null;
    
    const valor = Number(selectedContrato.valor_emprestado);
    const percent = editFormData.percentual ? parseFloat(editFormData.percentual) : Number(selectedContrato.percentual);
    const numParcelas = selectedContrato.numero_parcelas;
    
    if (!valor || !percent || !numParcelas) return null;

    let valorTotalNovo: number;
    
    if (editFormData.tipoJuros === "parcela") {
      valorTotalNovo = valor + (valor * (percent / 100) * numParcelas);
    } else if (editFormData.tipoJuros === "composto") {
      valorTotalNovo = valor * Math.pow(1 + (percent / 100), numParcelas);
    } else {
      valorTotalNovo = valor + (valor * percent / 100);
    }

    // Calcular parcelas pendentes e valor já pago
    const parcelasPagas = parcelas.filter(p => p.status === 'pago');
    const parcelasPendentes = parcelas.filter(p => p.status === 'pendente');
    const valorJaPago = parcelasPagas.reduce((acc, p) => acc + Number(p.valor_pago || 0), 0);
    const valorRestante = valorTotalNovo - valorJaPago;
    const valorNovaParcela = parcelasPendentes.length > 0 ? valorRestante / parcelasPendentes.length : 0;

    return {
      valorTotalAnterior: Number(selectedContrato.valor_total),
      valorTotalNovo,
      valorJaPago,
      valorRestante,
      valorNovaParcela,
      parcelasPagas: parcelasPagas.length,
      parcelasPendentes: parcelasPendentes.length
    };
  };

  const abrirModalEdicao = () => {
    if (!selectedContrato) return;
    setEditFormData({
      tipoJuros: (selectedContrato.tipo_juros || 'simples') as "simples" | "parcela" | "composto",
      percentual: String(selectedContrato.percentual)
    });
    setIsEditDialogOpen(true);
  };

  const handleEditContrato = async () => {
    if (!selectedContrato) return;
    
    setIsEditLoading(true);
    try {
      const { error } = await supabase.rpc('recalcular_contrato_parcelas', {
        p_contrato_id: selectedContrato.id,
        p_tipo_juros: editFormData.tipoJuros,
        p_percentual: editFormData.percentual ? parseFloat(editFormData.percentual) : null
      });

      if (error) throw error;

      toast({
        title: "Contrato atualizado",
        description: "O tipo de juros foi alterado e as parcelas foram recalculadas.",
      });

      setIsEditDialogOpen(false);
      
      // Recarregar dados
      await loadContratos();
      await loadParcelas(selectedContrato.id);
      
      // Recarregar contrato para pegar dados atualizados
      const { data: contratoAtualizado } = await supabase
        .from("contratos")
        .select(`*, clientes(nome)`)
        .eq("id", selectedContrato.id)
        .single();
      
      if (contratoAtualizado) {
        setSelectedContrato(contratoAtualizado as Contrato);
      }
    } catch (error: any) {
      console.error('Erro ao editar contrato:', error);
      toast({
        title: "Erro ao editar contrato",
        description: error.message || "Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsEditLoading(false);
    }
  };

  const handleDeleteContrato = async () => {
    if (!contratoToDelete) return;

    try {
      // Primeiro excluir as parcelas do contrato
      const { error: parcelasError } = await supabase
        .from("parcelas")
        .delete()
        .eq("contrato_id", contratoToDelete);

      if (parcelasError) throw parcelasError;

      // Depois excluir o contrato
      const { error: contratoError } = await supabase
        .from("contratos")
        .delete()
        .eq("id", contratoToDelete);

      if (contratoError) throw contratoError;

      toast({
        title: "Contrato excluído",
        description: "Contrato e parcelas foram removidos com sucesso.",
      });

      setIsDeleteDialogOpen(false);
      setContratoToDelete(null);
      setIsContratoDetailsOpen(false);
      loadContratos();
    } catch (error: any) {
      toast({
        title: "Não foi possível excluir o contrato",
        description: "Verifique sua conexão com a internet e tente novamente.",
        variant: "destructive",
      });
    }
  };

  const gerarImagemContrato = async () => {
    if (!selectedContrato) return;

    try {
      // Criar um elemento temporário para renderizar o conteúdo
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '800px';
      tempDiv.style.padding = '40px';
      tempDiv.style.backgroundColor = '#ffffff';
      tempDiv.style.fontFamily = 'Arial, sans-serif';
      document.body.appendChild(tempDiv);

      // Função para sanitizar HTML e prevenir XSS
      const escapeHtml = (text: string): string => {
        return text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      };

      const clienteNome = escapeHtml(selectedContrato.clientes?.nome || 'N/A');
      
      // Criar o HTML do conteúdo
      tempDiv.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1a1a1a; font-size: 28px; margin-bottom: 10px; font-weight: bold;">RELATÓRIO DE CONTRATO</h1>
        </div>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; font-size: 20px; margin-bottom: 15px; font-weight: bold;">Informações do Contrato</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 14px;">
            <div><strong>Cliente:</strong> ${clienteNome}</div>
            <div><strong>Data:</strong> ${format(new Date(selectedContrato.data_emprestimo + 'T00:00:00'), 'dd/MM/yyyy')}</div>
            <div><strong>Valor Emprestado:</strong> R$ ${Number(selectedContrato.valor_emprestado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <div><strong>Percentual:</strong> ${Number(selectedContrato.percentual)}%</div>
            <div><strong>Valor Total:</strong> R$ ${Number(selectedContrato.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <div><strong>Parcelas:</strong> ${selectedContrato.numero_parcelas}</div>
            <div><strong>Periodicidade:</strong> ${selectedContrato.periodicidade}</div>
            <div><strong>Status:</strong> ${selectedContrato.status}</div>
          </div>
        </div>
        
        <div>
          <h2 style="color: #333; font-size: 20px; margin-bottom: 15px; font-weight: bold;">Parcelas</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #333; color: white;">
                <th style="padding: 10px; text-align: left;">Nº</th>
                <th style="padding: 10px; text-align: left;">Vencimento</th>
                <th style="padding: 10px; text-align: left;">Valor</th>
                <th style="padding: 10px; text-align: left;">Status</th>
                <th style="padding: 10px; text-align: left;">Pagamento</th>
                <th style="padding: 10px; text-align: left;">Valor Pago</th>
              </tr>
            </thead>
            <tbody>
              ${parcelas.map((parcela, index) => {
                const hoje = new Date();
                hoje.setHours(0, 0, 0, 0);
                const vencimento = new Date(parcela.data_vencimento + 'T00:00:00');
                const estaAtrasada = parcela.status !== 'pago' && vencimento < hoje;
                const statusTexto = parcela.status === 'pago' ? 'Pago' : (estaAtrasada ? 'Atrasado' : 'Pendente');
                const corStatus = parcela.status === 'pago' ? '#22c55e' : (estaAtrasada ? '#ef4444' : '#94a3b8');
                
                return `
                <tr style="background: ${index % 2 === 0 ? '#f9f9f9' : '#ffffff'}; border-bottom: 1px solid #ddd;">
                  <td style="padding: 8px;">${parcela.numero_parcela}</td>
                  <td style="padding: 8px;">${format(new Date(parcela.data_vencimento + 'T00:00:00'), 'dd/MM/yyyy')}</td>
                  <td style="padding: 8px;">R$ ${Number(parcela.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td style="padding: 8px;"><span style="display: inline-block; background: ${corStatus}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 11px; text-align: center; min-width: 70px;">${statusTexto}</span></td>
                  <td style="padding: 8px;">${parcela.data_pagamento ? format(new Date(parcela.data_pagamento + 'T00:00:00'), 'dd/MM/yyyy') : '-'}</td>
                  <td style="padding: 8px;">${parcela.valor_pago ? `R$ ${Number(parcela.valor_pago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}</td>
                </tr>
              `}).join('')}
            </tbody>
          </table>
        </div>
      `;

      // Gerar a imagem usando html2canvas
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
      });

      // Remover o elemento temporário
      document.body.removeChild(tempDiv);

      // Converter canvas para blob e fazer download
      const fileName = `contrato-${clienteNome.replace(/\s+/g, '-')}-${format(new Date(), 'dd-MM-yyyy')}.png`;
      
      // Detectar iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

      canvas.toBlob(async (blob) => {
        if (blob) {
          // Para iOS - usar Web Share API para salvar na galeria
          if (isIOS && navigator.share && navigator.canShare) {
            const file = new File([blob], fileName, { type: 'image/png' });
            
            if (navigator.canShare({ files: [file] })) {
              try {
                await navigator.share({
                  files: [file],
                  title: 'Relatório de Contrato',
                });
                toast({
                  title: "Imagem pronta!",
                  description: "Escolha 'Salvar Imagem' para adicionar à galeria.",
                });
                return;
              } catch (err: any) {
                // Se o usuário cancelou, não mostrar erro
                if (err.name === 'AbortError') return;
                console.log('Share falhou, tentando método alternativo');
              }
            }
          }
          
          // Método tradicional para desktop/Android
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          link.click();
          URL.revokeObjectURL(url);
          
          toast({
            title: "Imagem gerada com sucesso!",
            description: "O arquivo foi baixado para seu dispositivo.",
          });
        }
      }, 'image/png');

    } catch (error) {
      console.error('Erro ao gerar imagem:', error);
      toast({
        title: "Erro ao gerar imagem",
        description: "Ocorreu um erro ao gerar a imagem do contrato.",
        variant: "destructive",
      });
    }
  };

  const gerarRelatorioPDF = async () => {
    if (!selectedContrato) return;

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      let yPos = 20;

      // Título
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('RELATÓRIO DE CONTRATO', pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 15;

      // Informações do Contrato
      pdf.setFontSize(14);
      pdf.text('Informações do Contrato', margin, yPos);
      yPos += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      
      const clienteNome = selectedContrato.clientes?.nome || 'N/A';
      const linhas = [
        `Cliente: ${clienteNome}`,
        `Data do Empréstimo: ${format(new Date(selectedContrato.data_emprestimo + 'T00:00:00'), 'dd/MM/yyyy')}`,
        `Valor Emprestado: R$ ${Number(selectedContrato.valor_emprestado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `Percentual: ${Number(selectedContrato.percentual)}%`,
        `Valor Total: R$ ${Number(selectedContrato.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `Número de Parcelas: ${selectedContrato.numero_parcelas}`,
        `Periodicidade: ${selectedContrato.periodicidade}`,
        `Status: ${selectedContrato.status}`,
      ];

      linhas.forEach(linha => {
        pdf.text(linha, margin, yPos);
        yPos += 6;
      });

      yPos += 10;

      // Parcelas
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Parcelas', margin, yPos);
      yPos += 8;

      // Cabeçalho da tabela
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      const colWidths = [20, 35, 35, 35, 35, 30];
      const headers = ['Nº', 'Vencimento', 'Valor', 'Status', 'Pagamento', 'Valor Pago'];
      
      let xPos = margin;
      headers.forEach((header, i) => {
        pdf.text(header, xPos, yPos);
        xPos += colWidths[i];
      });
      
      yPos += 6;

      // Linha separadora
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPos - 2, pageWidth - margin, yPos - 2);

      // Dados das parcelas
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);

      const parcelasPagas = parcelas.filter(p => p.status === 'pago');
      const parcelasPendentes = parcelas.filter(p => p.status !== 'pago');

      // Parcelas Pagas
      if (parcelasPagas.length > 0) {
        yPos += 4;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.text('PAGAS', margin, yPos);
        yPos += 5;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);

        parcelasPagas.forEach(parcela => {
          if (yPos > 270) {
            pdf.addPage();
            yPos = 20;
          }

          xPos = margin;
          const dados = [
            parcela.numero_parcela.toString(),
            format(new Date(parcela.data_vencimento + 'T00:00:00'), 'dd/MM/yy'),
            `R$ ${Number(parcela.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            parcela.status,
            parcela.data_pagamento ? format(new Date(parcela.data_pagamento + 'T00:00:00'), 'dd/MM/yy') : '-',
            parcela.valor_pago ? `R$ ${Number(parcela.valor_pago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-',
          ];

          dados.forEach((dado, i) => {
            pdf.text(dado, xPos, yPos);
            xPos += colWidths[i];
          });

          yPos += 5;
        });
      }

      // Parcelas Pendentes
      if (parcelasPendentes.length > 0) {
        yPos += 4;
        
        if (yPos > 270) {
          pdf.addPage();
          yPos = 20;
        }

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.text('PENDENTES', margin, yPos);
        yPos += 5;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);

        parcelasPendentes.forEach(parcela => {
          if (yPos > 270) {
            pdf.addPage();
            yPos = 20;
          }

          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          const vencimento = new Date(parcela.data_vencimento + 'T00:00:00');
          const estaAtrasada = vencimento < hoje;
          const statusTexto = estaAtrasada ? 'Atrasado' : 'Pendente';

          xPos = margin;
          const dados = [
            parcela.numero_parcela.toString(),
            format(new Date(parcela.data_vencimento + 'T00:00:00'), 'dd/MM/yy'),
            `R$ ${Number(parcela.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            statusTexto,
            '-',
            '-',
          ];

          dados.forEach((dado, i) => {
            pdf.text(dado, xPos, yPos);
            xPos += colWidths[i];
          });

          yPos += 5;
        });
      }

      // Salvar o PDF
      pdf.save(`contrato-${clienteNome.replace(/\s+/g, '-')}-${format(new Date(), 'dd-MM-yyyy')}.pdf`);
      
      toast({
        title: "PDF gerado com sucesso!",
        description: "O relatório foi baixado para seu dispositivo.",
      });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: "Erro ao gerar relatório",
        description: "Ocorreu um erro ao gerar o PDF.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate input
    const validationResult = contratoSchema.safeParse(formData);
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      toast({
        title: "Dados inválidos",
        description: firstError.message,
        variant: "destructive"
      });
      return;
    }

    const validatedData = validationResult.data;
    
    const calculo = calcularContrato();
    if (!calculo) {
      toast({
        title: "Erro de cálculo",
        description: "Não foi possível calcular os valores do contrato.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: contrato, error: contratoError } = await supabase
        .from("contratos")
        .insert([{
          cliente_id: validatedData.clienteId,
          valor_emprestado: parseFloat(validatedData.valorEmprestado),
          percentual: parseFloat(validatedData.percentual),
          periodicidade: validatedData.periodicidade,
          numero_parcelas: parseInt(validatedData.numeroParcelas),
          data_emprestimo: validatedData.dataEmprestimo,
          valor_total: calculo.valorTotal,
          status: "ativo",
          tipo_juros: validatedData.tipoJuros,
          permite_cobranca_sabado: validatedData.permiteCobrancaSabado,
          permite_cobranca_domingo: validatedData.permiteCobrancaDomingo
        }])
        .select()
        .single();

      if (contratoError) throw contratoError;

      // Gerar parcelas usando a função do banco de dados
      const { error: parcelasError } = await supabase.rpc("gerar_parcelas", {
        p_contrato_id: contrato.id,
        p_numero_parcelas: parseInt(validatedData.numeroParcelas),
        p_valor_parcela: calculo.valorParcela,
        p_data_inicio: validatedData.dataEmprestimo,
        p_periodicidade: validatedData.periodicidade,
        p_permite_sabado: validatedData.permiteCobrancaSabado,
        p_permite_domingo: validatedData.permiteCobrancaDomingo
      });

      if (parcelasError) throw parcelasError;

      setFormData({
        clienteId: "",
        valorEmprestado: "",
        percentual: "",
        periodicidade: "",
        numeroParcelas: "",
        dataEmprestimo: "",
        tipoJuros: "simples",
        permiteCobrancaSabado: true,
        permiteCobrancaDomingo: false
      });
      
      setIsDialogOpen(false);
      
      toast({
        title: "Contrato criado",
        description: "Novo contrato e parcelas geradas com sucesso.",
      });

      loadContratos();
    } catch (error: any) {
      toast({
        title: "Não foi possível criar o contrato",
        description: "Verifique todos os dados preenchidos e sua conexão com a internet.",
        variant: "destructive",
      });
    }
  };

  const convertPdfToImage = async (file: File): Promise<string> => {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    
    const scale = 2;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    
    await page.render({ canvasContext: ctx, viewport }).promise;
    
    const dataUrl = canvas.toDataURL("image/png");
    return dataUrl.split(",")[1];
  };

  const handleImportComprovante = async (file: File) => {
    setIsImportLoading(true);
    try {
      let base64: string;
      let mimeType: string;

      if (file.type === "application/pdf") {
        base64 = await convertPdfToImage(file);
        mimeType = "image/png";
      } else {
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        mimeType = file.type;
      }

      const { data, error } = await supabase.functions.invoke("parse-comprovante", {
        body: { image_base64: base64, mime_type: mimeType },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setDadosComprovante(data);
      setImportStep("review");
    } catch (error: any) {
      console.error("Erro ao importar comprovante:", error);
      toast({
        title: "Erro ao processar comprovante",
        description: error.message || "Não foi possível extrair os dados do comprovante.",
        variant: "destructive",
      });
    } finally {
      setIsImportLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!dadosComprovante) return;

    try {
      let clienteId: string;

      if (showClienteOverride && clienteOverrideType === "existing" && selectedOverrideClienteId) {
        // User chose an existing client override
        clienteId = selectedOverrideClienteId;
        const selectedCliente = clientes.find(c => c.id === selectedOverrideClienteId);
        toast({
          title: "Cliente selecionado",
          description: `Cliente "${selectedCliente?.nome}" selecionado.`,
        });
      } else if (showClienteOverride && clienteOverrideType === "new" && novoClienteNome.trim()) {
        // User chose to create a new client with custom name
        const observacoes = dadosComprovante.chave_pix
          ? `Chave PIX (${dadosComprovante.tipo_chave || "desconhecido"}): ${dadosComprovante.chave_pix}`
          : undefined;

        const { data: { user } } = await supabase.auth.getUser();

        const { data: novoCliente, error: clienteError } = await supabase
          .from("clientes")
          .insert([{
            nome: novoClienteNome.trim(),
            observacoes,
            user_id: user?.id,
          }])
          .select()
          .single();

        if (clienteError) throw clienteError;
        clienteId = novoCliente.id;
        await loadClientes();

        toast({
          title: "Novo cliente criado",
          description: `Cliente "${novoClienteNome.trim()}" criado.`,
        });
      } else {
        // Default flow: search by PIX name or create
        const { data: clientesMatch } = await supabase
          .from("clientes")
          .select("id, nome")
          .ilike("nome", `%${dadosComprovante.nome_cliente}%`);

        if (clientesMatch && clientesMatch.length > 0) {
          clienteId = clientesMatch[0].id;
          toast({
            title: "Cliente encontrado",
            description: `Cliente "${clientesMatch[0].nome}" selecionado automaticamente.`,
          });
        } else {
          const observacoes = dadosComprovante.chave_pix
            ? `Chave PIX (${dadosComprovante.tipo_chave || "desconhecido"}): ${dadosComprovante.chave_pix}`
            : undefined;

          const { data: { user } } = await supabase.auth.getUser();

          const { data: novoCliente, error: clienteError } = await supabase
            .from("clientes")
            .insert([{
              nome: dadosComprovante.nome_cliente,
              observacoes,
              user_id: user?.id,
            }])
            .select()
            .single();

          if (clienteError) throw clienteError;
          clienteId = novoCliente.id;
          await loadClientes();

          toast({
            title: "Novo cliente criado",
            description: `Cliente "${dadosComprovante.nome_cliente}" criado automaticamente.`,
          });
        }
      }

      // Pre-preencher formulário e abrir dialog de contrato
      setFormData({
        clienteId,
        valorEmprestado: dadosComprovante.valor.toString(),
        percentual: "",
        periodicidade: "",
        numeroParcelas: "",
        dataEmprestimo: dadosComprovante.data || getLocalDateString(),
        tipoJuros: "simples",
        permiteCobrancaSabado: true,
        permiteCobrancaDomingo: false,
      });

      setIsImportDialogOpen(false);
      setDadosComprovante(null);
      setImportStep("upload");
      setShowClienteOverride(false);
      setSelectedOverrideClienteId("");
      setNovoClienteNome("");
      setIsDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Erro ao confirmar importação",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Gestão de Contratos</h1>
        
        <div className="flex gap-2 flex-col sm:flex-row">
          <Button size="sm" variant="outline" className="w-full md:w-auto" onClick={() => {
            if (!canCreate) {
              setIsAccessModalOpen(true);
              return;
            }
            setImportStep("upload");
            setDadosComprovante(null);
            setIsImportDialogOpen(true);
          }}>
            <Upload className="h-4 w-4 mr-2" />
            Importar Comprovante
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="w-full md:w-auto" onClick={(e) => {
                if (!canCreate) {
                  e.preventDefault();
                  setIsAccessModalOpen(true);
                }
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Contrato
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Novo Contrato de Empréstimo</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cliente">Cliente</Label>
                  <Select value={formData.clienteId} onValueChange={(value) => setFormData({ ...formData, clienteId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((cliente) => (
                        <SelectItem key={cliente.id} value={cliente.id}>
                          {cliente.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="dataEmprestimo">Data do Empréstimo</Label>
                  <Input
                    id="dataEmprestimo"
                    type="date"
                    value={formData.dataEmprestimo}
                    onChange={(e) => setFormData({ ...formData, dataEmprestimo: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="valor">Valor Emprestado (R$)</Label>
                  <Input
                    id="valor"
                    type="number"
                    step="0.01"
                    value={formData.valorEmprestado}
                    onChange={(e) => setFormData({ ...formData, valorEmprestado: e.target.value })}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="percentual">Percentual (%)</Label>
                  <Input
                    id="percentual"
                    type="number"
                    step="0.1"
                    value={formData.percentual}
                    onChange={(e) => setFormData({ ...formData, percentual: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="parcelas">Número de Parcelas</Label>
                  <Input
                    id="parcelas"
                    type="number"
                    value={formData.numeroParcelas}
                    onChange={(e) => setFormData({ ...formData, numeroParcelas: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipoJuros">Tipo de Juros</Label>
                  <Select value={formData.tipoJuros} onValueChange={(value: any) => setFormData({ ...formData, tipoJuros: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simples">Juros Fixo</SelectItem>
                      <SelectItem value="parcela">Juros por Parcela</SelectItem>
                      <SelectItem value="composto">Juros Composto</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.tipoJuros && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {getExplicacaoJuros()}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="periodicidade">Periodicidade</Label>
                <Select value={formData.periodicidade} onValueChange={(value: any) => setFormData({ ...formData, periodicidade: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a periodicidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diario">Diário</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="quinzenal">Quinzenal</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-1 md:col-span-2 space-y-3">
                <Label className="text-sm font-medium">Dias permitidos para cobrança</Label>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="sabado"
                      checked={formData.permiteCobrancaSabado}
                      onCheckedChange={(checked) => 
                        setFormData({ ...formData, permiteCobrancaSabado: checked as boolean })
                      }
                    />
                    <label 
                      htmlFor="sabado" 
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Permitir cobrança aos sábados
                    </label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="domingo"
                      checked={formData.permiteCobrancaDomingo}
                      onCheckedChange={(checked) => 
                        setFormData({ ...formData, permiteCobrancaDomingo: checked as boolean })
                      }
                    />
                    <label 
                      htmlFor="domingo" 
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Permitir cobrança aos domingos
                    </label>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Se um dia não for permitido, a parcela será automaticamente movida para o próximo dia útil permitido.
                </p>
              </div>

              {calcularContrato() && (
                <Card className="bg-muted">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Valor Total</p>
                        <p className="font-semibold">R$ {calcularContrato()?.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Valor da Parcela</p>
                        <p className="font-semibold">R$ {calcularContrato()?.valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Lucro</p>
                        <p className="font-semibold text-success">R$ {calcularContrato()?.lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex flex-col md:flex-row gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handlePreview} disabled={!calcularContrato()} className="flex-1">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                <Button type="submit" className="flex-1">
                  <FileText className="h-4 w-4 mr-2" />
                  Criar Contrato
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Preview do Contrato</DialogTitle>
          </DialogHeader>
          {previewData && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Dados do Contrato</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm sm:text-base">
                  <div className="space-y-2">
                    <p><strong>Cliente:</strong> {previewData.cliente}</p>
                    <p><strong>Data:</strong> {format(new Date(previewData.dataEmprestimo + 'T00:00:00'), 'dd/MM/yyyy')}</p>
                    <p><strong>Periodicidade:</strong> {previewData.periodicidade}</p>
                  </div>
                  <div className="space-y-2">
                    <p><strong>Valor Emprestado:</strong> R$ {parseFloat(previewData.valorEmprestado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p><strong>Percentual:</strong> {previewData.percentual}%</p>
                    <p><strong>Valor Total:</strong> R$ {previewData.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Cronograma de Parcelas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[60px]">Parcela</TableHead>
                          <TableHead className="min-w-[100px]">Data de Vencimento</TableHead>
                          <TableHead className="min-w-[80px]">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.parcelas.map((parcela: PreviewParcela) => (
                          <TableRow key={parcela.numero}>
                            <TableCell className="font-medium">{parcela.numero}</TableCell>
                            <TableCell className="text-xs sm:text-sm">{format(new Date(parcela.data + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell>
                            <TableCell className="text-xs sm:text-sm">R$ {parcela.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detalhes do Contrato e Parcelas */}
      <Dialog open={isContratoDetailsOpen} onOpenChange={setIsContratoDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full p-4 sm:p-6">
          <DialogHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pr-8">
              <DialogTitle className="text-lg sm:text-xl">Detalhes do Contrato</DialogTitle>
              <div className="flex gap-2 flex-col sm:flex-row">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={gerarImagemContrato}
                  className="w-full sm:w-auto"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Imagem
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={gerarRelatorioPDF}
                  className="w-full sm:w-auto"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Baixar PDF
                </Button>
                {selectedContrato?.status !== 'quitado' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={abrirModalEdicao}
                    className="w-full sm:w-auto"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar Juros
                  </Button>
                )}
                {selectedContrato?.status === 'quitado' && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleRenovarContrato(selectedContrato)}
                    className="w-full sm:w-auto"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Renovar Contrato
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setContratoToDelete(selectedContrato.id);
                    setIsDeleteDialogOpen(true);
                  }}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Contrato
                </Button>
              </div>
            </div>
          </DialogHeader>
          {selectedContrato && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Informações do Contrato</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm sm:text-base">
                  <div className="space-y-2">
                    <p><strong>Cliente:</strong> {selectedContrato.clientes?.nome}</p>
                    <p><strong>Data:</strong> {format(new Date(selectedContrato.data_emprestimo + 'T00:00:00'), 'dd/MM/yyyy')}</p>
                    <p><strong>Periodicidade:</strong> {selectedContrato.periodicidade}</p>
                    <p><strong>Número de Parcelas:</strong> {selectedContrato.numero_parcelas}</p>
                    <p><strong>Tipo de Juros:</strong> {selectedContrato.tipo_juros === 'parcela' ? 'Por Parcela' : selectedContrato.tipo_juros === 'composto' ? 'Composto' : 'Fixo'}</p>
                  </div>
                  <div className="space-y-2">
                    <p><strong>Valor Emprestado:</strong> R$ {Number(selectedContrato.valor_emprestado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p><strong>Percentual:</strong> {Number(selectedContrato.percentual)}%</p>
                    <p><strong>Valor Total:</strong> R$ {Number(selectedContrato.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p><strong>Status:</strong> <Badge variant={selectedContrato.status === 'ativo' ? 'default' : selectedContrato.status === 'quitado' ? 'outline' : 'secondary'}>{selectedContrato.status === 'ativo' ? 'Ativo' : selectedContrato.status === 'quitado' ? 'Quitado' : selectedContrato.status}</Badge></p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Parcelas</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* View Desktop - Tabela */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Parcela</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Pagamento</TableHead>
                          <TableHead>Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parcelas.map((parcela) => (
                          <TableRow key={parcela.id}>
                            <TableCell className="font-medium">{parcela.numero_parcela}</TableCell>
                            <TableCell>{format(new Date(parcela.data_vencimento + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell>
                            <TableCell>R$ {Number(parcela.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell>
                              {parcela.status === 'pago' ? (
                                <Badge variant="default" className="bg-success">Pago</Badge>
                              ) : new Date(parcela.data_vencimento + 'T00:00:00') < new Date(new Date().setHours(0, 0, 0, 0)) ? (
                                <Badge variant="destructive">Atrasado</Badge>
                              ) : (
                                <Badge variant="secondary">Pendente</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {parcela.data_pagamento ? (
                                <div className="text-sm">
                                  <div>{format(new Date(parcela.data_pagamento + 'T00:00:00'), 'dd/MM/yyyy')}</div>
                                  <div className="text-muted-foreground">R$ {Number(parcela.valor_pago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {parcela.status !== 'pago' ? (
                                <Button 
                                  size="sm" 
                                  onClick={() => abrirModalPagamento(parcela)}
                                  title="Baixar parcela"
                                >
                                  Baixar
                                </Button>
                              ) : (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleDesfazerPagamento(parcela.id)}
                                  className="text-warning hover:bg-warning hover:text-warning-foreground"
                                  title="Desfazer pagamento"
                                >
                                  <Undo2 className="h-4 w-4 mr-1" />
                                  Desfazer
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* View Mobile - Cards */}
                  <div className="md:hidden space-y-3">
                    {parcelas.map((parcela) => (
                      <Card key={parcela.id} className="p-3">
                        {/* Cabeçalho: Número da Parcela e Status */}
                        <div className="flex justify-between items-center mb-3">
                          <span className="font-bold text-base">Parcela {parcela.numero_parcela}</span>
                          {parcela.status === 'pago' ? (
                            <Badge variant="default" className="bg-success">Pago</Badge>
                          ) : new Date(parcela.data_vencimento + 'T00:00:00') < new Date(new Date().setHours(0, 0, 0, 0)) ? (
                            <Badge variant="destructive">Atrasado</Badge>
                          ) : (
                            <Badge variant="secondary">Pendente</Badge>
                          )}
                        </div>
                        
                        {/* Informações */}
                        <div className="space-y-1.5 text-sm text-muted-foreground mb-3">
                          <div className="flex justify-between">
                            <span>Vencimento:</span>
                            <span className="font-medium text-foreground">
                              {format(new Date(parcela.data_vencimento + 'T00:00:00'), 'dd/MM/yyyy')}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Valor:</span>
                            <span className="font-medium text-foreground">
                              R$ {Number(parcela.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          {parcela.data_pagamento && (
                            <>
                              <div className="flex justify-between">
                                <span>Pago em:</span>
                                <span className="font-medium text-foreground">
                                  {format(new Date(parcela.data_pagamento + 'T00:00:00'), 'dd/MM/yyyy')}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Valor pago:</span>
                                <span className="font-medium text-foreground">
                                  R$ {Number(parcela.valor_pago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                        
                        {/* Botão de Ação */}
                        {parcela.status !== 'pago' ? (
                          <Button 
                            size="sm" 
                            onClick={() => abrirModalPagamento(parcela)}
                            className="w-full"
                            title="Baixar parcela"
                          >
                            Baixar Parcela
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleDesfazerPagamento(parcela.id)}
                            className="w-full text-warning hover:bg-warning hover:text-warning-foreground"
                            title="Desfazer pagamento"
                          >
                            <Undo2 className="h-4 w-4 mr-2" />
                            Desfazer Pagamento
                          </Button>
                        )}
                      </Card>
                    ))}
                  </div>
                </CardContent>
      </Card>

      {/* Dialog de Confirmação de Pagamento */}
      <Dialog open={isPagamentoDialogOpen} onOpenChange={setIsPagamentoDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Confirmar Pagamento</DialogTitle>
            <DialogDescription className="text-sm">
              {parcelaToPay && (
                <>
                  Parcela {parcelaToPay.numero_parcela} - {selectedContrato?.clientes?.nome}
                  <br />
                  Valor da parcela: R$ {Number(parcelaToPay.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <RadioGroup value={tipoPagamento} onValueChange={setTipoPagamento}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="total" id="total" />
                <Label htmlFor="total" className="cursor-pointer">
                  Pagar valor total (R$ {parcelaToPay ? Number(parcelaToPay.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'})
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="juros" id="juros" />
                <Label htmlFor="juros" className="cursor-pointer">
                  Pagar somente juros (R$ {parcelaToPay ? calcularJuros(parcelaToPay).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'})
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="personalizado" id="personalizado" />
                <Label htmlFor="personalizado" className="cursor-pointer">
                  Valor personalizado
                </Label>
              </div>
            </RadioGroup>

            {tipoPagamento === "personalizado" && (
              <div className="space-y-2">
                <Label htmlFor="valorPagamento">Valor do Pagamento</Label>
                <Input
                  id="valorPagamento"
                  type="number"
                  step="0.01"
                  min="0"
                  max={parcelaToPay?.valor}
                  value={valorPagamento}
                  onChange={(e) => setValorPagamento(e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Valor máximo: R$ {parcelaToPay ? Number(parcelaToPay.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                </p>
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
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsPagamentoDialogOpen(false);
                setParcelaToPay(null);
                setTipoPagamento("total");
                setValorPagamento("");
              }}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirmarPagamento} className="w-full sm:w-auto">
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="w-[95vw] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este contrato? Esta ação não pode ser desfeita.
              Todas as parcelas associadas também serão excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteContrato} className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Lista de Contratos */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base md:text-lg">
            {statusFilter === "ativos" ? "Contratos Ativos" : statusFilter === "quitados" ? "Contratos Quitados" : "Todos os Contratos"} ({contratosFiltrados.length})
          </CardTitle>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={statusFilter === "ativos" ? "default" : "outline"}
              onClick={() => setStatusFilter("ativos")}
              className="text-xs"
            >
              Ativos
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "quitados" ? "default" : "outline"}
              onClick={() => setStatusFilter("quitados")}
              className="text-xs"
            >
              Quitados
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "todos" ? "default" : "outline"}
              onClick={() => setStatusFilter("todos")}
              className="text-xs"
            >
              Todos
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 md:p-6">
          {/* Mobile - Cards */}
          <div className="md:hidden space-y-2 p-3">
            {contratosFiltrados.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum contrato encontrado</p>
            ) : (
              contratosFiltrados.map((contrato) => (
                <Card
                  key={contrato.id}
                  className="cursor-pointer hover:bg-muted/50 p-3"
                  onClick={() => handleContratoClick(contrato)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{contrato.clientes?.nome}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {contrato.periodicidade} • {Number(contrato.percentual)}% • {contrato.numero_parcelas}x
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold">R$ {Number(contrato.valor_total).toLocaleString('pt-BR')}</p>
                      <Badge variant={contrato.status === "ativo" ? "default" : contrato.status === "quitado" ? "outline" : "secondary"} className="text-[10px] mt-0.5">
                        {contrato.status === "ativo" ? "Ativo" : contrato.status === "quitado" ? "Quitado" : contrato.status}
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Desktop - Table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px] pl-3">Cliente</TableHead>
                  <TableHead>Valor Emprestado</TableHead>
                  <TableHead className="hidden lg:table-cell">Percentual</TableHead>
                  <TableHead>Periodicidade</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratosFiltrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum contrato encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  contratosFiltrados.map((contrato) => (
                    <TableRow 
                      key={contrato.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleContratoClick(contrato)}
                    >
                      <TableCell className="font-medium pl-3">{contrato.clientes?.nome}</TableCell>
                      <TableCell className="text-sm">R$ {Number(contrato.valor_emprestado).toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">{Number(contrato.percentual)}%</TableCell>
                      <TableCell className="text-sm capitalize">{contrato.periodicidade}</TableCell>
                      <TableCell className="text-sm">R$ {Number(contrato.valor_total).toLocaleString('pt-BR')}</TableCell>
                      <TableCell>
                        <Badge variant={contrato.status === "ativo" ? "default" : contrato.status === "quitado" ? "outline" : "secondary"} className="text-xs">
                          {contrato.status === "ativo" ? "Ativo" : contrato.status === "quitado" ? "Quitado" : contrato.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Edição de Contrato */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg w-[95vw] sm:w-full p-4 sm:p-6 max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Editar Tipo de Juros</DialogTitle>
            <DialogDescription>
              Altere o tipo de juros e o percentual. As parcelas pendentes serão recalculadas automaticamente.
            </DialogDescription>
          </DialogHeader>
          
          {selectedContrato && (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Info do contrato */}
              <Card className="bg-muted/50">
                <CardContent className="pt-4 text-sm space-y-1">
                  <p><strong>Cliente:</strong> {selectedContrato.clientes?.nome}</p>
                  <p><strong>Valor Emprestado:</strong> R$ {Number(selectedContrato.valor_emprestado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  <p><strong>Parcelas:</strong> {selectedContrato.numero_parcelas} ({parcelas.filter(p => p.status === 'pago').length} pagas, {parcelas.filter(p => p.status === 'pendente').length} pendentes)</p>
                </CardContent>
              </Card>

              {/* Aviso se houver parcelas pagas */}
              {parcelas.filter(p => p.status === 'pago').length > 0 && (
                <div className="bg-warning/10 border border-warning/30 rounded-md p-3 text-sm">
                  <p className="font-medium text-warning">⚠️ Atenção</p>
                  <p className="text-muted-foreground mt-1">
                    {parcelas.filter(p => p.status === 'pago').length} parcela(s) já foi(ram) paga(s). 
                    O novo cálculo será aplicado apenas às {parcelas.filter(p => p.status === 'pendente').length} parcela(s) pendente(s).
                  </p>
                </div>
              )}

              {/* Formulário */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de Juros Atual</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedContrato.tipo_juros === 'parcela' ? 'Juros por Parcela' : selectedContrato.tipo_juros === 'composto' ? 'Juros Composto' : 'Juros Fixo'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Novo Tipo de Juros</Label>
                  <Select value={editFormData.tipoJuros} onValueChange={(value: any) => setEditFormData({ ...editFormData, tipoJuros: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simples">Juros Fixo</SelectItem>
                      <SelectItem value="parcela">Juros por Parcela</SelectItem>
                      <SelectItem value="composto">Juros Composto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editPercentual">Percentual (%)</Label>
                  <Input
                    id="editPercentual"
                    type="number"
                    step="0.1"
                    value={editFormData.percentual}
                    onChange={(e) => setEditFormData({ ...editFormData, percentual: e.target.value })}
                    placeholder={String(selectedContrato.percentual)}
                  />
                  <p className="text-xs text-muted-foreground">Deixe em branco para manter o percentual atual ({selectedContrato.percentual}%)</p>
                </div>
              </div>

              {/* Preview do cálculo */}
              {calcularPreviewEdicao() && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-4 space-y-2 text-sm">
                    <p className="font-medium">📊 Preview do Novo Cálculo:</p>
                    <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                      <span>Valor Total Anterior:</span>
                      <span className="font-medium text-foreground">R$ {calcularPreviewEdicao()?.valorTotalAnterior.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      
                      <span>Valor Total Novo:</span>
                      <span className="font-medium text-foreground">R$ {calcularPreviewEdicao()?.valorTotalNovo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      
                      <span>Valor Já Pago:</span>
                      <span className="font-medium text-foreground">R$ {calcularPreviewEdicao()?.valorJaPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      
                      <span>Valor a Pagar:</span>
                      <span className="font-medium text-foreground">R$ {calcularPreviewEdicao()?.valorRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      
                      <span>Valor Nova Parcela:</span>
                      <span className="font-medium text-primary">R$ {calcularPreviewEdicao()?.valorNovaParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={handleEditContrato} disabled={isEditLoading} className="w-full sm:w-auto">
              {isEditLoading ? "Salvando..." : "Confirmar Alteração"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Comprovante Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={(open) => {
        setIsImportDialogOpen(open);
        if (!open) {
          setDadosComprovante(null);
          setImportStep("upload");
          setShowClienteOverride(false);
          setSelectedOverrideClienteId("");
          setNovoClienteNome("");
        }
      }}>
        <DialogContent className="max-w-md w-[95vw] sm:w-full p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg">Importar Comprovante PIX</DialogTitle>
            <DialogDescription>
              {importStep === "upload"
                ? "Faça upload de uma imagem ou PDF do comprovante PIX para extrair os dados automaticamente."
                : "Confira os dados extraídos do comprovante antes de confirmar."}
            </DialogDescription>
          </DialogHeader>

          {importStep === "upload" && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-3">
                  Selecione uma imagem (PNG, JPG) ou PDF
                </p>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,application/pdf"
                  className="max-w-xs mx-auto"
                  disabled={isImportLoading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImportComprovante(file);
                  }}
                />
              </div>
              {isImportLoading && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processando comprovante...
                </div>
              )}
            </div>
          )}

          {importStep === "review" && dadosComprovante && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-muted-foreground text-xs">Cliente</p>
                          {!showClienteOverride ? (
                            <p className="font-medium">{dadosComprovante.nome_cliente}</p>
                          ) : (
                            <p className="font-medium text-muted-foreground text-xs italic">Original: {dadosComprovante.nome_cliente}</p>
                          )}
                        </div>
                        {!showClienteOverride && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setShowClienteOverride(true);
                              setClienteOverrideType("existing");
                              setSelectedOverrideClienteId("");
                              setNovoClienteNome(dadosComprovante.nome_cliente);
                            }}
                            className="h-8 px-2 text-xs"
                          >
                            <ArrowRightLeft className="h-3 w-3 mr-1" />
                            Trocar
                          </Button>
                        )}
                      </div>

                      {showClienteOverride && (
                        <div className="mt-3 space-y-3 border rounded-md p-3 bg-muted/30">
                          <RadioGroup value={clienteOverrideType} onValueChange={(v) => setClienteOverrideType(v as "existing" | "new")}>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="existing" id="override-existing" />
                              <Label htmlFor="override-existing" className="cursor-pointer text-xs">Cliente existente</Label>
                            </div>
                            {clienteOverrideType === "existing" && (
                              <Select value={selectedOverrideClienteId} onValueChange={setSelectedOverrideClienteId}>
                                <SelectTrigger className="h-9 text-xs">
                                  <SelectValue placeholder="Selecione um cliente" />
                                </SelectTrigger>
                                <SelectContent>
                                  {clientes.map((c) => (
                                    <SelectItem key={c.id} value={c.id} className="text-xs">{c.nome}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="new" id="override-new" />
                              <Label htmlFor="override-new" className="cursor-pointer text-xs">Novo cliente</Label>
                            </div>
                            {clienteOverrideType === "new" && (
                              <Input
                                value={novoClienteNome}
                                onChange={(e) => setNovoClienteNome(e.target.value)}
                                placeholder="Nome do novo cliente"
                                className="h-9 text-xs"
                              />
                            )}
                          </RadioGroup>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setShowClienteOverride(false);
                              setSelectedOverrideClienteId("");
                              setNovoClienteNome("");
                            }}
                            className="h-7 text-xs"
                          >
                            Cancelar
                          </Button>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Valor</p>
                      <p className="font-medium">R$ {dadosComprovante.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Data</p>
                      <p className="font-medium">{dadosComprovante.data ? format(new Date(dadosComprovante.data + "T00:00:00"), "dd/MM/yyyy") : "N/A"}</p>
                    </div>
                    {dadosComprovante.chave_pix && (
                      <div>
                        <p className="text-muted-foreground text-xs">Chave PIX ({dadosComprovante.tipo_chave})</p>
                        <p className="font-medium text-xs break-all">{dadosComprovante.chave_pix}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => {
                  setImportStep("upload");
                  setDadosComprovante(null);
                  setShowClienteOverride(false);
                }} className="w-full sm:w-auto">
                  Tentar novamente
                </Button>
                <Button onClick={handleConfirmImport} className="w-full sm:w-auto" disabled={showClienteOverride && clienteOverrideType === "existing" && !selectedOverrideClienteId || showClienteOverride && clienteOverrideType === "new" && !novoClienteNome.trim()}>
                  <FileText className="h-4 w-4 mr-2" />
                  Confirmar e Criar Contrato
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Acesso Restrito */}
      <AccessRestrictedModal
        open={isAccessModalOpen}
        onOpenChange={setIsAccessModalOpen}
        userEmail={userEmail}
      />
    </div>
  );
}
