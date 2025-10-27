import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
import { Plus, FileText, Eye, Trash2, Undo2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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

export default function Contratos() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isContratoDetailsOpen, setIsContratoDetailsOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [contratoToDelete, setContratoToDelete] = useState<string | null>(null);
  const [selectedContrato, setSelectedContrato] = useState<Contrato | null>(null);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [previewData, setPreviewData] = useState<any>(null);
  const [isPagamentoDialogOpen, setIsPagamentoDialogOpen] = useState(false);
  const [parcelaToPay, setParcelaToPay] = useState<Parcela | null>(null);
  const [tipoPagamento, setTipoPagamento] = useState<string>("total");
  const [valorPagamento, setValorPagamento] = useState<string>("");
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    clienteId: "",
    valorEmprestado: "",
    percentual: "",
    periodicidade: "" as "diario" | "semanal" | "quinzenal" | "mensal" | "",
    numeroParcelas: "",
    dataEmprestimo: "",
    tipoJuros: "simples" as "simples" | "parcela" | "composto"
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
        data: dataParcela.toISOString().split('T')[0],
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
    setIsContratoDetailsOpen(true);
  };

  const calcularJuros = (parcela: Parcela) => {
    if (!selectedContrato) return 0;
    const percentual = Number(selectedContrato.percentual) || 0;
    return (Number(parcela.valor) * percentual) / 100;
  };

  const abrirModalPagamento = (parcela: Parcela) => {
    setParcelaToPay(parcela);
    setTipoPagamento("total");
    setValorPagamento(parcela.valor.toString());
    setIsPagamentoDialogOpen(true);
  };

  const handleConfirmarPagamento = async () => {
    if (!parcelaToPay) return;

    try {
      let valorFinal = 0;

      if (tipoPagamento === "total") {
        valorFinal = Number(parcelaToPay.valor);
      } else if (tipoPagamento === "juros") {
        valorFinal = calcularJuros(parcelaToPay);
      } else if (tipoPagamento === "personalizado") {
        valorFinal = Number(valorPagamento);
      }

      const valorRestante = Number(parcelaToPay.valor) - valorFinal;

      // Se pagou o valor total ou mais, marca como pago
      if (valorRestante <= 0) {
        const { error } = await supabase
          .from("parcelas")
          .update({
            data_pagamento: new Date().toISOString().split('T')[0],
            valor_pago: Number(parcelaToPay.valor),
            status: "pago",
          })
          .eq("id", parcelaToPay.id);

        if (error) throw error;

        toast({
          title: "Parcela paga com sucesso",
          description: `Valor pago: R$ ${valorFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        });
      } else {
        // Pagamento parcial - marca como pago e transfere saldo para próxima parcela
        const { error: updateError } = await supabase
          .from("parcelas")
          .update({
            data_pagamento: new Date().toISOString().split('T')[0],
            valor_pago: valorFinal,
            status: "pago",
          })
          .eq("id", parcelaToPay.id);

        if (updateError) throw updateError;

        // Buscar próxima parcela do mesmo contrato
        const { data: proximaParcela, error: proximaError } = await supabase
          .from("parcelas")
          .select("*")
          .eq("contrato_id", parcelaToPay.contrato_id)
          .eq("status", "pendente")
          .gt("numero_parcela", parcelaToPay.numero_parcela)
          .order("numero_parcela", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (proximaError) throw proximaError;

        if (proximaParcela) {
          // Adiciona o valor restante à próxima parcela
          const novoValorProxima = Number(proximaParcela.valor) + valorRestante;
          
          const { error: updateProximaError } = await supabase
            .from("parcelas")
            .update({
              valor: novoValorProxima
            })
            .eq("id", proximaParcela.id);

          if (updateProximaError) throw updateProximaError;

          toast({
            title: "Pagamento parcial registrado",
            description: `Valor pago: R$ ${valorFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Saldo de R$ ${valorRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} transferido para parcela ${proximaParcela.numero_parcela}.`,
          });
        } else {
          toast({
            title: "Pagamento parcial registrado",
            description: `Valor pago: R$ ${valorFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Não há próxima parcela para transferir o saldo de R$ ${valorRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
            variant: "destructive",
          });
        }
      }

      setIsPagamentoDialogOpen(false);
      setParcelaToPay(null);
      setTipoPagamento("total");
      setValorPagamento("");
      
      if (selectedContrato) {
        await loadParcelas(selectedContrato.id);
      }
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
      // Deletar histórico de pagamentos
      const { error: deleteHistoricoError } = await supabase
        .from("parcelas_pagamentos")
        .delete()
        .eq("parcela_id", parcelaId);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const calculo = calcularContrato();
    if (!calculo) {
      toast({
        title: "Dados incompletos",
        description: "Preencha todos os campos obrigatórios: cliente, valor, percentual, periodicidade, número de parcelas e data.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: contrato, error: contratoError } = await supabase
        .from("contratos")
        .insert([{
          cliente_id: formData.clienteId,
          valor_emprestado: parseFloat(formData.valorEmprestado),
          percentual: parseFloat(formData.percentual),
          periodicidade: formData.periodicidade,
          numero_parcelas: parseInt(formData.numeroParcelas),
          data_emprestimo: formData.dataEmprestimo,
          valor_total: calculo.valorTotal,
          status: "ativo",
          tipo_juros: formData.tipoJuros
        }])
        .select()
        .single();

      if (contratoError) throw contratoError;

      // Gerar parcelas usando a função do banco de dados
      const { error: parcelasError } = await supabase.rpc("gerar_parcelas", {
        p_contrato_id: contrato.id,
        p_numero_parcelas: parseInt(formData.numeroParcelas),
        p_valor_parcela: calculo.valorParcela,
        p_data_inicio: formData.dataEmprestimo,
        p_periodicidade: formData.periodicidade
      });

      if (parcelasError) throw parcelasError;

      setFormData({
        clienteId: "",
        valorEmprestado: "",
        percentual: "",
        periodicidade: "",
        numeroParcelas: "",
        dataEmprestimo: "",
        tipoJuros: "simples"
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

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Gestão de Contratos</h1>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full md:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Novo Contrato
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Contrato de Empréstimo</DialogTitle>
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

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview do Contrato</DialogTitle>
          </DialogHeader>
          {previewData && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Dados do Contrato</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p><strong>Cliente:</strong> {previewData.cliente}</p>
                    <p><strong>Data:</strong> {format(new Date(previewData.dataEmprestimo + 'T00:00:00'), 'dd/MM/yyyy')}</p>
                    <p><strong>Periodicidade:</strong> {previewData.periodicidade}</p>
                  </div>
                  <div>
                    <p><strong>Valor Emprestado:</strong> R$ {parseFloat(previewData.valorEmprestado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p><strong>Percentual:</strong> {previewData.percentual}%</p>
                    <p><strong>Valor Total:</strong> R$ {previewData.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cronograma de Parcelas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Parcela</TableHead>
                          <TableHead>Data de Vencimento</TableHead>
                          <TableHead>Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.parcelas.map((parcela: PreviewParcela) => (
                          <TableRow key={parcela.numero}>
                            <TableCell>{parcela.numero}</TableCell>
                            <TableCell>{format(new Date(parcela.data + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell>
                            <TableCell>R$ {parcela.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
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
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Detalhes do Contrato</DialogTitle>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setContratoToDelete(selectedContrato.id);
                  setIsDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir Contrato
              </Button>
            </div>
          </DialogHeader>
          {selectedContrato && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Informações do Contrato</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p><strong>Cliente:</strong> {selectedContrato.clientes?.nome}</p>
                    <p><strong>Data:</strong> {format(new Date(selectedContrato.data_emprestimo + 'T00:00:00'), 'dd/MM/yyyy')}</p>
                    <p><strong>Periodicidade:</strong> {selectedContrato.periodicidade}</p>
                    <p><strong>Número de Parcelas:</strong> {selectedContrato.numero_parcelas}</p>
                  </div>
                  <div>
                    <p><strong>Valor Emprestado:</strong> R$ {Number(selectedContrato.valor_emprestado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p><strong>Percentual:</strong> {Number(selectedContrato.percentual)}%</p>
                    <p><strong>Valor Total:</strong> R$ {Number(selectedContrato.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p><strong>Status:</strong> <Badge variant={selectedContrato.status === 'ativo' ? 'default' : 'secondary'}>{selectedContrato.status}</Badge></p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Parcelas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
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
                            <TableCell>{parcela.numero_parcela}</TableCell>
                            <TableCell>{format(new Date(parcela.data_vencimento + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell>
                            <TableCell>R$ {Number(parcela.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell>
                              <Badge variant={parcela.status === 'pago' ? 'default' : 'secondary'}>
                                {parcela.status}
                              </Badge>
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
                </CardContent>
      </Card>

      {/* Dialog de Confirmação de Pagamento */}
      <Dialog open={isPagamentoDialogOpen} onOpenChange={setIsPagamentoDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento</DialogTitle>
            <DialogDescription>
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
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsPagamentoDialogOpen(false);
                setParcelaToPay(null);
                setTipoPagamento("total");
                setValorPagamento("");
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirmarPagamento}>
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este contrato? Esta ação não pode ser desfeita.
              Todas as parcelas associadas também serão excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteContrato} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
        <CardHeader>
          <CardTitle className="text-base md:text-lg">Contratos Ativos ({contratos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Cliente</TableHead>
                  <TableHead className="hidden md:table-cell">Valor Emprestado</TableHead>
                  <TableHead className="hidden lg:table-cell">Percentual</TableHead>
                  <TableHead className="hidden md:table-cell">Periodicidade</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum contrato encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  contratos.map((contrato) => (
                    <TableRow 
                      key={contrato.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleContratoClick(contrato)}
                    >
                      <TableCell className="font-medium">
                        {contrato.clientes?.nome}
                        <div className="md:hidden text-xs text-muted-foreground mt-1">
                          {contrato.periodicidade} • {contrato.percentual}%
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">R$ {Number(contrato.valor_emprestado).toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="hidden lg:table-cell">{Number(contrato.percentual)}%</TableCell>
                      <TableCell className="hidden md:table-cell capitalize">{contrato.periodicidade}</TableCell>
                      <TableCell>R$ {Number(contrato.valor_total).toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant={contrato.status === "ativo" ? "default" : "secondary"}>
                          {contrato.status === "ativo" ? "Ativo" : contrato.status}
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
    </div>
  );
}
