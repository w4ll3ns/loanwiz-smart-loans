import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
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
import { Calendar as CalendarIcon, Download, History, Pencil, RefreshCw, Trash2, Undo2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getLocalDateString } from "@/lib/utils";
import { calcularJurosParcela, calcularValorTotal, getLabelTipoJuros, TipoJuros } from "@/lib/calculos";
import { RelatorioGenerator } from "./RelatorioGenerator";
import { HistoricoModal, EditarDataModal } from "@/components/parcelas";

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
  const [editarDataOpen, setEditarDataOpen] = useState(false);
  const [parcelaEditarData, setParcelaEditarData] = useState<any>(null);
  const { toast } = useToast();

  if (!contrato) return null;

  const abrirEditarData = (parcela: Parcela) => {
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
        dataPagamento: dataPagamento,
      });

      toast({
        title: result.novo_status === "pago" ? "Parcela quitada!" : "Pagamento parcial registrado",
        description: result.novo_status === "pago"
          ? `Parcela quitada com R$ ${result.valor_pago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          : `Valor pago: R$ ${result.valor_pago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
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

  const parcelasPagas = parcelas.filter(p => p.status === 'pago').length;
  const parcelasPendentes = parcelas.filter(p => p.status !== 'pago').length;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full flex flex-col">
          <DialogHeader>
            <div className="flex flex-col gap-1 pr-8">
              <DialogTitle className="text-lg sm:text-xl">
                {contrato.clientes?.nome}
              </DialogTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={contrato.status === 'ativo' ? 'default' : contrato.status === 'quitado' ? 'outline' : 'secondary'}>
                  {contrato.status === 'ativo' ? 'Ativo' : contrato.status === 'quitado' ? 'Quitado' : contrato.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(contrato.data_emprestimo + 'T00:00:00'), 'dd/MM/yyyy')} · {contrato.numero_parcelas}x {contrato.periodicidade}
                </span>
              </div>
            </div>
          </DialogHeader>

          <DialogBody>
            <div className="space-y-4">
              {/* Contract info summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Emprestado</p>
                  <p className="text-sm font-bold">R$ {Number(contrato.valor_emprestado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Total</p>
                  <p className="text-sm font-bold">R$ {Number(contrato.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Juros</p>
                  <p className="text-sm font-bold">{Number(contrato.percentual)}% · {getLabelTipoJuros(contrato.tipo_juros || 'simples')}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Parcelas</p>
                  <p className="text-sm font-bold">{parcelasPagas}/{contrato.numero_parcelas} <span className="text-xs font-normal text-muted-foreground">pagas</span></p>
                </div>
              </div>

              {/* Actions row */}
              <div className="flex flex-wrap gap-2">
                <RelatorioGenerator contrato={contrato} parcelas={parcelas} />
                {contrato.status !== 'quitado' && (
                  <Button variant="outline" size="sm" onClick={abrirModalEdicao}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                    Editar juros
                  </Button>
                )}
                {contrato.status === 'quitado' && (
                  <Button variant="default" size="sm" onClick={() => onRenovar(contrato)}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Renovar
                  </Button>
                )}
              </div>

              <Separator />

              {/* Parcelas section */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Parcelas ({parcelas.length})</h3>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nº</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Pago</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data Pgto</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parcelas.map((parcela) => (
                        <TableRow key={parcela.id}>
                          <TableCell className="font-medium">{parcela.numero_parcela}</TableCell>
                          <TableCell>{format(new Date(parcela.data_vencimento + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell>
                          <TableCell>R$ {Number(parcela.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell>
                            {Number(parcela.valor_pago || 0) > 0 ? (
                              <span className="text-success font-medium">
                                R$ {Number(parcela.valor_pago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            ) : '—'}
                          </TableCell>
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
                            {parcela.data_pagamento ? format(new Date(parcela.data_pagamento + 'T00:00:00'), 'dd/MM/yyyy') : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              {parcela.status !== 'pago' ? (
                                <Button size="sm" onClick={() => abrirModalPagamento(parcela)}>Baixar</Button>
                              ) : (
                                <Button size="sm" variant="outline" onClick={() => handleDesfazerPagamento(parcela.id)} className="text-warning hover:bg-warning hover:text-warning-foreground">
                                  <Undo2 className="h-3.5 w-3.5 mr-1" />
                                  Desfazer
                                </Button>
                              )}
                              {parcela.status !== 'pago' && (
                                <Button size="sm" variant="ghost" onClick={() => abrirEditarData(parcela)} title="Alterar vencimento">
                                  <CalendarIcon className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => loadHistorico(parcela)} title="Histórico">
                                <History className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-2">
                  {parcelas.map((parcela) => (
                    <Card key={parcela.id} className="p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-sm">Parcela {parcela.numero_parcela}</span>
                        {parcela.status === 'pago' ? (
                          <Badge variant="default" className="bg-success text-xs">Pago</Badge>
                        ) : new Date(parcela.data_vencimento + 'T00:00:00') < new Date(new Date().setHours(0, 0, 0, 0)) ? (
                          <Badge variant="destructive" className="text-xs">Atrasado</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Pendente</Badge>
                        )}
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground mb-3">
                        <div className="flex justify-between">
                          <span>Vencimento</span>
                          <span className="font-medium text-foreground">{format(new Date(parcela.data_vencimento + 'T00:00:00'), 'dd/MM/yyyy')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Valor</span>
                          <span className="font-medium text-foreground">R$ {Number(parcela.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        {Number(parcela.valor_pago || 0) > 0 && (
                          <div className="flex justify-between">
                            <span>Pago</span>
                            <span className="font-medium text-success">R$ {Number(parcela.valor_pago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        {parcela.data_pagamento && (
                          <div className="flex justify-between">
                            <span>Data pgto</span>
                            <span className="font-medium text-foreground">{format(new Date(parcela.data_pagamento + 'T00:00:00'), 'dd/MM/yyyy')}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          {parcela.status !== 'pago' ? (
                            <Button size="sm" onClick={() => abrirModalPagamento(parcela)} className="w-full h-9">
                              Baixar parcela
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => handleDesfazerPagamento(parcela.id)} className="w-full h-9 text-warning hover:bg-warning hover:text-warning-foreground">
                              <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                              Desfazer
                            </Button>
                          )}
                        </div>
                        {parcela.status !== 'pago' && (
                          <Button size="sm" variant="ghost" onClick={() => abrirEditarData(parcela)} title="Alterar vencimento" className="h-9 w-9 p-0">
                            <CalendarIcon className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => loadHistorico(parcela)} title="Histórico" className="h-9 w-9 p-0">
                          <History className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Danger zone */}
              <div className="pt-2">
                <Button variant="ghost" size="sm" onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs">
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Excluir contrato
                </Button>
              </div>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPagamentoDialogOpen} onOpenChange={setIsPagamentoDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md flex flex-col">
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            <DialogDescription>
              {parcelaToPay && (
                <>
                  Parcela {parcelaToPay.numero_parcela} · {contrato.clientes?.nome}
                  <br />
                  Valor: R$ {Number(parcelaToPay.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <RadioGroup value={tipoPagamento} onValueChange={setTipoPagamento}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="total" id="det-total" />
                  <Label htmlFor="det-total" className="cursor-pointer flex-1">
                    Quitar parcela
                    <span className="block text-xs text-muted-foreground">
                      R$ {parcelaToPay ? Number(parcelaToPay.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                    </span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="juros" id="det-juros" />
                  <Label htmlFor="det-juros" className="cursor-pointer flex-1">
                    Apenas juros
                    <span className="block text-xs text-muted-foreground">
                      R$ {parcelaToPay ? calcularJuros(parcelaToPay).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                    </span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="personalizado" id="det-personalizado" />
                  <Label htmlFor="det-personalizado" className="cursor-pointer">Valor personalizado</Label>
                </div>
              </RadioGroup>

              {tipoPagamento === "personalizado" && (
                <div className="space-y-1.5">
                  <Label htmlFor="valorPagamento" className="text-xs">Valor</Label>
                  <Input id="valorPagamento" type="number" step="0.01" min="0" max={parcelaToPay?.valor} value={valorPagamento} onChange={(e) => setValorPagamento(e.target.value)} placeholder="0,00" />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="det-data-pagamento" className="text-xs">Data do pagamento</Label>
                <Input id="det-data-pagamento" type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} max={getLocalDateString()} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPagamentoDialogOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
            <Button onClick={handleConfirmarPagamento} className="w-full sm:w-auto">Confirmar pagamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Interest Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg w-[95vw] sm:w-full flex flex-col">
          <DialogHeader>
            <DialogTitle>Editar juros do contrato</DialogTitle>
            <DialogDescription>Altere o tipo ou percentual. Parcelas pendentes serão recalculadas automaticamente.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <Card className="bg-muted/50">
                <CardContent className="pt-4 text-sm space-y-1">
                  <p><strong>Cliente:</strong> {contrato.clientes?.nome}</p>
                  <p><strong>Emprestado:</strong> R$ {Number(contrato.valor_emprestado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  <p><strong>Parcelas:</strong> {contrato.numero_parcelas} ({parcelas.filter(p => p.status === 'pago').length} pagas, {parcelas.filter(p => p.status === 'pendente').length} pendentes)</p>
                </CardContent>
              </Card>

              {parcelas.filter(p => p.status === 'pago').length > 0 && (
                <div className="bg-warning/10 border border-warning/30 rounded-md p-3 text-sm">
                  <p className="font-medium text-warning">⚠️ Atenção</p>
                  <p className="text-muted-foreground mt-1">
                    {parcelas.filter(p => p.status === 'pago').length} parcela(s) já paga(s). O recálculo será aplicado apenas às pendentes.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo de juros</Label>
                  <Select value={editFormData.tipoJuros} onValueChange={(value: any) => setEditFormData({ ...editFormData, tipoJuros: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simples">Juros Fixo</SelectItem>
                      <SelectItem value="parcela">Juros por Parcela</SelectItem>
                      <SelectItem value="composto">Juros Composto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Percentual (%)</Label>
                  <Input type="number" step="0.1" value={editFormData.percentual} onChange={(e) => setEditFormData({ ...editFormData, percentual: e.target.value })} />
                </div>

                {previewEdicao && (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="pt-4 text-sm space-y-1.5">
                      <p className="font-medium text-xs uppercase tracking-wider text-muted-foreground">Simulação</p>
                      <p>Total: R$ {previewEdicao.valorTotalAnterior.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} → <strong>R$ {previewEdicao.valorTotalNovo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
                      <p>Nova parcela: <strong>R$ {previewEdicao.valorNovaParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
            <Button onClick={handleEditContrato} disabled={isEditLoading} className="w-full sm:w-auto">
              {isEditLoading ? "Salvando..." : "Confirmar alteração"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="w-[95vw] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O contrato e todas as suas parcelas serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteContrato} className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir contrato
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <HistoricoModal
        isOpen={historicoModalOpen}
        onOpenChange={setHistoricoModalOpen}
        parcela={parcelaHistorico as any}
        historico={historicoData}
        onHistoricoUpdated={(p) => {
          loadHistorico(p as any);
        }}
        onParcelasUpdated={() => onParcelasUpdated(contrato.id)}
      />
    </>
  );
}
