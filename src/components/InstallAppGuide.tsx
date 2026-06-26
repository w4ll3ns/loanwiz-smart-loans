import { useState } from 'react';
import { Download, Share, Plus, MoreVertical, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { usePWAInstall } from '@/hooks/usePWAInstall';

/** Controlled install dialog (no trigger) — used from the avatar menu. */
export function InstallAppDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { isIOS, isAndroid, canInstall, triggerInstall } = usePWAInstall();

  const handleAndroidInstall = async () => {
    const success = await triggerInstall();
    if (success) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Instalar App
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {isIOS && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Adicione o WS Empréstimos à sua tela inicial para acesso rápido:
              </p>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary shrink-0">
                    <span className="text-sm font-semibold">1</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Toque no botão Compartilhar</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Share className="h-4 w-4" />
                      <span>na barra inferior do Safari</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary shrink-0">
                    <span className="text-sm font-semibold">2</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Role e toque em "Adicionar à Tela de Início"</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Plus className="h-4 w-4" />
                      <span>na lista de opções</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary shrink-0">
                    <span className="text-sm font-semibold">3</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Toque em "Adicionar"</p>
                    <p className="text-xs text-muted-foreground">
                      no canto superior direito
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isAndroid && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Instale o WS Empréstimos como um aplicativo:
              </p>

              {canInstall ? (
                <Button onClick={handleAndroidInstall} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Instalar Aplicativo
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary shrink-0">
                      <span className="text-sm font-semibold">1</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Toque no menu do navegador</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MoreVertical className="h-4 w-4" />
                        <span>três pontos no canto superior</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary shrink-0">
                      <span className="text-sm font-semibold">2</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Toque em "Adicionar à tela inicial"</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Plus className="h-4 w-4" />
                        <span>ou "Instalar aplicativo"</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary shrink-0">
                      <span className="text-sm font-semibold">3</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Confirme a instalação</p>
                      <p className="text-xs text-muted-foreground">
                        toque em "Instalar" ou "Adicionar"
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function InstallAppGuide() {
  const [open, setOpen] = useState(false);
  const { showInstallButton } = usePWAInstall();

  if (!showInstallButton) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        <Download className="h-5 w-5" />
      </Button>
      <InstallAppDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
