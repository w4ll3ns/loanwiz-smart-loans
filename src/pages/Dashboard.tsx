import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  FileText, 
  Calendar,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DashboardStats {
  totalEmprestado: number;
  totalReceber: number;
  totalRecebido: number;
  clientesAtivos: number;
  contratosAtivos: number;
  parcelasVencidas: number;
}

interface ProximoVencimento {
  cliente: string;
  valor: number;
  data: string;
  status: "vencido" | "vence_hoje" | "proximo";
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalEmprestado: 0,
    totalReceber: 0,
    totalRecebido: 0,
    clientesAtivos: 0,
    contratosAtivos: 0,
    parcelasVencidas: 0,
  });
  const [proximosVencimentos, setProximosVencimentos] = useState<ProximoVencimento[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Buscar clientes ativos
      const { data: clientes, error: clientesError } = await supabase
        .from("clientes")
        .select("*");

      if (clientesError) throw clientesError;

      // Buscar contratos ativos
      const { data: contratos, error: contratosError } = await supabase
        .from("contratos")
        .select("*")
        .eq("status", "ativo");

      if (contratosError) throw contratosError;

      // Buscar parcelas
      const { data: parcelas, error: parcelasError } = await supabase
        .from("parcelas")
        .select(`
          *,
          contratos!inner(
            clientes!inner(nome)
          )
        `)
        .order("data_vencimento", { ascending: true });

      if (parcelasError) throw parcelasError;

      // Calcular estatísticas
      const totalEmprestado = contratos?.reduce((sum, c) => sum + Number(c.valor_emprestado), 0) || 0;
      
      // Calcular total a receber - parcelas pendentes pelo valor original integral e parcialmente pagas também pelo valor original
      const totalPendente = parcelas?.filter(p => p.status === "pendente" || p.status === "parcialmente_pago")
        .reduce((sum, p) => sum + Number(p.valor_original || p.valor), 0) || 0;
      
      // Calcular total já recebido somando TODOS os valor_pago (independente do status)
      const totalRecebido = parcelas?.reduce((sum, p) => sum + (Number(p.valor_pago) || 0), 0) || 0;
      
      const totalReceber = totalPendente;
      
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      const vencidas = parcelas?.filter(p => {
        const vencimento = new Date(p.data_vencimento + 'T00:00:00');
        return (p.status === "pendente" || p.status === "parcialmente_pago") && vencimento < hoje;
      }).length || 0;

      setStats({
        totalEmprestado,
        totalReceber,
        totalRecebido,
        clientesAtivos: clientes?.length || 0,
        contratosAtivos: contratos?.length || 0,
        parcelasVencidas: vencidas,
      });

      // Processar próximos vencimentos
      const proximos = parcelas
        ?.filter(p => p.status === "pendente" || p.status === "parcialmente_pago")
        .slice(0, 4)
        .map(p => {
          const vencimento = new Date(p.data_vencimento + 'T00:00:00');
          const diffTime = vencimento.getTime() - hoje.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          let status: "vencido" | "vence_hoje" | "proximo" = "proximo";
          if (diffDays < 0) status = "vencido";
          else if (diffDays === 0) status = "vence_hoje";

          return {
            cliente: p.contratos?.clientes?.nome || "Cliente",
            valor: Number(p.valor_original || p.valor),
            data: new Date(p.data_vencimento + 'T00:00:00').toLocaleDateString("pt-BR"),
            status,
          };
        }) || [];

      setProximosVencimentos(proximos);
    } catch (error: any) {
      toast({
        title: "Não foi possível carregar o dashboard",
        description: "Verifique sua conexão com a internet e recarregue a página.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <Button asChild size="sm" className="flex-1 md:flex-none">
            <Link to="/clientes">Novo Cliente</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="flex-1 md:flex-none">
            <Link to="/contratos">Novo Contrato</Link>
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Emprestado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">
              R$ {stats.totalEmprestado.toLocaleString('pt-BR')}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Capital em circulação</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total a Receber</CardTitle>
            <Calendar className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-warning">
              R$ {stats.totalReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              Saldo devedor
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Recebido</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-success">
              R$ {stats.totalRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              Pagamentos efetuados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Clientes Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">{stats.clientesAtivos}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Cadastros ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Contratos Ativos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">{stats.contratosAtivos}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Em andamento</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerta de Parcelas Vencidas */}
      {stats.parcelasVencidas > 0 && (
        <Card className="border-destructive">
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-sm md:text-base text-destructive">Atenção!</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Você tem <strong>{stats.parcelasVencidas} parcelas vencidas</strong> que precisam de atenção.
            </p>
            <Button asChild variant="destructive" size="sm" className="mt-2">
              <Link to="/parcelas">Ver Parcelas Vencidas</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Próximos Vencimentos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Calendar className="h-5 w-5" />
            Próximos Vencimentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {proximosVencimentos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum vencimento próximo
              </p>
            ) : (
              proximosVencimentos.map((parcela, index) => (
                <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 gap-2 rounded-lg border">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm md:text-base truncate">{parcela.cliente}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      R$ {parcela.valor.toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                    <span className="text-xs md:text-sm text-muted-foreground">{parcela.data}</span>
                    <Badge 
                      variant={
                        parcela.status === "vencido" ? "destructive" : 
                        parcela.status === "vence_hoje" ? "destructive" : 
                        "secondary"
                      }
                      className="text-xs"
                    >
                      {parcela.status === "vencido" ? "Vencido" :
                       parcela.status === "vence_hoje" ? "Hoje" :
                       "Próximo"}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
