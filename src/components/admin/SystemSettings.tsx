import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Phone, Pencil } from 'lucide-react';

interface Props {
  whatsappNumber: string;
  onEdit: () => void;
}

export function SystemSettings({ whatsappNumber, onEdit }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Configurações do Sistema</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground">WhatsApp para Contato:</span>
            <span className="text-sm font-medium truncate">
              {whatsappNumber || 'Não configurado'}
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="h-3 w-3 mr-1" />
            Editar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}