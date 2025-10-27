import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Calculator, Users, FileText, DollarSign, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";
import logo from "@/assets/logo.png";

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: "Dashboard", href: "/", icon: DollarSign },
  { name: "Clientes", href: "/clientes", icon: Users },
  { name: "Contratos", href: "/contratos", icon: FileText },
  { name: "Parcelas", href: "/parcelas", icon: Calculator },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);

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
      <header className="hidden md:block sticky top-0 z-50 w-full border-b bg-card shadow-sm">
        <div className="container mx-auto flex h-16 items-center gap-4 px-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="WS Empréstimos" className="h-10 w-10" />
            <span className="text-lg font-semibold">WS Empréstimos</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-50 w-full border-b bg-card shadow-sm">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <img src={logo} alt="WS Empréstimos" className="h-8 w-8" />
            <span className="text-base font-semibold">WS Empréstimos</span>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar - Desktop */}
        <aside className="hidden w-64 border-r bg-card md:block">
          <div className="flex h-full flex-col p-4">
            <nav className="flex flex-col gap-2">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>

      {/* Bottom Navigation - Mobile only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-card shadow-lg">
        <div className="flex items-center justify-around h-16">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive && "fill-primary")} />
                <span className="text-xs font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}