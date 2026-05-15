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
import { Textarea } from '@/components/ui/textarea';
import type { Profile } from '../types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: Profile | null;
  onSave: (userId: string, observacoes: string) => Promise<boolean>;
}

export function EditObservacoesDialog({ open, onOpenChange, user, onSave }: Props) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (open) setText(user?.observacoes_admin || '');
  }, [open, user]);

  const handleSave = async () => {
    if (!user) return;
    const ok = await onSave(user.id, text);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-md flex flex-col">
        <DialogHeader>
          <DialogTitle>Observações</DialogTitle>
          <DialogDescription>{user?.nome || user?.email}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Textarea
            placeholder="Notas internas sobre o usuário..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}