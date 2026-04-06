import { useState } from "react";
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

  // Sync state when parcela changes
  if (parcela && novaDataVencimento === "" && isOpen) {
    setNovaDataVencimento(parcela.data_vencimento);
  }

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
      const updateData: any = {
        data_vencimento: novaDataVencimento,
        justificativa_alteracao_data: justificativaAlteracao.trim(),
      };

      if (!parcela.data_vencimento_original) {
        updateData.data_vencimento_original = parcela.data_vencimento;
      }

      const { error } = await supabase
        .from("parcelas")
        .update(updateData)
        .eq("id", parcela.id);

      if (error) throw error;

      const { error: historicoError } = await supabase
        .from("parcelas_historico")
        .insert({
          parcela_id: parcela.id,
          tipo_evento: "alteracao_data",
          data_vencimento_anterior: parcela.data_vencimento,
          data_vencimento_nova: novaDataVencimento,
          observacao: justificativaAlteracao.trim(),
          data_pagamento: new Date().toISOString(),
        } as any);

      if (historicoError) {
        console.error("Erro ao registrar no histórico:", historicoError);
      }

      toast({
        title: "Data de vencimento alterada",
        description: `Nova data: ${format(new Date(novaDataVencimento + 'T00:00:00'), 'dd/MM/yyyy')}`,
      });

      onOpenChange(false);
      setNovaDataVencimento("");
      setJustificativaAlteracao("");
      onDataAlterada();
    } catch (error: any) {
      toast({ title: "Erro ao alterar data", description: "Não foi possível alterar a data.", variant: "destructive" });
    }
  };

  const handleClose = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      setNovaDataVencimento("");
      setJustificativaAlteracao("");
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString + 'T00:00:00'), 'dd/MM/yyyy');
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Data de Vencimento</DialogTitle>
          <DialogDescription>
            {parcela && (
              <>
                Parcela {parcela.numero_parcela} - {parcela.contratos?.clientes?.nome}
                <br />
                Data Atual: {formatDate(parcela.data_vencimento)}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nova-data">Nova Data de Vencimento</Label>
            <Input id="nova-data" type="date" value={novaDataVencimento} onChange={(e) => setNovaDataVencimento(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="justificativa">Justificativa *</Label>
            <Textarea id="justificativa" value={justificativaAlteracao} onChange={(e) => setJustificativaAlteracao(e.target.value)} placeholder="Informe o motivo da alteração..." rows={3} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button onClick={handleEditarDataVencimento}>Confirmar Alteração</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
