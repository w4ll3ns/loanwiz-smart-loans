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
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Profile, StatusPlano } from '../types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: Profile | null;
  onSave: (userId: string, plano: StatusPlano) => Promise<boolean>;
}

export function EditPlanDialog({ open, onOpenChange, user, onSave }: Props) {
  const [plano, setPlano] = useState<StatusPlano>('teste');

  useEffect(() => {
    if (open) setPlano((user?.status_plano as StatusPlano) || 'teste');
  }, [open, user]);

  const handleSave = async () => {
    if (!user) return;
    const ok = await onSave(user.id, plano);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-md flex flex-col">
        <DialogHeader>
          <DialogTitle>Alterar plano</DialogTitle>
          <DialogDescription>{user?.nome || user?.email}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-1.5">
            <Label className="text-xs">Status do plano</Label>
            <Select value={plano} onValueChange={(v) => setPlano(v as StatusPlano)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="teste">Teste</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="expirado">Expirado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
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