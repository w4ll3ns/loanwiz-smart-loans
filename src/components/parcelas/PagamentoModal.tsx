import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getLocalDateString } from "@/lib/utils";
import { calcularJurosParcela } from "@/lib/calculos";

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
    clientes?: { nome: string };
    percentual?: number;
    tipo_juros?: string;
    valor_emprestado?: number;
    numero_parcelas?: number;
  };
}

interface PagamentoModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  parcela: Parcela | null;
  onPagamentoConfirmado: () => void;
}

export function PagamentoModal({ isOpen, onOpenChange, parcela, onPagamentoConfirmado }: PagamentoModalProps) {
  const [tipoPagamento, setTipoPagamento] = useState<string>("total");
  const [valorPagamento, setValorPagamento] = useState<string>("");
  const [observacaoPagamento, setObservacaoPagamento] = useState<string>("");
  const [dataPagamento, setDataPagamento] = useState<string>(getLocalDateString());
  const { toast } = useToast();

  const calcularJuros = (p: Parcela) => {
    return calcularJurosParcela(
      Number(p.contratos?.valor_emprestado || 0),
      p.contratos?.numero_parcelas || 1,
      p.contratos?.percentual || 0
    );
  };

  const handleConfirmarPagamento = async () => {
    if (!parcela) return;

    try {
      let valorPagar = 0;
      let tipoPag = tipoPagamento;
      const valorOriginal = Number(parcela.valor_original || parcela.valor);

      if (tipoPagamento === "total") {
        valorPagar = valorOriginal;
      } else if (tipoPagamento === "juros") {
        valorPagar = calcularJuros(parcela);
        tipoPag = "juros";
      } else if (tipoPagamento === "personalizado") {
        valorPagar = Number(valorPagamento);
        tipoPag = "parcial";
      }

      const { error: historicoError } = await supabase
        .from("parcelas_historico")
        .insert({
          parcela_id: parcela.id,
          valor_pago: valorPagar,
          tipo_pagamento: tipoPag,
          data_pagamento: new Date().toISOString(),
          observacao: observacaoPagamento.trim() || null,
          tipo_evento: "pagamento",
        } as any);

      if (historicoError) throw historicoError;

      const novoValorPago = (Number(parcela.valor_pago) || 0) + valorPagar;
      const novoStatus = tipoPagamento === "total" ? "pago" : "pendente";

      const updateData: any = {
        valor_pago: novoValorPago,
        status: novoStatus,
        data_pagamento: dataPagamento,
      };

      if (!parcela.valor_original) {
        updateData.valor_original = parcela.valor;
      }

      const { error: updateError } = await supabase
        .from("parcelas")
        .update(updateData)
        .eq("id", parcela.id);

      if (updateError) throw updateError;

      toast({
        title: novoStatus === "pago" ? "Parcela quitada!" : "Pagamento parcial registrado",
        description: novoStatus === "pago"
          ? `Parcela quitada com R$ ${valorPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          : `Valor pago: R$ ${valorPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Ainda deve: R$ ${valorOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      });

      if (novoStatus === "pago" && parcela.contrato_id) {
        const { data: todasParcelas, error: parcelasError } = await supabase
          .from("parcelas")
          .select("status")
          .eq("contrato_id", parcela.contrato_id);

        if (!parcelasError && todasParcelas) {
          const todasPagas = todasParcelas.every(p => p.status === "pago");
          if (todasPagas) {
            await supabase.from("contratos").update({ status: "quitado" }).eq("id", parcela.contrato_id);
            toast({ title: "Contrato quitado! 🎉", description: "Todas as parcelas foram pagas." });
          }
        }
      }

      onOpenChange(false);
      setTipoPagamento("total");
      setValorPagamento("");
      setObservacaoPagamento("");
      onPagamentoConfirmado();
    } catch (error: any) {
      toast({
        title: "Não foi possível processar o pagamento",
        description: "Verifique os valores informados e sua conexão com a internet.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Confirmar Pagamento</DialogTitle>
          <DialogDescription>
            {parcela && (
              <>
                Parcela {parcela.numero_parcela} - {parcela.contratos?.clientes?.nome}
                <br />
                Valor Original: R$ {Number(parcela.valor_original || parcela.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                {parcela.valor_pago && parcela.valor_pago > 0 && (
                  <>
                    <br />
                    Já Pago (parcial): R$ {Number(parcela.valor_pago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                {parcela && (
                  <span className="block text-sm text-muted-foreground">
                    R$ {Number(parcela.valor_original || parcela.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <RadioGroupItem value="juros" id="juros" />
              <Label htmlFor="juros" className="cursor-pointer flex-1">
                Pagar Apenas Juros
                {parcela && (
                  <span className="block text-sm text-muted-foreground">
                    R$ {calcularJuros(parcela).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({parcela.contratos?.percentual}%)
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
              <Input id="valor-personalizado" type="number" step="0.01" value={valorPagamento} onChange={(e) => setValorPagamento(e.target.value)} placeholder="Digite o valor" />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="data-pagamento">Data do Pagamento</Label>
            <Input id="data-pagamento" type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} max={getLocalDateString()} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacao">Observação (opcional)</Label>
            <Textarea id="observacao" value={observacaoPagamento} onChange={(e) => setObservacaoPagamento(e.target.value)} placeholder="Digite uma observação sobre este pagamento..." rows={3} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirmarPagamento}>Confirmar Pagamento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
