import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getLocalDateString } from "@/lib/utils";

interface Parcela {
  id: string;
  valor: number;
  valor_original: number;
  status: string;
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

interface HistoricoModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  parcela: Parcela | null;
  historico: HistoricoParcela[];
  onHistoricoUpdated: (parcela: Parcela) => void;
  onParcelasUpdated: () => void;
}

export function HistoricoModal({
  isOpen,
  onOpenChange,
  parcela,
  historico,
  onHistoricoUpdated,
  onParcelasUpdated
}: HistoricoModalProps) {
  const [filtroTipoEvento, setFiltroTipoEvento] = useState<string>("todos");
  const { toast } = useToast();

  const handleExcluirPagamento = async (registroId: string) => {
    if (!parcela) return;

    try {
      const { data: registroData, error: fetchError } = await supabase
        .from("parcelas_historico")
        .select("tipo_evento")
        .eq("id", registroId)
        .single();

      if (fetchError) throw fetchError;

      const { error: deleteError } = await supabase
        .from("parcelas_historico")
        .delete()
        .eq("id", registroId);

      if (deleteError) throw deleteError;

      if (registroData.tipo_evento === "pagamento") {
        const { data: pagamentosRestantes, error: fetchPagamentosError } = await supabase
          .from("parcelas_historico")
          .select("valor_pago")
          .eq("parcela_id", parcela.id)
          .eq("tipo_evento", "pagamento");

        if (fetchPagamentosError) throw fetchPagamentosError;

        const novoValorPago = pagamentosRestantes?.reduce(
          (sum, p) => sum + Number(p.valor_pago || 0), 0
        ) || 0;

        const valorOriginal = Number(parcela.valor_original || parcela.valor);

        await supabase
          .from("parcelas")
          .update({
            valor_pago: novoValorPago,
            status: novoValorPago >= valorOriginal ? "pago" : "pendente",
            data_pagamento: novoValorPago >= valorOriginal ? getLocalDateString() : null,
          })
          .eq("id", parcela.id);
      }

      toast({ title: "Registro excluído", description: "O registro foi removido do histórico." });
      onHistoricoUpdated(parcela);
      onParcelasUpdated();
    } catch (error: any) {
      toast({ title: "Erro ao excluir registro", description: error.message, variant: "destructive" });
    }
  };

  const filteredHistorico = historico.filter(item => filtroTipoEvento === "todos" || item.tipo_evento === filtroTipoEvento);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[80vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Histórico da Parcela</DialogTitle>
          <DialogDescription>
            Visualize todos os eventos relacionados a esta parcela.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
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

          {filteredHistorico.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum registro no histórico.</p>
          ) : (
            <>
              {/* Desktop */}
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
                    {filteredHistorico.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{format(new Date(item.data_pagamento), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                        <TableCell>
                          <Badge variant={item.tipo_evento === "pagamento" ? "default" : item.tipo_evento === "alteracao_data" ? "secondary" : "destructive"}
                            className={item.tipo_evento === "pagamento" ? "bg-success hover:bg-success/80" : item.tipo_evento === "alteracao_data" ? "bg-warning hover:bg-warning/80 text-warning-foreground" : ""}>
                            {item.tipo_evento === "pagamento" && "Pagamento"}
                            {item.tipo_evento === "alteracao_data" && "Alteração de Data"}
                            {item.tipo_evento === "estorno" && "Estorno"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.tipo_evento === "pagamento" && item.valor_pago && (
                            <span>R$ {item.valor_pago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} - {item.tipo_pagamento}</span>
                          )}
                          {item.tipo_evento === "alteracao_data" && item.data_vencimento_anterior && item.data_vencimento_nova && (
                            <span>{format(new Date(item.data_vencimento_anterior + 'T00:00:00'), "dd/MM/yyyy")} → {format(new Date(item.data_vencimento_nova + 'T00:00:00'), "dd/MM/yyyy")}</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{item.observacao || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleExcluirPagamento(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile */}
              <div className="md:hidden space-y-3">
                {filteredHistorico.map((item) => (
                  <Card key={item.id} className="p-3">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1">
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(item.data_pagamento), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </div>
                          <Badge variant={item.tipo_evento === "pagamento" ? "default" : item.tipo_evento === "alteracao_data" ? "secondary" : "destructive"}
                            className={item.tipo_evento === "pagamento" ? "bg-success hover:bg-success/80" : item.tipo_evento === "alteracao_data" ? "bg-warning hover:bg-warning/80 text-warning-foreground" : ""}>
                            {item.tipo_evento === "pagamento" && "Pagamento"}
                            {item.tipo_evento === "alteracao_data" && "Alteração de Data"}
                            {item.tipo_evento === "estorno" && "Estorno"}
                          </Badge>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleExcluirPagamento(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="text-sm">
                        {item.tipo_evento === "pagamento" && item.valor_pago && (
                          <div className="font-medium">R$ {item.valor_pago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} - {item.tipo_pagamento}</div>
                        )}
                        {item.tipo_evento === "alteracao_data" && item.data_vencimento_anterior && item.data_vencimento_nova && (
                          <div className="font-medium">{format(new Date(item.data_vencimento_anterior + 'T00:00:00'), "dd/MM/yyyy")} → {format(new Date(item.data_vencimento_nova + 'T00:00:00'), "dd/MM/yyyy")}</div>
                        )}
                      </div>
                      {item.observacao && (
                        <div className="text-xs text-muted-foreground"><span className="font-medium">Obs:</span> {item.observacao}</div>
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
  );
}
