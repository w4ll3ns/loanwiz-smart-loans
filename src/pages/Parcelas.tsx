import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Check, X, Calendar, AlertTriangle, Trash2, Undo2, FileText } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Parcela {
  id: string;
  contrato_id: string;
  numero_parcela: number;
  valor: number;
  valor_original: number;
  data_vencimento: string;
  data_pagamento?: string;
  valor_pago?: number;
  status: string;
  contratos?: {
    clientes?: {
      nome: string;
    };
    percentual?: number;
    tipo_juros?: string;
  };
}

interface HistoricoPagamento {
  id: string;
  valor_pago: number;
  tipo_pagamento: string;
  data_pagamento: string;
  observacao?: string;
}

export default function Parcelas() {
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [parcelaToDelete, setParcelaToDelete] = useState<string | null>(null);
  const [isPagamentoDialogOpen, setIsPagamentoDialogOpen] = useState(false);
  const [isHistoricoDialogOpen, setIsHistoricoDialogOpen] = useState(false);
  const [parcelaToPay, setParcelaToPay] = useState<Parcela | null>(null);
  const [parcelaHistorico, setParcelaHistorico] = useState<Parcela | null>(null);
  const [historicoPagamentos, setHistoricoPagamentos] = useState<HistoricoPagamento[]>([]);
  const [tipoPagamento, setTipoPagamento] = useState<string>("total");
  const [valorPagamento, setValorPagamento] = useState<string>("");
  const { toast } = useToast();

  // Função para formatar data corretamente (evita problema de timezone)
  const formatDate = (dateString: string) => {
    return format(new Date(dateString + 'T00:00:00'), 'dd/MM/yyyy');
  };

  useEffect(() => {
    loadParcelas();
  }, []);

  const loadParcelas = async () => {
    try {
      const { data, error } = await supabase
        .from("parcelas")
        .select(`
          *,
          contratos!inner(
            clientes!inner(nome),
            percentual,
            tipo_juros
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

  const filteredParcelas = parcelas.filter(parcela => {
    const clienteNome = parcela.contratos?.clientes?.nome || "";
    const matchesSearch = clienteNome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "todos" || parcela.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const calcularJuros = (parcela: Parcela) => {
    const percentual = parcela.contratos?.percentual || 0;
    // Juros sempre calculados sobre o valor ORIGINAL, mesmo com pagamentos parciais
    const valorOriginal = Number(parcela.valor_original || parcela.valor);
    return (valorOriginal * percentual) / 100;
  };

  const abrirModalPagamento = (parcela: Parcela) => {
    setParcelaToPay(parcela);
    setTipoPagamento("total");
    // Calcular valor restante (valor original - valor já pago)
    const valorRestante = Number(parcela.valor_original || parcela.valor) - (Number(parcela.valor_pago) || 0);
    setValorPagamento(valorRestante.toString());
    setIsPagamentoDialogOpen(true);
  };

  const handleConfirmarPagamento = async () => {
    if (!parcelaToPay) return;

    try {
      let valorPagar = 0;
      let tipoPag = tipoPagamento;

      if (tipoPagamento === "total") {
        // Paga o valor restante
        const valorRestante = Number(parcelaToPay.valor_original || parcelaToPay.valor) - (Number(parcelaToPay.valor_pago) || 0);
        valorPagar = valorRestante;
      } else if (tipoPagamento === "juros") {
        valorPagar = calcularJuros(parcelaToPay);
        tipoPag = "juros";
      } else if (tipoPagamento === "personalizado") {
        valorPagar = Number(valorPagamento);
        tipoPag = "parcial";
      }

      // Registrar pagamento no histórico
      const { error: historicoError } = await supabase
        .from("parcelas_pagamentos")
        .insert({
          parcela_id: parcelaToPay.id,
          valor_pago: valorPagar,
          tipo_pagamento: tipoPag,
          data_pagamento: new Date().toISOString(),
        });

      if (historicoError) throw historicoError;

      // Atualizar valor pago total
      const novoValorPago = (Number(parcelaToPay.valor_pago) || 0) + valorPagar;
      const valorOriginal = Number(parcelaToPay.valor_original || parcelaToPay.valor);
      const valorRestante = valorOriginal - novoValorPago;
      
      // Determinar status
      const novoStatus = valorRestante <= 0.01 ? "pago" : "pendente"; // 0.01 para evitar problemas de arredondamento

      // Atualizar parcela
      const updateData: any = {
        valor_pago: novoValorPago,
        status: novoStatus,
        data_pagamento: new Date().toISOString().split('T')[0],
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
        title: novoStatus === "pago" ? "Parcela paga completamente!" : "Pagamento parcial registrado",
        description: novoStatus === "pago"
          ? `Valor total pago: R$ ${novoValorPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          : `Valor pago: R$ ${valorPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Restante: R$ ${valorRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      });

      setIsPagamentoDialogOpen(false);
      setParcelaToPay(null);
      setTipoPagamento("total");
      setValorPagamento("");
      loadParcelas();
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
        .from("parcelas_pagamentos")
        .select("*")
        .eq("parcela_id", parcela.id)
        .order("data_pagamento", { ascending: false });

      if (error) throw error;

      setHistoricoPagamentos(data || []);
      setParcelaHistorico(parcela);
      setIsHistoricoDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Não foi possível carregar o histórico",
        description: "Verifique sua conexão com a internet e tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleExcluirPagamento = async (pagamentoId: string) => {
    if (!parcelaHistorico) return;

    try {
      // Deletar o pagamento específico
      const { error: deleteError } = await supabase
        .from("parcelas_pagamentos")
        .delete()
        .eq("id", pagamentoId);

      if (deleteError) throw deleteError;

      // Buscar pagamentos restantes
      const { data: pagamentosRestantes, error: fetchError } = await supabase
        .from("parcelas_pagamentos")
        .select("valor_pago")
        .eq("parcela_id", parcelaHistorico.id);

      if (fetchError) throw fetchError;

      // Calcular novo total pago
      const novoValorPago = pagamentosRestantes?.reduce(
        (sum, p) => sum + Number(p.valor_pago), 
        0
      ) || 0;

      const valorOriginal = Number(parcelaHistorico.valor_original || parcelaHistorico.valor);

      // Atualizar parcela
      const { error: updateError } = await supabase
        .from("parcelas")
        .update({
          valor_pago: novoValorPago,
          status: novoValorPago >= valorOriginal ? "pago" : "pendente",
          data_pagamento: novoValorPago >= valorOriginal ? new Date().toISOString().split('T')[0] : null,
        })
        .eq("id", parcelaHistorico.id);

      if (updateError) throw updateError;

      toast({
        title: "Pagamento excluído",
        description: "O pagamento foi removido e a parcela foi recalculada.",
      });

      // Recarregar histórico e parcelas
      await loadHistorico(parcelaHistorico);
      loadParcelas();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir pagamento",
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

  const getStatusBadge = (parcela: Parcela) => {
    if (parcela.status === "pago") {
      return <Badge variant="default" className="bg-success">Pago</Badge>;
    }
    
    const diasAtraso = calcularDiasAtraso(parcela.data_vencimento);
    if (diasAtraso > 0) {
      return <Badge variant="destructive">Vencido ({diasAtraso}d)</Badge>;
    }
    
    return <Badge variant="secondary">Pendente</Badge>;
  };

  const totalPendente = filteredParcelas
    .filter(p => p.status !== "pago")
    .reduce((acc, p) => acc + (Number(p.valor_original || p.valor) - (Number(p.valor_pago) || 0)), 0);

  const totalPago = filteredParcelas
    .reduce((acc, p) => acc + (Number(p.valor_pago) || 0), 0);

  const totalVencido = filteredParcelas
    .filter(p => p.status === "pendente" && calcularDiasAtraso(p.data_vencimento) > 0)
    .reduce((acc, p) => acc + (Number(p.valor_original || p.valor) - (Number(p.valor_pago) || 0)), 0);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Gestão de Parcelas</h1>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Pendente</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg md:text-2xl font-bold">
              R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredParcelas.filter(p => p.status !== "pago").length} parcelas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Recebido</CardTitle>
            <Check className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-lg md:text-2xl font-bold text-success">
              R$ {totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredParcelas.filter(p => p.status === "pago").length} parcelas pagas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Vencido</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-lg md:text-2xl font-bold text-destructive">
              R$ {totalVencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredParcelas.filter(p => p.status === "pendente" && calcularDiasAtraso(p.data_vencimento) > 0).length} parcelas em atraso
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 md:pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="md:w-48">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Parcelas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">Parcelas ({filteredParcelas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Cliente</TableHead>
                  <TableHead className="hidden md:table-cell">Parcela</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead className="hidden md:table-cell">Vencimento</TableHead>
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
                        <div className="md:hidden text-xs text-muted-foreground mt-1">
                          Parcela {parcela.numero_parcela} • {formatDate(parcela.data_vencimento)}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{parcela.numero_parcela}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>R$ {Number(parcela.valor_original || parcela.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          {parcela.valor_pago && parcela.valor_pago > 0 && (
                            <span className="text-xs text-muted-foreground">
                              Pago: R$ {Number(parcela.valor_pago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{formatDate(parcela.data_vencimento)}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {parcela.data_pagamento 
                          ? formatDate(parcela.data_pagamento)
                          : "-"
                        }
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(parcela)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => loadHistorico(parcela)}
                            title="Ver histórico de pagamentos"
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento</DialogTitle>
            <DialogDescription>
              {parcelaToPay && (
                <>
                  Parcela {parcelaToPay.numero_parcela} - {parcelaToPay.contratos?.clientes?.nome}
                  <br />
                  Valor original: R$ {Number(parcelaToPay.valor_original || parcelaToPay.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  {parcelaToPay.valor_pago && parcelaToPay.valor_pago > 0 && (
                    <>
                      <br />
                      Já pago: R$ {Number(parcelaToPay.valor_pago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      <br />
                      Restante: R$ {(Number(parcelaToPay.valor_original || parcelaToPay.valor) - Number(parcelaToPay.valor_pago)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                <Label htmlFor="total" className="cursor-pointer">
                  Pagar valor restante (R$ {parcelaToPay ? ((Number(parcelaToPay.valor_original || parcelaToPay.valor) - (Number(parcelaToPay.valor_pago) || 0))).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'})
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
                  max={parcelaToPay ? (Number(parcelaToPay.valor_original || parcelaToPay.valor) - (Number(parcelaToPay.valor_pago) || 0)) : 0}
                  value={valorPagamento}
                  onChange={(e) => setValorPagamento(e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Valor máximo: R$ {parcelaToPay ? ((Number(parcelaToPay.valor_original || parcelaToPay.valor) - (Number(parcelaToPay.valor_pago) || 0))).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
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

      {/* Dialog de Histórico de Pagamentos */}
      <Dialog open={isHistoricoDialogOpen} onOpenChange={setIsHistoricoDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de Pagamentos</DialogTitle>
            <DialogDescription>
              {parcelaHistorico && (
                <>
                  Parcela {parcelaHistorico.numero_parcela} - {parcelaHistorico.contratos?.clientes?.nome}
                  <br />
                  Valor original: R$ {Number(parcelaHistorico.valor_original || parcelaHistorico.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  <br />
                  Total pago: R$ {Number(parcelaHistorico.valor_pago || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  <br />
                  Saldo: R$ {(Number(parcelaHistorico.valor_original || parcelaHistorico.valor) - Number(parcelaHistorico.valor_pago || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {historicoPagamentos.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Nenhum pagamento registrado ainda
              </p>
            ) : (
              <div className="space-y-2">
                {historicoPagamentos.map((pagamento) => (
                  <Card key={pagamento.id}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <p className="font-medium">
                            R$ {Number(pagamento.valor_pago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(pagamento.data_pagamento), 'dd/MM/yyyy')} às{' '}
                            {format(new Date(pagamento.data_pagamento), 'HH:mm')}
                          </p>
                          {pagamento.observacao && (
                            <p className="text-sm text-muted-foreground mt-1">{pagamento.observacao}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            pagamento.tipo_pagamento === 'total' ? 'default' :
                            pagamento.tipo_pagamento === 'juros' ? 'secondary' :
                            'outline'
                          }>
                            {pagamento.tipo_pagamento === 'total' ? 'Pagamento Total' :
                             pagamento.tipo_pagamento === 'juros' ? 'Somente Juros' :
                             'Pagamento Parcial'}
                          </Badge>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => handleExcluirPagamento(pagamento.id)}
                            title="Excluir este pagamento"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHistoricoDialogOpen(false)}>
              Fechar
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
              Tem certeza que deseja excluir esta parcela? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
