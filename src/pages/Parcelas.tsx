import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Check, X, Calendar, AlertTriangle, Trash2, Undo2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Parcela {
  id: string;
  contrato_id: string;
  numero_parcela: number;
  valor: number;
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

export default function Parcelas() {
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [parcelaToDelete, setParcelaToDelete] = useState<string | null>(null);
  const [isPagamentoDialogOpen, setIsPagamentoDialogOpen] = useState(false);
  const [parcelaToPay, setParcelaToPay] = useState<Parcela | null>(null);
  const [tipoPagamento, setTipoPagamento] = useState<string>("total");
  const [valorPagamento, setValorPagamento] = useState<string>("");
  const { toast } = useToast();

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
    const vencimento = new Date(dataVencimento);
    vencimento.setHours(0, 0, 0, 0);
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
      const { error } = await supabase
        .from("parcelas")
        .update({
          status: "pendente",
          data_pagamento: null,
          valor_pago: null,
        })
        .eq("id", parcelaId);

      if (error) throw error;

      toast({
        title: "Pagamento desfeito",
        description: "A parcela foi marcada como pendente novamente.",
      });

      loadParcelas();
    } catch (error: any) {
      toast({
        title: "Não foi possível desfazer o pagamento",
        description: "Verifique sua conexão com a internet e tente novamente.",
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
    .reduce((acc, p) => acc + Number(p.valor), 0);

  const totalPago = filteredParcelas
    .filter(p => p.status === "pago")
    .reduce((acc, p) => acc + Number(p.valor), 0);

  const totalVencido = filteredParcelas
    .filter(p => p.status === "pendente" && calcularDiasAtraso(p.data_vencimento) > 0)
    .reduce((acc, p) => acc + Number(p.valor), 0);

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
                          Parcela {parcela.numero_parcela} • {new Date(parcela.data_vencimento).toLocaleDateString('pt-BR')}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{parcela.numero_parcela}</TableCell>
                      <TableCell>R$ {Number(parcela.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="hidden md:table-cell">{new Date(parcela.data_vencimento).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {parcela.data_pagamento 
                          ? new Date(parcela.data_pagamento).toLocaleDateString('pt-BR')
                          : "-"
                        }
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(parcela)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
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
