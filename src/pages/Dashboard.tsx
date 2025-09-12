import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  FileText, 
  Calendar,
  AlertTriangle
} from "lucide-react";
import { Link } from "react-router-dom";

const mockData = {
  totalEmprestado: 45000,
  totalReceber: 52000,
  clientesAtivos: 28,
  contratosAtivos: 35,
  parcelasVencidas: 12,
  proximosVencimentos: [
    { cliente: "João Silva", valor: 500, data: "2024-01-15", status: "vencido" },
    { cliente: "Maria Santos", valor: 750, data: "2024-01-16", status: "vence_hoje" },
    { cliente: "Pedro Costa", valor: 300, data: "2024-01-17", status: "proximo" },
    { cliente: "Ana Oliveira", valor: 1200, data: "2024-01-18", status: "proximo" },
  ]
};

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/clientes">Novo Cliente</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/contratos">Novo Contrato</Link>
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Emprestado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {mockData.totalEmprestado.toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-muted-foreground">Capital em circulação</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total a Receber</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              R$ {mockData.totalReceber.toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-muted-foreground">
              Lucro: R$ {(mockData.totalReceber - mockData.totalEmprestado).toLocaleString('pt-BR')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockData.clientesAtivos}</div>
            <p className="text-xs text-muted-foreground">Cadastros ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contratos Ativos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockData.contratosAtivos}</div>
            <p className="text-xs text-muted-foreground">Em andamento</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerta de Parcelas Vencidas */}
      {mockData.parcelasVencidas > 0 && (
        <Card className="border-destructive">
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Atenção!</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Você tem <strong>{mockData.parcelasVencidas} parcelas vencidas</strong> que precisam de atenção.
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
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Próximos Vencimentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockData.proximosVencimentos.map((parcela, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex-1">
                  <p className="font-medium">{parcela.cliente}</p>
                  <p className="text-sm text-muted-foreground">
                    R$ {parcela.valor.toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{parcela.data}</span>
                  <Badge 
                    variant={
                      parcela.status === "vencido" ? "destructive" : 
                      parcela.status === "vence_hoje" ? "destructive" : 
                      "secondary"
                    }
                  >
                    {parcela.status === "vencido" ? "Vencido" :
                     parcela.status === "vence_hoje" ? "Vence Hoje" :
                     "Próximo"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}