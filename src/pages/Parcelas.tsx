import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Check, X, Calendar, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Parcela {
  id: string;
  contratoId: string;
  clienteNome: string;
  numeroParcela: number;
  valorParcela: number;
  dataVencimento: string;
  dataPagamento?: string;
  status: "pendente" | "pago" | "vencido";
  diasAtraso?: number;
}

const mockParcelas: Parcela[] = [
  {
    id: "1",
    contratoId: "1",
    clienteNome: "João Silva",
    numeroParcela: 1,
    valorParcela: 500,
    dataVencimento: "2024-01-15",
    status: "vencido",
    diasAtraso: 5
  },
  {
    id: "2",
    contratoId: "1",
    clienteNome: "João Silva",
    numeroParcela: 2,
    valorParcela: 500,
    dataVencimento: "2024-01-16",
    status: "pendente"
  },
  {
    id: "3",
    contratoId: "2",
    clienteNome: "Maria Santos",
    numeroParcela: 1,
    valorParcela: 431.25,
    dataVencimento: "2024-01-17",
    status: "pendente"
  },
  {
    id: "4",
    contratoId: "2",
    clienteNome: "Maria Santos",
    numeroParcela: 2,
    valorParcela: 431.25,
    dataVencimento: "2024-01-14",
    dataPagamento: "2024-01-14",
    status: "pago"
  },
  {
    id: "5",
    contratoId: "1",
    clienteNome: "João Silva",
    numeroParcela: 3,
    valorParcela: 500,
    dataVencimento: "2024-01-18",
    status: "pendente"
  }
];

export default function Parcelas() {
  const [parcelas, setParcelas] = useState<Parcela[]>(mockParcelas);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const { toast } = useToast();

  const calcularDiasAtraso = (dataVencimento: string) => {
    const hoje = new Date();
    const vencimento = new Date(dataVencimento);
    const diffTime = hoje.getTime() - vencimento.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const filteredParcelas = parcelas.filter(parcela => {
    const matchesSearch = parcela.clienteNome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "todos" || parcela.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleMarcarPago = (parcelaId: string) => {
    setParcelas(parcelas.map(parcela => 
      parcela.id === parcelaId 
        ? { 
            ...parcela, 
            status: "pago" as const,
            dataPagamento: new Date().toISOString().split('T')[0],
            diasAtraso: undefined
          }
        : parcela
    ));
    
    toast({
      title: "Parcela marcada como paga",
      description: "O pagamento foi registrado com sucesso.",
    });
  };

  const handleMarcarPendente = (parcelaId: string) => {
    setParcelas(parcelas.map(parcela => 
      parcela.id === parcelaId 
        ? { 
            ...parcela, 
            status: "pendente" as const,
            dataPagamento: undefined
          }
        : parcela
    ));
    
    toast({
      title: "Parcela marcada como pendente",
      description: "O status foi atualizado.",
      variant: "destructive"
    });
  };

  const getStatusBadge = (parcela: Parcela) => {
    if (parcela.status === "pago") {
      return <Badge variant="default" className="bg-success">Pago</Badge>;
    }
    
    if (parcela.status === "vencido") {
      return <Badge variant="destructive">Vencido</Badge>;
    }
    
    // Verificar se está vencido mas ainda marcado como pendente
    const diasAtraso = calcularDiasAtraso(parcela.dataVencimento);
    if (diasAtraso > 0) {
      return <Badge variant="destructive">Vencido ({diasAtraso}d)</Badge>;
    }
    
    return <Badge variant="secondary">Pendente</Badge>;
  };

  const totalPendente = filteredParcelas
    .filter(p => p.status !== "pago")
    .reduce((acc, p) => acc + p.valorParcela, 0);

  const totalPago = filteredParcelas
    .filter(p => p.status === "pago")
    .reduce((acc, p) => acc + p.valorParcela, 0);

  const totalVencido = filteredParcelas
    .filter(p => p.status === "vencido" || (p.status === "pendente" && calcularDiasAtraso(p.dataVencimento) > 0))
    .reduce((acc, p) => acc + p.valorParcela, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Gestão de Parcelas</h1>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pendente</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredParcelas.filter(p => p.status !== "pago").length} parcelas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recebido</CardTitle>
            <Check className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              R$ {totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredParcelas.filter(p => p.status === "pago").length} parcelas pagas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vencido</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              R$ {totalVencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredParcelas.filter(p => p.status === "vencido" || (p.status === "pendente" && calcularDiasAtraso(p.dataVencimento) > 0)).length} parcelas em atraso
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Parcelas */}
      <Card>
        <CardHeader>
          <CardTitle>Parcelas ({filteredParcelas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredParcelas
                .sort((a, b) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime())
                .map((parcela) => (
                <TableRow key={parcela.id}>
                  <TableCell className="font-medium">{parcela.clienteNome}</TableCell>
                  <TableCell>{parcela.numeroParcela}</TableCell>
                  <TableCell>R$ {parcela.valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>{new Date(parcela.dataVencimento).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell>
                    {parcela.dataPagamento 
                      ? new Date(parcela.dataPagamento).toLocaleDateString('pt-BR')
                      : "-"
                    }
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(parcela)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      {parcela.status !== "pago" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarcarPago(parcela.id)}
                          className="text-success hover:bg-success hover:text-success-foreground"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarcarPendente(parcela.id)}
                          className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}