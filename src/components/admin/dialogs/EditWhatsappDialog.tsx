import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialNumber: string;
  onSave: (numero: string) => Promise<boolean>;
}

export function EditWhatsappDialog({ open, onOpenChange, initialNumber, onSave }: Props) {
  const [numero, setNumero] = useState(initialNumber);

  useEffect(() => {
    if (open) setNumero(initialNumber);
  }, [open, initialNumber]);

  const handleSave = async () => {
    const ok = await onSave(numero);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-md flex flex-col">
        <DialogHeader>
          <DialogTitle>Configurar WhatsApp</DialogTitle>
          <DialogDescription>
            Número para novos usuários solicitarem ativação de acesso.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp" className="text-xs">Número do WhatsApp</Label>
            <Input
              id="whatsapp"
              placeholder="Ex: 5585999999999"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Número completo com código do país (ex: 55 para Brasil)
            </p>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}