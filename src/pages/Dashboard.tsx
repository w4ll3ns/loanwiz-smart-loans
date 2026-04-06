import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, Legend, ResponsiveContainer } from "recharts";
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
  PieChart as PieChartIcon
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DashboardSkeleton } from "@/components/LoadingSkeletons";

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
      const { data: clientes, error: clientesError } = await supabase
        .from("clientes")
        .select("*");

      if (clientesError) throw clientesError;

      const { data: contratos, error: contratosError } = await supabase
        .from("contratos")
        .select("*")
        .eq("status", "ativo");

      if (contratosError) throw contratosError;

      // Buscar todos os contratos para o gráfico de capital mensal
      const { data: todosContratos, error: todosContratosError } = await supabase
        .from("contratos")
        .select("*");

      if (todosContratosError) throw todosContratosError;

      const { data: parcelas, error: parcelasError } = await supabase
        .from("parcelas")
        .select(`
          *,
          contratos!inner(
            clientes!inner(nome),
            valor_emprestado,
            numero_parcelas,
            data_emprestimo
          )
        `)
        .order("data_vencimento", { ascending: true });

      if (parcelasError) throw parcelasError;

      const totalEmprestado = contratos?.reduce((sum, c) => sum + Number(c.valor_emprestado), 0) || 0;
      
      const totalPendente = parcelas?.filter(p => p.status === "pendente" || p.status === "parcialmente_pago")
        .reduce((sum, p) => sum + Number(p.valor_original || p.valor), 0) || 0;
      
      const totalRecebido = parcelas?.reduce((sum, p) => sum + (Number(p.valor_pago) || 0), 0) || 0;
      
      const totalReceber = totalPendente;
      
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      const vencidas = parcelas?.filter(p => {
        const vencimento = new Date(p.data_vencimento + 'T00:00:00');
        return (p.status === "pendente" || p.status === "parcialmente_pago") && vencimento < hoje;
      }).length || 0;

      const lucro = parcelas
        ?.filter(p => p.status === "pago" || p.status === "parcialmente_pago")
        .reduce((sum, p) => {
          const valorPago = Number(p.valor_pago) || 0;
          if (valorPago <= 0) return sum;
          const valorEmprestado = Number(p.contratos?.valor_emprestado) || 0;
          const numeroParcelas = Number(p.contratos?.numero_parcelas) || 1;
          const principalParcela = valorEmprestado / numeroParcelas;
          const lucroParcela = valorPago - principalParcela;
          return sum + Math.max(lucroParcela, 0);
        }, 0) || 0;

      setStats({
        totalEmprestado,
        totalReceber,
        totalRecebido,
        lucro,
        clientesAtivos: clientes?.length || 0,
        contratosAtivos: contratos?.length || 0,
        parcelasVencidas: vencidas,
      });

      // Próximos vencimentos
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

      // Lucro mensal (últimos 6 meses)
      const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const agora = new Date();
      const mesesMap = new Map<string, number>();
      
      for (let i = 5; i >= 0; i--) {
        const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
        const key = `${mesesNomes[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
        mesesMap.set(key, 0);
      }

      parcelas
        ?.filter(p => (p.status === "pago" || p.status === "parcialmente_pago") && p.data_pagamento)
        .forEach(p => {
          const dataPag = new Date(p.data_pagamento + 'T00:00:00');
          const key = `${mesesNomes[dataPag.getMonth()]}/${String(dataPag.getFullYear()).slice(2)}`;
          if (mesesMap.has(key)) {
            const valorPago = Number(p.valor_pago) || 0;
            const valorEmprestado = Number(p.contratos?.valor_emprestado) || 0;
            const numeroParcelas = Number(p.contratos?.numero_parcelas) || 1;
            const principalParcela = valorEmprestado / numeroParcelas;
            const lucroParcela = Math.max(valorPago - principalParcela, 0);
            mesesMap.set(key, (mesesMap.get(key) || 0) + lucroParcela);
          }
        });

      setLucroMensal(Array.from(mesesMap.entries()).map(([mes, lucroVal]) => ({ mes, lucro: Number(lucroVal.toFixed(2)) })));

      // === NOVO: Distribuição por status ===
      let pagas = 0, pendentes = 0, atrasadas = 0, parciais = 0;
      parcelas?.forEach(p => {
        if (p.status === "pago") { pagas++; }
        else if (p.status === "parcialmente_pago") { parciais++; }
        else {
          const venc = new Date(p.data_vencimento + 'T00:00:00');
          if (venc < hoje) { atrasadas++; } else { pendentes++; }
        }
      });
      
      const distData: StatusDistribuicao[] = [];
      if (pagas > 0) distData.push({ name: "Pagas", value: pagas, color: "hsl(var(--success))" });
      if (pendentes > 0) distData.push({ name: "Pendentes", value: pendentes, color: "hsl(var(--muted-foreground))" });
      if (atrasadas > 0) distData.push({ name: "Atrasadas", value: atrasadas, color: "hsl(var(--destructive))" });
      if (parciais > 0) distData.push({ name: "Parciais", value: parciais, color: "hsl(var(--warning))" });
      setStatusDistribuicao(distData);

      // === NOVO: Capital emprestado vs recebido por mês ===
      const capitalMap = new Map<string, { emprestado: number; recebido: number }>();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
        const key = `${mesesNomes[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
        capitalMap.set(key, { emprestado: 0, recebido: 0 });
      }

      todosContratos?.forEach(c => {
        const dataEmp = new Date(c.data_emprestimo + 'T00:00:00');
        const key = `${mesesNomes[dataEmp.getMonth()]}/${String(dataEmp.getFullYear()).slice(2)}`;
        if (capitalMap.has(key)) {
          const entry = capitalMap.get(key)!;
          entry.emprestado += Number(c.valor_emprestado);
        }
      });

      parcelas
        ?.filter(p => (p.status === "pago" || p.status === "parcialmente_pago") && p.data_pagamento)
        .forEach(p => {
          const dataPag = new Date(p.data_pagamento + 'T00:00:00');
          const key = `${mesesNomes[dataPag.getMonth()]}/${String(dataPag.getFullYear()).slice(2)}`;
          if (capitalMap.has(key)) {
            const entry = capitalMap.get(key)!;
            entry.recebido += Number(p.valor_pago) || 0;
          }
        });

      setCapitalMensal(Array.from(capitalMap.entries()).map(([mes, v]) => ({
        mes,
        emprestado: Number(v.emprestado.toFixed(2)),
        recebido: Number(v.recebido.toFixed(2)),
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
      <div className="grid gap-3 md:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Emprestado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg md:text-2xl font-bold truncate">
              R$ {stats.totalEmprestado.toLocaleString('pt-BR')}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Capital em circulação</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">A Receber (Pendente)</CardTitle>
            <Calendar className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-lg md:text-2xl font-bold text-warning truncate">
              R$ {stats.totalReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
              Valor a quitar
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Recebido</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-lg md:text-2xl font-bold text-success truncate">
              R$ {stats.totalRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
              Inclui parciais e quitações
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Lucro</CardTitle>
            <TrendingUp className={`h-4 w-4 ${stats.lucro >= 0 ? 'text-success' : 'text-destructive'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-lg md:text-2xl font-bold truncate ${stats.lucro >= 0 ? 'text-success' : 'text-destructive'}`}>
              R$ {stats.lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Lucro sobre capital</p>
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

      {/* Gráfico de Evolução do Lucro Mensal */}
      {lucroMensal.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <TrendingUp className="h-5 w-5" />
              Evolução do Lucro Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                lucro: {
                  label: "Lucro",
                  color: "hsl(var(--success))",
                },
              }}
              className="aspect-[2/1] w-full"
            >
              <BarChart data={lucroMensal} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
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

      {/* Novos gráficos - Grid responsivo */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {/* Gráfico de Pizza - Distribuição por Status */}
        {statusDistribuicao.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <PieChartIcon className="h-5 w-5" />
                Distribuição de Parcelas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-square max-h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistribuicao}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
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

        {/* Gráfico de Barras - Capital Emprestado vs Recebido */}
        {capitalMensal.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <DollarSign className="h-5 w-5" />
                Capital Emprestado vs Recebido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  emprestado: {
                    label: "Emprestado",
                    color: "hsl(var(--primary))",
                  },
                  recebido: {
                    label: "Recebido",
                    color: "hsl(var(--success))",
                  },
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
