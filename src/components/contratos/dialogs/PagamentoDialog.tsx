import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getLocalDateString } from "@/lib/utils";
import type { Parcela } from "../types";

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  parcelaToPay: Parcela | null;
  clienteNome?: string;
  tipoPagamento: string;
  setTipoPagamento: (v: string) => void;
  valorPagamento: string;
  setValorPagamento: (v: string) => void;
  dataPagamento: string;
  setDataPagamento: (v: string) => void;
  calcularJuros: (p: Parcela) => number;
  onConfirmar: () => void;
}

export function PagamentoDialog({
  isOpen,
  onOpenChange,
  parcelaToPay,
  clienteNome,
  tipoPagamento,
  setTipoPagamento,
  valorPagamento,
  setValorPagamento,
  dataPagamento,
  setDataPagamento,
  calcularJuros,
  onConfirmar,
}: Props) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-md flex flex-col">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>
            {parcelaToPay && (
              <>
                Parcela {parcelaToPay.numero_parcela} · {clienteNome}
                <br />
                Valor: R$ {Number(parcelaToPay.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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
                    R$ {parcelaToPay ? Number(parcelaToPay.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "0,00"}
                  </span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="juros" id="det-juros" />
                <Label htmlFor="det-juros" className="cursor-pointer flex-1">
                  Apenas juros
                  <span className="block text-xs text-muted-foreground">
                    R$ {parcelaToPay ? calcularJuros(parcelaToPay).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "0,00"}
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
                <Input
                  id="valorPagamento"
                  type="number"
                  step="0.01"
                  min="0"
                  max={parcelaToPay?.valor}
                  value={valorPagamento}
                  onChange={(e) => setValorPagamento(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="det-data-pagamento" className="text-xs">Data do pagamento</Label>
              <Input
                id="det-data-pagamento"
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                max={getLocalDateString()}
              />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">Cancelar</Button>
          <Button onClick={onConfirmar} className="w-full sm:w-auto">Confirmar pagamento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}