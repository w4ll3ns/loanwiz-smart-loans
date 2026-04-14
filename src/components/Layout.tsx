import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Calculator, Users, FileText, DollarSign, LogOut, Shield, UserCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";
import { InstallAppGuide } from "@/components/InstallAppGuide";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificacoesVencimento } from "@/components/NotificacoesVencimento";
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

  const navigation = isAdmin 
    ? [...baseNavigation, ...adminNavigation]
    : baseNavigation;

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (!session) {
          navigate('/auth');
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

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

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header - Desktop only */}
      <header className="hidden md:block sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm">
        <div className="container mx-auto flex h-14 items-center gap-4 px-4">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="WS Empréstimos" className="h-8 w-8" />
            <span className="text-base font-semibold tracking-tight">WS Empréstimos</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {isAdmin && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                Admin
              </span>
            )}
            <Link to="/perfil" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted">
              <UserCircle className="h-4 w-4" />
              <span className="max-w-[160px] truncate">{user?.email}</span>
            </Link>
            <NotificacoesVencimento />
            <InstallAppGuide />
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair" className="h-8 w-8">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm">
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
          <div className="flex items-center gap-0.5">
            <NotificacoesVencimento />
            <InstallAppGuide />
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair" className="h-8 w-8">
              <LogOut className="h-4 w-4" />
            </Button>
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
        <main className="flex-1 min-w-0 overflow-x-hidden p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>

      {/* Bottom Navigation - Mobile only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-around h-14">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors relative",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full bg-primary" />
                )}
                <item.icon className={cn("h-5 w-5", isActive && "fill-primary/20")} />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
