import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  FileText, 
  Calendar,
  AlertTriangle,
  CheckCircle2,
  PieChart as PieChartIcon,
  ArrowRight,
  Clock,
  Plus
} from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { DashboardSkeleton } from "@/components/LoadingSkeletons";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

interface DashboardStats {
  totalEmprestado: number;
  totalReceber: number;
  totalRecebido: number;
  lucro: number;
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

interface LucroMensal {
  mes: string;
  lucro: number;
}

interface StatusDistribuicao {
  name: string;
  value: number;
  color: string;
}

interface CapitalMensal {
  mes: string;
  emprestado: number;
  recebido: number;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalEmprestado: 0,
    totalReceber: 0,
    totalRecebido: 0,
    lucro: 0,
    clientesAtivos: 0,
    contratosAtivos: 0,
    parcelasVencidas: 0,
  });
  const [proximosVencimentos, setProximosVencimentos] = useState<ProximoVencimento[]>([]);
  const [lucroMensal, setLucroMensal] = useState<LucroMensal[]>([]);
  const [statusDistribuicao, setStatusDistribuicao] = useState<StatusDistribuicao[]>([]);
  const [capitalMensal, setCapitalMensal] = useState<CapitalMensal[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const { loadDashboardStats } = await import("@/services/dashboard");
      const data = await loadDashboardStats();

      setStats({
        totalEmprestado: Number(data.total_emprestado) || 0,
        totalReceber: Number(data.total_receber) || 0,
        totalRecebido: Number(data.total_recebido) || 0,
        lucro: Number(data.lucro) || 0,
        clientesAtivos: Number(data.clientes_ativos) || 0,
        contratosAtivos: Number(data.contratos_ativos) || 0,
        parcelasVencidas: Number(data.parcelas_vencidas) || 0,
      });

      const proximos = (data.proximos_vencimentos || []).map((p: any) => ({
        cliente: p.cliente || "Cliente",
        valor: Number(p.valor),
        data: new Date(p.data + 'T00:00:00').toLocaleDateString("pt-BR"),
        status: p.status as "vencido" | "vence_hoje" | "proximo",
      }));
      setProximosVencimentos(proximos);

      setLucroMensal((data.lucro_mensal || []).map((m: any) => ({
        mes: m.mes,
        lucro: Number(Number(m.lucro).toFixed(2)),
      })));

      const statusColors: Record<string, string> = {
        "Pagas": "hsl(var(--success))",
        "Pendentes": "hsl(var(--muted-foreground))",
        "Atrasadas": "hsl(var(--destructive))",
        "Parciais": "hsl(var(--warning))",
      };
      setStatusDistribuicao((data.status_distribuicao || []).map((s: any) => ({
        name: s.name,
        value: Number(s.value),
        color: statusColors[s.name] || "hsl(var(--muted-foreground))",
      })));

      setCapitalMensal((data.capital_mensal || []).map((c: any) => ({
        mes: c.mes,
        emprestado: Number(Number(c.emprestado).toFixed(2)),
        recebido: Number(Number(c.recebido).toFixed(2)),
      })));

    } catch (error: any) {
      toast({
        title: "Não foi possível carregar o dashboard",
        description: "Verifique sua conexão com a internet e recarregue a página.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <DashboardSkeleton />;

  const vencidosHoje = proximosVencimentos.filter(p => p.status === "vence_hoje");
  const vencidos = proximosVencimentos.filter(p => p.status === "vencido");
  const proximos = proximosVencimentos.filter(p => p.status === "proximo");
  const hasUrgentItems = stats.parcelasVencidas > 0 || vencidosHoje.length > 0;

  return (
    <div className="space-y-5 md:space-y-6">
      <PageHeader
        title="Dashboard"
        description="Visão geral e ações pendentes"
      >
        <Button asChild size="sm">
          <Link to="/contratos">
            <Plus className="h-4 w-4 mr-1.5" />
            Criar contrato
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/clientes">
            <Users className="h-4 w-4 mr-1.5" />
            Novo cliente
          </Link>
        </Button>
      </PageHeader>

      {/* Ações de Hoje - Only shown when there are urgent items */}
      {hasUrgentItems && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Ações pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {stats.parcelasVencidas > 0 && (
                <Link to="/parcelas" className="flex items-center gap-3 p-3 rounded-lg border border-destructive/20 bg-card hover:bg-muted/50 transition-colors group">
                  <div className="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{stats.parcelasVencidas} parcela{stats.parcelasVencidas > 1 ? 's' : ''} vencida{stats.parcelasVencidas > 1 ? 's' : ''}</p>
                    <p className="text-xs text-muted-foreground">Precisam de atenção imediata</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                </Link>
              )}
              {vencidosHoje.length > 0 && (
                <Link to="/parcelas" className="flex items-center gap-3 p-3 rounded-lg border border-warning/20 bg-card hover:bg-muted/50 transition-colors group">
                  <div className="h-9 w-9 rounded-full bg-warning/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="h-4 w-4 text-warning" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{vencidosHoje.length} vencimento{vencidosHoje.length > 1 ? 's' : ''} hoje</p>
                    <p className="text-xs text-muted-foreground">R$ {vencidosHoje.reduce((a, v) => a + v.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                </Link>
              )}
              {stats.contratosAtivos > 0 && (
                <Link to="/contratos" className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors group">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{stats.contratosAtivos} contrato{stats.contratosAtivos > 1 ? 's' : ''} ativo{stats.contratosAtivos > 1 ? 's' : ''}</p>
                    <p className="text-xs text-muted-foreground">Em andamento</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="stat-card-accent border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Capital em Circulação</span>
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <p className="text-lg md:text-2xl font-bold tracking-tight truncate">
              R$ {stats.totalEmprestado.toLocaleString('pt-BR')}
            </p>
          </CardContent>
        </Card>

        <Card className="stat-card-accent border-l-warning">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">A Receber</span>
              <Calendar className="h-4 w-4 text-warning" />
            </div>
            <p className="text-lg md:text-2xl font-bold tracking-tight text-warning truncate">
              R$ {stats.totalReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card className="stat-card-accent border-l-success">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Total Recebido</span>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>
            <p className="text-lg md:text-2xl font-bold tracking-tight text-success truncate">
              R$ {stats.totalRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card className={`stat-card-accent ${stats.lucro >= 0 ? 'border-l-success' : 'border-l-destructive'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Lucro</span>
              <TrendingUp className={`h-4 w-4 ${stats.lucro >= 0 ? 'text-success' : 'text-destructive'}`} />
            </div>
            <p className={`text-lg md:text-2xl font-bold tracking-tight truncate ${stats.lucro >= 0 ? 'text-success' : 'text-destructive'}`}>
              R$ {stats.lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick stats row */}
      <div className="grid gap-3 grid-cols-2">
        <Link to="/clientes">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.clientesAtivos}</p>
                <p className="text-xs text-muted-foreground">Clientes ativos</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/contratos">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.contratosAtivos}</p>
                <p className="text-xs text-muted-foreground">Contratos ativos</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Próximos Vencimentos */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Próximos vencimentos
            </CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link to="/parcelas">Ver todas <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {proximosVencimentos.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="Nenhum vencimento próximo"
                description="Quando houver parcelas vencendo, elas aparecerão aqui."
              />
            ) : (
              proximosVencimentos.map((parcela, index) => (
                <Link to="/parcelas" key={index} className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-muted/50 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{parcela.cliente}</p>
                    <p className="text-xs text-muted-foreground">
                      R$ {parcela.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">{parcela.data}</span>
                    <Badge 
                      variant={parcela.status === "vencido" ? "destructive" : parcela.status === "vence_hoje" ? "destructive" : "secondary"}
                      className="text-[10px]"
                    >
                      {parcela.status === "vencido" ? "Vencido" :
                       parcela.status === "vence_hoje" ? "Hoje" :
                       "Próximo"}
                    </Badge>
                  </div>
                </Link>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      {lucroMensal.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Evolução do Lucro Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                lucro: { label: "Lucro", color: "hsl(var(--success))" },
              }}
              className="aspect-[2.5/1] w-full"
            >
              <BarChart data={lucroMensal} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => `R$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    />
                  }
                />
                <Bar dataKey="lucro" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {statusDistribuicao.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-muted-foreground" />
                Distribuição de Parcelas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-square max-h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistribuicao}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                      style={{ fontSize: 11 }}
                    >
                      {statusDistribuicao.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload as StatusDistribuicao;
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <div className="flex items-center gap-2">
                              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                              <span className="text-sm font-medium">{d.name}: {d.value}</span>
                            </div>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {capitalMensal.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Emprestado vs Recebido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  emprestado: { label: "Emprestado", color: "hsl(var(--primary))" },
                  recebido: { label: "Recebido", color: "hsl(var(--success))" },
                }}
                className="aspect-[4/3] w-full"
              >
                <BarChart data={capitalMensal} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={(v) => `R$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                      />
                    }
                  />
                  <Bar dataKey="emprestado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="recebido" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
