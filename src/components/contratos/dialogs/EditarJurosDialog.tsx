import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TipoJuros } from "@/lib/calculos";
import type { Contrato, Parcela } from "../types";

interface PreviewEdicao {
  valorTotalAnterior: number;
  valorTotalNovo: number;
  valorJaPago: number;
  valorRestante: number;
  valorNovaParcela: number;
  parcelasPagas: number;
  parcelasPendentes: number;
}

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  contrato: Contrato;
  parcelas: Parcela[];
  editFormData: { tipoJuros: TipoJuros; percentual: string };
  setEditFormData: (v: { tipoJuros: TipoJuros; percentual: string }) => void;
  preview: PreviewEdicao | null;
  isLoading: boolean;
  onConfirmar: () => void;
}

export function EditarJurosDialog({
  isOpen,
  onOpenChange,
  contrato,
  parcelas,
  editFormData,
  setEditFormData,
  preview,
  isLoading,
  onConfirmar,
}: Props) {
  const pagas = parcelas.filter(p => p.status === "pago").length;
  const pendentes = parcelas.filter(p => p.status === "pendente").length;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
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
                <p><strong>Emprestado:</strong> R$ {Number(contrato.valor_emprestado).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                <p><strong>Parcelas:</strong> {contrato.numero_parcelas} ({pagas} pagas, {pendentes} pendentes)</p>
              </CardContent>
            </Card>

            {pagas > 0 && (
              <div className="bg-warning/10 border border-warning/30 rounded-md p-3 text-sm">
                <p className="font-medium text-warning">⚠️ Atenção</p>
                <p className="text-muted-foreground mt-1">
                  {pagas} parcela(s) já paga(s). O recálculo será aplicado apenas às pendentes.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de juros</Label>
                <Select
                  value={editFormData.tipoJuros}
                  onValueChange={(value: any) => setEditFormData({ ...editFormData, tipoJuros: value })}
                >
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
                <Input
                  type="number"
                  step="0.1"
                  value={editFormData.percentual}
                  onChange={(e) => setEditFormData({ ...editFormData, percentual: e.target.value })}
                />
              </div>

              {preview && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="pt-4 text-sm space-y-1.5">
                    <p className="font-medium text-xs uppercase tracking-wider text-muted-foreground">Simulação</p>
                    <p>Total: R$ {preview.valorTotalAnterior.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} → <strong>R$ {preview.valorTotalNovo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></p>
                    <p>Nova parcela: <strong>R$ {preview.valorNovaParcela.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">Cancelar</Button>
          <Button onClick={onConfirmar} disabled={isLoading} className="w-full sm:w-auto">
            {isLoading ? "Salvando..." : "Confirmar alteração"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}