import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AccessRestrictedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string | null;
}

export function AccessRestrictedModal({ open, onOpenChange, userEmail }: AccessRestrictedModalProps) {
  const [whatsappNumber, setWhatsappNumber] = useState<string>('');

  useEffect(() => {
    const fetchWhatsapp = async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('valor')
        .eq('chave', 'whatsapp_contato')
        .maybeSingle();
      
      if (data?.valor) {
        setWhatsappNumber(data.valor);
      }
    };

    if (open) {
      fetchWhatsapp();
    }
  }, [open]);

  const handleWhatsAppClick = () => {
    if (!whatsappNumber) {
      return;
    }

    // Clean number - remove non-digits
    const cleanNumber = whatsappNumber.replace(/\D/g, '');
    
    // Create message
    const message = encodeURIComponent(
      `Olá! Meu e-mail é ${userEmail || 'não informado'} e desejo ativar meu acesso ao sistema de controle de empréstimos.`
    );

    // Open WhatsApp link
    window.open(`https://wa.me/${cleanNumber}?text=${message}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-7 w-7 text-amber-600" />
          </div>
          <DialogTitle className="text-xl">Acesso Não Liberado</DialogTitle>
          <DialogDescription className="text-center mt-2">
            Seu cadastro está sendo analisado. Para ativar seu acesso, entre em contato conosco.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {whatsappNumber ? (
            <>
              <Button
                onClick={handleWhatsAppClick}
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg"
              >
                <MessageCircle className="mr-2 h-5 w-5" />
                Solicitar Ativação via WhatsApp
              </Button>

              <div className="bg-muted p-3 rounded-lg text-xs text-muted-foreground">
                <p className="font-medium mb-1">Mensagem automática:</p>
                <p className="italic">
                  "Olá! Meu e-mail é {userEmail || 'não informado'} e desejo ativar meu acesso ao sistema de controle de empréstimos."
                </p>
              </div>
            </>
          ) : (
            <div className="bg-muted p-4 rounded-lg text-center text-sm text-muted-foreground">
              <p>O número de contato ainda não foi configurado pelo administrador.</p>
              <p className="mt-2">Por favor, aguarde ou tente novamente mais tarde.</p>
            </div>
          )}

          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
