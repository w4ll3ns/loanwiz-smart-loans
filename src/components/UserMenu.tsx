import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserCircle, Download, Sun, Moon, LogOut, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { useTheme } from "@/hooks/useTheme";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { InstallAppDialog } from "@/components/InstallAppGuide";
import { getIniciais, resolveAvatarUrl } from "@/lib/avatar";

interface UserMenuProps {
  variant: "desktop" | "mobile";
  onLogout: () => void;
}

export function UserMenu({ variant, onLogout }: UserMenuProps) {
  const { profile, isAdmin, userEmail } = useUserRole();
  const { theme, setTheme } = useTheme();
  const { showInstallButton } = usePWAInstall();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const nome = profile?.nome ?? null;

  useEffect(() => {
    let active = true;
    resolveAvatarUrl(profile?.avatar_url).then((url) => {
      if (active) setAvatarUrl(url);
    });
    return () => {
      active = false;
    };
  }, [profile?.avatar_url]);

  const iniciais = getIniciais(nome, userEmail);

  const triggerAvatar = (size: string) => (
    <Avatar className={size}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={nome ?? "Avatar"} />}
      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
        {iniciais}
      </AvatarFallback>
    </Avatar>
  );

  const header = (
    <div className="flex items-center gap-3 px-1 py-1">
      {triggerAvatar("h-10 w-10")}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{nome || "Usuário"}</p>
          {isAdmin && (
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
              Admin
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
      </div>
    </div>
  );

  const ThemeRow = ({ asMenuItems }: { asMenuItems: boolean }) => {
    const options: { value: "light" | "dark"; label: string; icon: typeof Sun }[] = [
      { value: "light", label: "Claro", icon: Sun },
      { value: "dark", label: "Escuro", icon: Moon },
    ];
    return (
      <div className="flex gap-2">
        {options.map((opt) => {
          const isActive = theme === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors",
                asMenuItems ? "h-9" : "h-11",
                isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              <opt.icon className="h-4 w-4" />
              {opt.label}
              {isActive && <Check className="h-3.5 w-3.5" />}
            </button>
          );
        })}
      </div>
    );
  };

  const logoutDialog = (
    <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deseja sair da conta?</AlertDialogTitle>
          <AlertDialogDescription>
            Você precisará entrar novamente para acessar o sistema.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onLogout}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Sair
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const installDialog = <InstallAppDialog open={installOpen} onOpenChange={setInstallOpen} />;

  if (variant === "desktop") {
    return (
      <>
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
              {triggerAvatar("h-8 w-8")}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="p-0 font-normal">{header}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/perfil" className="cursor-pointer">
                <UserCircle className="mr-2 h-4 w-4" /> Meu perfil
              </Link>
            </DropdownMenuItem>
            {showInstallButton && (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setInstallOpen(true);
                }}
                className="cursor-pointer"
              >
                <Download className="mr-2 h-4 w-4" /> Instalar app
              </DropdownMenuItem>
            )}
            <div className="px-2 py-2">
              <p className="mb-1.5 text-xs text-muted-foreground">Tema</p>
              <ThemeRow asMenuItems />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setLogoutOpen(true);
              }}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {installDialog}
        {logoutDialog}
      </>
    );
  }

  // Mobile: bottom sheet
  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button className="rounded-full outline-none">{triggerAvatar("h-8 w-8")}</button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <div className="space-y-1 pt-2">
            {header}
            <div className="h-px bg-border my-2" />
            <Link
              to="/perfil"
              onClick={() => setOpen(false)}
              className="flex min-h-[44px] items-center gap-3 rounded-md px-2 text-sm font-medium hover:bg-muted"
            >
              <UserCircle className="h-5 w-5 text-muted-foreground" /> Meu perfil
            </Link>
            {showInstallButton && (
              <button
                onClick={() => {
                  setOpen(false);
                  setInstallOpen(true);
                }}
                className="flex min-h-[44px] w-full items-center gap-3 rounded-md px-2 text-sm font-medium hover:bg-muted"
              >
                <Download className="h-5 w-5 text-muted-foreground" /> Instalar app
              </button>
            )}
            <div className="px-2 py-2">
              <p className="mb-1.5 text-xs text-muted-foreground">Tema</p>
              <ThemeRow asMenuItems={false} />
            </div>
            <div className="h-px bg-border my-2" />
            <button
              onClick={() => {
                setOpen(false);
                setLogoutOpen(true);
              }}
              className="flex min-h-[44px] w-full items-center gap-3 rounded-md px-2 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-5 w-5" /> Sair
            </button>
          </div>
        </SheetContent>
      </Sheet>
      {installDialog}
      {logoutDialog}
    </>
  );
}
