import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Calculator, Users, FileText, DollarSign, Shield, CalendarDays, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";
import { NotificacoesVencimento } from "@/components/NotificacoesVencimento";
import { UserMenu } from "@/components/UserMenu";
import { GlobalSearch } from "@/components/GlobalSearch";
import type { User } from "@supabase/supabase-js";
import logo from "@/assets/logo.png";

interface LayoutProps {
  children: ReactNode;
}

const baseNavigation = [
  { name: "Dashboard", href: "/", icon: DollarSign },
  { name: "Clientes", href: "/clientes", icon: Users },
  { name: "Contratos", href: "/contratos", icon: FileText },
  { name: "Parcelas", href: "/parcelas", icon: Calculator },
  { name: "Calendário", href: "/calendario", icon: CalendarDays },
];

const adminNavigation = [
  { name: "Administração", href: "/admin", icon: Shield },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const { isAdmin } = useUserRole();
  const [searchOpen, setSearchOpen] = useState(false);

  const navigation = isAdmin 
    ? [...baseNavigation, ...adminNavigation]
    : baseNavigation;

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Global ⌘K / Ctrl+K shortcut to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Update ultimo_acesso on mount
  useEffect(() => {
    const updateUltimoAcesso = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ ultimo_acesso: new Date().toISOString() })
          .eq('id', user.id);
      }
    };

    updateUltimoAcesso();
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: 'Erro ao sair',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Logout realizado',
        description: 'Até logo!',
      });
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      {/* Header - Desktop only */}
      <header
        className="hidden md:block sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="container mx-auto flex h-14 items-center gap-4 px-4">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="WS Empréstimos" className="h-8 w-8" />
            <span className="text-base font-semibold tracking-tight">WS Empréstimos</span>
            {isAdmin && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                Admin
              </span>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 rounded-md border border-input bg-background px-3 h-8 text-sm text-muted-foreground hover:bg-muted transition-colors w-56"
            >
              <Search className="h-4 w-4" />
              <span className="flex-1 text-left truncate">Buscar cliente, contrato…</span>
              <kbd className="pointer-events-none hidden lg:inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                ⌘K
              </kbd>
            </button>
            <NotificacoesVencimento />
            <UserMenu variant="desktop" onLogout={handleLogout} />
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header
        className="md:hidden sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex h-12 items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <img src={logo} alt="WS Empréstimos" className="h-7 w-7" />
            <span className="text-sm font-semibold tracking-tight">WS Empréstimos</span>
            {isAdmin && (
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                Admin
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchOpen(true)}
              title="Buscar"
              className="h-8 w-8 text-muted-foreground"
            >
              <Search className="h-5 w-5" />
            </Button>
            <NotificacoesVencimento />
            <UserMenu variant="mobile" onLogout={handleLogout} />
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar - Desktop */}
        <aside className="hidden w-56 border-r bg-card md:block">
          <div className="flex h-full flex-col py-3 px-3">
            <nav className="flex flex-col gap-0.5">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-x-hidden p-4 md:p-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-6">
          {children}
        </main>
      </div>

      {/* Bottom Navigation - Mobile only */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-[0_-3px_14px_rgba(0,0,0,0.06)]"
        style={{ paddingTop: '0.5rem', paddingBottom: 'max(0.75rem, calc(0.5rem + env(safe-area-inset-bottom)))' }}
      >
        <div className="flex items-center justify-around gap-1 px-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                aria-label={item.name}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center justify-center h-[46px] min-w-[46px] rounded-full transition-all duration-200 active:scale-95",
                  isActive
                    ? "bg-primary/10 text-primary px-4"
                    : "text-muted-foreground px-2.5 hover:text-foreground"
                )}
              >
                <item.icon className="h-[22px] w-[22px] flex-shrink-0" />
                <span
                  className={cn(
                    "overflow-hidden whitespace-nowrap text-[13px] font-semibold transition-all duration-200",
                    isActive ? "max-w-[120px] opacity-100 ml-1.5" : "max-w-0 opacity-0 ml-0"
                  )}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
