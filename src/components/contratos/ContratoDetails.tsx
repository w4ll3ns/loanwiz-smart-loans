import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogBody,
  DialogContent,
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
import { Calendar as CalendarIcon, Check, History, Pencil, RefreshCw, Trash2, Undo2, X } from "lucide-react";
import { getLabelTipoJuros } from "@/lib/calculos";
import { RelatorioGenerator } from "./RelatorioGenerator";
import { RelatorioSimplificadoGenerator } from "./RelatorioSimplificadoGenerator";
import { HistoricoModal, EditarDataModal } from "@/components/parcelas";
import type { Contrato, Parcela } from "./types";
import { useContratoDetails } from "./hooks/useContratoDetails";
import { PagamentoDialog } from "./dialogs/PagamentoDialog";
import { EditarJurosDialog } from "./dialogs/EditarJurosDialog";
import { ExcluirContratoDialog } from "./dialogs/ExcluirContratoDialog";

export type { Contrato, Parcela } from "./types";

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
  onRenovar,
}: ContratoDetailsProps) {
  const c = useContratoDetails({
    contrato,
    parcelas,
    onContratoUpdated,
    onParcelasUpdated,
    onClose: () => onOpenChange(false),
  });

  if (!contrato) return null;

  const previewEdicao = c.calcularPreviewEdicao();
  const parcelasPagas = parcelas.filter(p => p.status === "pago").length;
  const temPagamento = parcelas.some(p => p.status === "pago" || Number(p.valor_pago || 0) > 0);
  const podeExcluir = !temPagamento && contrato.status !== "quitado";

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full flex flex-col">
          <DialogHeader>
            <div className="flex flex-col gap-1 pr-8">
              <DialogTitle className="text-lg sm:text-xl">{contrato.clientes?.nome}</DialogTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={contrato.status === "ativo" ? "default" : contrato.status === "quitado" ? "outline" : "secondary"}>
                  {contrato.status === "ativo" ? "Ativo" : contrato.status === "quitado" ? "Quitado" : contrato.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(contrato.data_emprestimo + "T00:00:00"), "dd/MM/yyyy")} · {contrato.numero_parcelas}x {contrato.periodicidade}
                </span>
              </div>
            </div>
          </DialogHeader>

          <DialogBody>
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Emprestado</p>
                  <p className="text-sm font-bold">R$ {Number(contrato.valor_emprestado).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Total</p>
                  <p className="text-sm font-bold">R$ {Number(contrato.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Juros</p>
                  <p className="text-sm font-bold">{Number(contrato.percentual)}% · {getLabelTipoJuros(contrato.tipo_juros || "simples")}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Parcelas</p>
                  <p className="text-sm font-bold">{parcelasPagas}/{contrato.numero_parcelas} <span className="text-xs font-normal text-muted-foreground">pagas</span></p>
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Observações</p>
                  {!c.isEditingObs && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => { c.setObsText(contrato.observacoes || ""); c.setIsEditingObs(true); }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {c.isEditingObs ? (
                  <div className="space-y-2">
                    <Textarea
                      value={c.obsText}
                      onChange={(e) => c.setObsText(e.target.value)}
                      placeholder="Adicionar observações..."
                      className="min-h-[60px] text-sm"
                      autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" className="h-7" onClick={() => c.setIsEditingObs(false)}>
                        <X className="h-3.5 w-3.5 mr-1" /> Cancelar
                      </Button>
                      <Button size="sm" className="h-7" onClick={c.handleSaveObs} disabled={c.isSavingObs}>
                        <Check className="h-3.5 w-3.5 mr-1" /> Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {contrato.observacoes || "Nenhuma observação"}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <RelatorioGenerator contrato={contrato} parcelas={parcelas} />
                <RelatorioSimplificadoGenerator contrato={contrato} parcelas={parcelas} />
                {contrato.status !== "quitado" && (
                  <Button variant="outline" size="sm" onClick={c.abrirModalEdicao}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                    Editar juros
                  </Button>
                )}
                {contrato.status === "quitado" && (
                  <Button variant="default" size="sm" onClick={() => onRenovar(contrato)}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Renovar
                  </Button>
                )}
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-semibold mb-3">Parcelas ({parcelas.length})</h3>

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
                          <TableCell>{format(new Date(parcela.data_vencimento + "T00:00:00"), "dd/MM/yyyy")}</TableCell>
                          <TableCell>R$ {Number(parcela.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell>
                            {Number(parcela.valor_pago || 0) > 0 ? (
                              <span className="text-success font-medium">
                                R$ {Number(parcela.valor_pago).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </span>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            {parcela.status === "pago" ? (
                              <Badge variant="default" className="bg-success">Pago</Badge>
                            ) : new Date(parcela.data_vencimento + "T00:00:00") < new Date(new Date().setHours(0, 0, 0, 0)) ? (
                              <Badge variant="destructive">Atrasado</Badge>
                            ) : (
                              <Badge variant="secondary">Pendente</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {parcela.data_pagamento ? format(new Date(parcela.data_pagamento + "T00:00:00"), "dd/MM/yyyy") : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              {parcela.status !== "pago" ? (
                                <Button size="sm" onClick={() => c.abrirModalPagamento(parcela)}>Baixar</Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={c.estornandoId === parcela.id}
                                  onClick={() => c.handleDesfazerPagamento(parcela.id)}
                                  className="text-warning hover:bg-warning hover:text-warning-foreground"
                                >
                                  <Undo2 className="h-3.5 w-3.5 mr-1" />
                                  Desfazer
                                </Button>
                              )}
                              {parcela.status !== "pago" && (
                                <Button size="sm" variant="ghost" onClick={() => c.abrirEditarData(parcela)} title="Alterar vencimento">
                                  <CalendarIcon className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => c.loadHistorico(parcela)} title="Histórico">
                                <History className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="md:hidden space-y-2">
                  {parcelas.map((parcela) => (
                    <Card key={parcela.id} className="p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-sm">Parcela {parcela.numero_parcela}</span>
                        {parcela.status === "pago" ? (
                          <Badge variant="default" className="bg-success text-xs">Pago</Badge>
                        ) : new Date(parcela.data_vencimento + "T00:00:00") < new Date(new Date().setHours(0, 0, 0, 0)) ? (
                          <Badge variant="destructive" className="text-xs">Atrasado</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Pendente</Badge>
                        )}
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground mb-3">
                        <div className="flex justify-between">
                          <span>Vencimento</span>
                          <span className="font-medium text-foreground">{format(new Date(parcela.data_vencimento + "T00:00:00"), "dd/MM/yyyy")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Valor</span>
                          <span className="font-medium text-foreground">R$ {Number(parcela.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </div>
                        {Number(parcela.valor_pago || 0) > 0 && (
                          <div className="flex justify-between">
                            <span>Pago</span>
                            <span className="font-medium text-success">R$ {Number(parcela.valor_pago).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        {parcela.data_pagamento && (
                          <div className="flex justify-between">
                            <span>Data pgto</span>
                            <span className="font-medium text-foreground">{format(new Date(parcela.data_pagamento + "T00:00:00"), "dd/MM/yyyy")}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          {parcela.status !== "pago" ? (
                            <Button size="sm" onClick={() => c.abrirModalPagamento(parcela)} className="w-full h-9">
                              Baixar parcela
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={c.estornandoId === parcela.id}
                              onClick={() => c.handleDesfazerPagamento(parcela.id)}
                              className="w-full h-9 text-warning hover:bg-warning hover:text-warning-foreground"
                            >
                              <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                              Desfazer
                            </Button>
                          )}
                        </div>
                        {parcela.status !== "pago" && (
                          <Button size="sm" variant="ghost" onClick={() => c.abrirEditarData(parcela)} title="Alterar vencimento" className="h-9 w-9 p-0">
                            <CalendarIcon className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => c.loadHistorico(parcela)} title="Histórico" className="h-9 w-9 p-0">
                          <History className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => c.setIsDeleteDialogOpen(true)}
                  disabled={!podeExcluir}
                  title={!podeExcluir ? "Contratos com parcelas pagas ou já quitados não podem ser excluídos." : undefined}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs disabled:opacity-50 self-start"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Excluir contrato
                </Button>
                {!podeExcluir && (
                  <p className="text-[11px] text-muted-foreground">
                    Apenas contratos sem pagamentos registrados podem ser excluídos.
                  </p>
                )}
              </div>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <PagamentoDialog
        isOpen={c.isPagamentoDialogOpen}
        onOpenChange={c.setIsPagamentoDialogOpen}
        parcelaToPay={c.parcelaToPay}
        clienteNome={contrato.clientes?.nome}
        tipoPagamento={c.tipoPagamento}
        setTipoPagamento={c.setTipoPagamento}
        valorPagamento={c.valorPagamento}
        setValorPagamento={c.setValorPagamento}
        dataPagamento={c.dataPagamento}
        setDataPagamento={c.setDataPagamento}
        calcularJuros={c.calcularJuros}
        onConfirmar={c.handleConfirmarPagamento}
      />

      <EditarJurosDialog
        isOpen={c.isEditDialogOpen}
        onOpenChange={c.setIsEditDialogOpen}
        contrato={contrato}
        parcelas={parcelas}
        editFormData={c.editFormData}
        setEditFormData={c.setEditFormData}
        preview={previewEdicao}
        isLoading={c.isEditLoading}
        onConfirmar={c.handleEditContrato}
      />

      <ExcluirContratoDialog
        isOpen={c.isDeleteDialogOpen}
        onOpenChange={c.setIsDeleteDialogOpen}
        onConfirm={c.handleDeleteContrato}
      />

      <HistoricoModal
        isOpen={c.historicoModalOpen}
        onOpenChange={c.setHistoricoModalOpen}
        parcela={c.parcelaHistorico as any}
        historico={c.historicoData}
        onHistoricoUpdated={(p) => { c.loadHistorico(p as any); }}
        onParcelasUpdated={() => onParcelasUpdated(contrato.id)}
      />

      <EditarDataModal
        isOpen={c.editarDataOpen}
        onOpenChange={c.setEditarDataOpen}
        parcela={c.parcelaEditarData}
        onDataAlterada={() => onParcelasUpdated(contrato.id)}
      />
    </>
  );
}