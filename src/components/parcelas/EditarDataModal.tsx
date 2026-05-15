import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Parcela {
  id: string;
  data_vencimento: string;
  data_vencimento_original?: string;
  numero_parcela: number;
  contratos?: {
    clientes?: { nome: string };
  };
}

interface EditarDataModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  parcela: Parcela | null;
  onDataAlterada: () => void;
}

export function EditarDataModal({ isOpen, onOpenChange, parcela, onDataAlterada }: EditarDataModalProps) {
  const [novaDataVencimento, setNovaDataVencimento] = useState<string>("");
  const [justificativaAlteracao, setJustificativaAlteracao] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && parcela) {
      setNovaDataVencimento(parcela.data_vencimento);
      setJustificativaAlteracao("");
    }
  }, [isOpen, parcela?.id, parcela?.data_vencimento]);

  const handleEditarDataVencimento = async () => {
    if (!parcela) return;

    if (!justificativaAlteracao.trim()) {
      toast({ title: "Justificativa obrigatória", description: "Informe o motivo da alteração.", variant: "destructive" });
      return;
    }

    if (novaDataVencimento === parcela.data_vencimento) {
      toast({ title: "Data não alterada", description: "A nova data deve ser diferente da atual.", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase.rpc("alterar_data_parcela", {
        p_parcela_id: parcela.id,
        p_nova_data: novaDataVencimento,
        p_justificativa: justificativaAlteracao.trim(),
      });

      if (error) throw error;

      toast({
        title: "Data alterada",
        description: `Novo vencimento: ${format(new Date(novaDataVencimento + 'T00:00:00'), 'dd/MM/yyyy')}`,
      });

      onOpenChange(false);
      setNovaDataVencimento("");
      setJustificativaAlteracao("");
      onDataAlterada();
    } catch (error: any) {
      toast({ title: "Erro ao alterar data", description: error?.message || "Não foi possível salvar a alteração.", variant: "destructive" });
    }
  };

  const handleClose = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      setNovaDataVencimento("");
      setJustificativaAlteracao("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] sm:max-w-md flex flex-col">
        <DialogHeader>
          <DialogTitle>Alterar vencimento</DialogTitle>
          <DialogDescription>
            {parcela && (
              <>
                Parcela {parcela.numero_parcela} · {parcela.contratos?.clientes?.nome}
                <br />
                Vencimento atual: {format(new Date(parcela.data_vencimento + 'T00:00:00'), 'dd/MM/yyyy')}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nova-data" className="text-xs">Nova data de vencimento</Label>
              <Input id="nova-data" type="date" value={novaDataVencimento} onChange={(e) => setNovaDataVencimento(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="justificativa" className="text-xs">Justificativa *</Label>
              <Textarea id="justificativa" value={justificativaAlteracao} onChange={(e) => setJustificativaAlteracao(e.target.value)} placeholder="Motivo da alteração..." rows={2} />
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} className="w-full sm:w-auto">Cancelar</Button>
          <Button onClick={handleEditarDataVencimento} className="w-full sm:w-auto">Confirmar alteração</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
