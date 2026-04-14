import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Download, History, Pencil, RefreshCw, Trash2, Undo2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getLocalDateString } from "@/lib/utils";
import { calcularJurosParcela, calcularValorTotal, getLabelTipoJuros, TipoJuros } from "@/lib/calculos";
import { RelatorioGenerator } from "./RelatorioGenerator";
import { HistoricoModal } from "@/components/parcelas/HistoricoModal";

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

interface ContratoDetailsProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  contrato: Contrato | null;
  parcelas: Parcela[];
  onContratoUpdated: () => void;
  onParcelasUpdated: (contratoId: string) => void;
  onRenovar: (contrato: Contrato) => void;
}

export function ContratoDetails({
  isOpen,
  onOpenChange,
  contrato,
  parcelas,
  onContratoUpdated,
  onParcelasUpdated,
  onRenovar
}: ContratoDetailsProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPagamentoDialogOpen, setIsPagamentoDialogOpen] = useState(false);
  const [parcelaToPay, setParcelaToPay] = useState<Parcela | null>(null);
  const [tipoPagamento, setTipoPagamento] = useState<string>("total");
  const [valorPagamento, setValorPagamento] = useState<string>("");
  const [dataPagamento, setDataPagamento] = useState<string>("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    tipoJuros: "simples" as TipoJuros,
    percentual: ""
  });
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [historicoModalOpen, setHistoricoModalOpen] = useState(false);
  const [parcelaHistorico, setParcelaHistorico] = useState<Parcela | null>(null);
  const [historicoData, setHistoricoData] = useState<any[]>([]);
  const { toast } = useToast();

  if (!contrato) return null;

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

  const calcularJuros = (parcela: Parcela) => {
    return calcularJurosParcela(
      Number(contrato.valor_emprestado),
      contrato.numero_parcelas,
      Number(contrato.percentual)
    );
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

      const novoValorPago = (Number(parcelaToPay.valor_pago) || 0) + valorPagar;
      const novoStatus = tipoPagamento === "total" ? "pago" : "pendente";

      const updateData: any = {
        valor_pago: novoValorPago,
        status: novoStatus,
        data_pagamento: dataPagamento,
      };

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
          : `Valor pago: R$ ${valorPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      });

      if (novoStatus === "pago" && parcelaToPay.contrato_id) {
        const { data: todasParcelas, error: parcelasError } = await supabase
          .from("parcelas")
          .select("status")
          .eq("contrato_id", parcelaToPay.contrato_id);

        if (!parcelasError && todasParcelas) {
          const todasPagas = todasParcelas.every(p => p.status === "pago");
          if (todasPagas) {
            await supabase
              .from("contratos")
              .update({ status: "quitado" })
              .eq("id", parcelaToPay.contrato_id);

            toast({
              title: "Contrato quitado! 🎉",
              description: "Todas as parcelas foram pagas.",
            });
          }
        }
      }

      setIsPagamentoDialogOpen(false);
      setParcelaToPay(null);
      onParcelasUpdated(contrato.id);
      onContratoUpdated();
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
      await supabase
        .from("parcelas_historico")
        .delete()
        .eq("parcela_id", parcelaId)
        .eq("tipo_evento", "pagamento");

      await supabase
        .from("parcelas")
        .update({ status: "pendente", data_pagamento: null, valor_pago: 0 })
        .eq("id", parcelaId);

      toast({ title: "Pagamentos desfeitos", description: "A parcela foi resetada." });
      onParcelasUpdated(contrato.id);
    } catch (error: any) {
      toast({ title: "Erro", description: "Não foi possível desfazer.", variant: "destructive" });
    }
  };

  const abrirModalEdicao = () => {
    setEditFormData({
      tipoJuros: (contrato.tipo_juros || 'simples') as TipoJuros,
      percentual: String(contrato.percentual)
    });
    setIsEditDialogOpen(true);
  };

  const calcularPreviewEdicao = () => {
    const valor = Number(contrato.valor_emprestado);
    const percent = editFormData.percentual ? parseFloat(editFormData.percentual) : Number(contrato.percentual);
    const numParcelas = contrato.numero_parcelas;
    
    if (!valor || !percent || !numParcelas) return null;

    const valorTotalNovo = calcularValorTotal(valor, percent, numParcelas, editFormData.tipoJuros);
    const parcelasPagas = parcelas.filter(p => p.status === 'pago');
    const parcelasPendentes = parcelas.filter(p => p.status === 'pendente');
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
      parcelasPendentes: parcelasPendentes.length
    };
  };

  const handleEditContrato = async () => {
    setIsEditLoading(true);
    try {
      const { error } = await supabase.rpc('recalcular_contrato_parcelas', {
        p_contrato_id: contrato.id,
        p_tipo_juros: editFormData.tipoJuros,
        p_percentual: editFormData.percentual ? parseFloat(editFormData.percentual) : null
      });

      if (error) throw error;

      toast({ title: "Contrato atualizado", description: "Parcelas recalculadas." });
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
    try {
      await supabase.from("parcelas").delete().eq("contrato_id", contrato.id);
      await supabase.from("contratos").delete().eq("id", contrato.id);

      toast({ title: "Contrato excluído", description: "Contrato e parcelas removidos." });
      setIsDeleteDialogOpen(false);
      onOpenChange(false);
      onContratoUpdated();
    } catch (error: any) {
      toast({ title: "Erro", description: "Não foi possível excluir.", variant: "destructive" });
    }
  };

  const previewEdicao = calcularPreviewEdicao();

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full p-4 sm:p-6">
          <DialogHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pr-8">
              <DialogTitle className="text-lg sm:text-xl">Detalhes do Contrato</DialogTitle>
              <div className="flex gap-2 flex-col sm:flex-row">
                <RelatorioGenerator contrato={contrato} parcelas={parcelas} />
                {contrato.status !== 'quitado' && (
                  <Button variant="outline" size="sm" onClick={abrirModalEdicao} className="w-full sm:w-auto">
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar Juros
                  </Button>
                )}
                {contrato.status === 'quitado' && (
                  <Button variant="default" size="sm" onClick={() => onRenovar(contrato)} className="w-full sm:w-auto">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Renovar Contrato
                  </Button>
                )}
                <Button variant="destructive" size="sm" onClick={() => setIsDeleteDialogOpen(true)} className="w-full sm:w-auto">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Contrato
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Informações do Contrato</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm sm:text-base">
                <div className="space-y-2">
                  <p><strong>Cliente:</strong> {contrato.clientes?.nome}</p>
                  <p><strong>Data:</strong> {format(new Date(contrato.data_emprestimo + 'T00:00:00'), 'dd/MM/yyyy')}</p>
                  <p><strong>Periodicidade:</strong> {contrato.periodicidade}</p>
                  <p><strong>Número de Parcelas:</strong> {contrato.numero_parcelas}</p>
                  <p><strong>Tipo de Juros:</strong> {getLabelTipoJuros(contrato.tipo_juros || 'simples')}</p>
                </div>
                <div className="space-y-2">
                  <p><strong>Valor Emprestado:</strong> R$ {Number(contrato.valor_emprestado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  <p><strong>Percentual:</strong> {Number(contrato.percentual)}%</p>
                  <p><strong>Valor Total:</strong> R$ {Number(contrato.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  <p><strong>Status:</strong> <Badge variant={contrato.status === 'ativo' ? 'default' : contrato.status === 'quitado' ? 'outline' : 'secondary'}>{contrato.status === 'ativo' ? 'Ativo' : contrato.status === 'quitado' ? 'Quitado' : contrato.status}</Badge></p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Parcelas</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Desktop Table */}
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
                            {parcela.data_pagamento ? format(new Date(parcela.data_pagamento + 'T00:00:00'), 'dd/MM/yyyy') : '-'}
                          </TableCell>
                          <TableCell>
                            {parcela.status !== 'pago' ? (
                              <Button size="sm" onClick={() => abrirModalPagamento(parcela)}>Baixar</Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => handleDesfazerPagamento(parcela.id)} className="text-warning hover:bg-warning hover:text-warning-foreground">
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

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {parcelas.map((parcela) => (
                    <Card key={parcela.id} className="p-3">
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
                      <div className="space-y-1.5 text-sm text-muted-foreground mb-3">
                        <div className="flex justify-between">
                          <span>Vencimento:</span>
                          <span className="font-medium text-foreground">{format(new Date(parcela.data_vencimento + 'T00:00:00'), 'dd/MM/yyyy')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Valor:</span>
                          <span className="font-medium text-foreground">R$ {Number(parcela.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        {parcela.data_pagamento && (
                          <>
                            <div className="flex justify-between">
                              <span>Pago em:</span>
                              <span className="font-medium text-foreground">{format(new Date(parcela.data_pagamento + 'T00:00:00'), 'dd/MM/yyyy')}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Valor pago:</span>
                              <span className="font-medium text-foreground">R$ {Number(parcela.valor_pago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                          </>
                        )}
                      </div>
                      {parcela.status !== 'pago' ? (
                        <Button size="sm" onClick={() => abrirModalPagamento(parcela)} className="w-full">
                          Baixar Parcela
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => handleDesfazerPagamento(parcela.id)} className="w-full text-warning hover:bg-warning hover:text-warning-foreground">
                          <Undo2 className="h-4 w-4 mr-2" />
                          Desfazer Pagamento
                        </Button>
                      )}
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPagamentoDialogOpen} onOpenChange={setIsPagamentoDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento</DialogTitle>
            <DialogDescription>
              {parcelaToPay && (
                <>
                  Parcela {parcelaToPay.numero_parcela} - {contrato.clientes?.nome}
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
                <Label htmlFor="personalizado" className="cursor-pointer">Valor personalizado</Label>
              </div>
            </RadioGroup>

            {tipoPagamento === "personalizado" && (
              <div className="space-y-2">
                <Label htmlFor="valorPagamento">Valor do Pagamento</Label>
                <Input id="valorPagamento" type="number" step="0.01" min="0" max={parcelaToPay?.valor} value={valorPagamento} onChange={(e) => setValorPagamento(e.target.value)} placeholder="0.00" />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="data-pagamento">Data do Pagamento</Label>
              <Input id="data-pagamento" type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} max={getLocalDateString()} />
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsPagamentoDialogOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
            <Button onClick={handleConfirmarPagamento} className="w-full sm:w-auto">Confirmar Pagamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg w-[95vw] sm:w-full p-4 sm:p-6 max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Editar Tipo de Juros</DialogTitle>
            <DialogDescription>Altere o tipo de juros e percentual. Parcelas pendentes serão recalculadas.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <Card className="bg-muted/50">
              <CardContent className="pt-4 text-sm space-y-1">
                <p><strong>Cliente:</strong> {contrato.clientes?.nome}</p>
                <p><strong>Valor Emprestado:</strong> R$ {Number(contrato.valor_emprestado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <p><strong>Parcelas:</strong> {contrato.numero_parcelas} ({parcelas.filter(p => p.status === 'pago').length} pagas, {parcelas.filter(p => p.status === 'pendente').length} pendentes)</p>
              </CardContent>
            </Card>

            {parcelas.filter(p => p.status === 'pago').length > 0 && (
              <div className="bg-warning/10 border border-warning/30 rounded-md p-3 text-sm">
                <p className="font-medium text-warning">⚠️ Atenção</p>
                <p className="text-muted-foreground mt-1">
                  {parcelas.filter(p => p.status === 'pago').length} parcela(s) já paga(s). O novo cálculo será aplicado apenas às pendentes.
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Novo Tipo de Juros</Label>
                <Select value={editFormData.tipoJuros} onValueChange={(value: any) => setEditFormData({ ...editFormData, tipoJuros: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simples">Juros Fixo</SelectItem>
                    <SelectItem value="parcela">Juros por Parcela</SelectItem>
                    <SelectItem value="composto">Juros Composto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Novo Percentual (%)</Label>
                <Input type="number" step="0.1" value={editFormData.percentual} onChange={(e) => setEditFormData({ ...editFormData, percentual: e.target.value })} />
              </div>

              {previewEdicao && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4 text-sm space-y-2">
                    <p className="font-medium">Preview:</p>
                    <p>Valor Total: R$ {previewEdicao.valorTotalAnterior.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} → R$ {previewEdicao.valorTotalNovo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p>Valor por parcela pendente: R$ {previewEdicao.valorNovaParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
            <Button onClick={handleEditContrato} disabled={isEditLoading} className="w-full sm:w-auto">
              {isEditLoading ? "Salvando..." : "Confirmar Alteração"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="w-[95vw] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este contrato? Todas as parcelas também serão excluídas.
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
    </>
  );
}
