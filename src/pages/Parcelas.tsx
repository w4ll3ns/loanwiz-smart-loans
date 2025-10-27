import { useState, useEffect } from "react";
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
import { supabase } from "@/integrations/supabase/client";

interface Parcela {
  id: string;
  contrato_id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  data_pagamento?: string;
  valor_pago?: number;
  status: string;
  contratos?: {
    clientes?: {
      nome: string;
    };
  };
}

export default function Parcelas() {
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const { toast } = useToast();

  useEffect(() => {
    loadParcelas();
  }, []);

  const loadParcelas = async () => {
    try {
      const { data, error } = await supabase
        .from("parcelas")
        .select(`
          *,
          contratos!inner(
            clientes!inner(nome)
          )
        `)
        .order("data_vencimento", { ascending: true });

      if (error) throw error;
      setParcelas(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar parcelas",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const calcularDiasAtraso = (dataVencimento: string) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const vencimento = new Date(dataVencimento);
    vencimento.setHours(0, 0, 0, 0);
    const diffTime = hoje.getTime() - vencimento.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const filteredParcelas = parcelas.filter(parcela => {
    const clienteNome = parcela.contratos?.clientes?.nome || "";
    const matchesSearch = clienteNome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "todos" || parcela.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleMarcarPago = async (parcelaId: string) => {
    try {
      const { error } = await supabase
        .from("parcelas")
        .update({
          status: "pago",
          data_pagamento: new Date().toISOString().split('T')[0],
        })
        .eq("id", parcelaId);

      if (error) throw error;

      toast({
        title: "Parcela marcada como paga",
        description: "O pagamento foi registrado com sucesso.",
      });

      loadParcelas();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleMarcarPendente = async (parcelaId: string) => {
    try {
      const { error } = await supabase
        .from("parcelas")
        .update({
          status: "pendente",
          data_pagamento: null,
        })
        .eq("id", parcelaId);

      if (error) throw error;

      toast({
        title: "Parcela marcada como pendente",
        description: "O status foi atualizado.",
        variant: "destructive"
      });

      loadParcelas();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (parcela: Parcela) => {
    if (parcela.status === "pago") {
      return <Badge variant="default" className="bg-success">Pago</Badge>;
    }
    
    const diasAtraso = calcularDiasAtraso(parcela.data_vencimento);
    if (diasAtraso > 0) {
      return <Badge variant="destructive">Vencido ({diasAtraso}d)</Badge>;
    }
    
    return <Badge variant="secondary">Pendente</Badge>;
  };

  const totalPendente = filteredParcelas
    .filter(p => p.status !== "pago")
    .reduce((acc, p) => acc + Number(p.valor), 0);

  const totalPago = filteredParcelas
    .filter(p => p.status === "pago")
    .reduce((acc, p) => acc + Number(p.valor), 0);

  const totalVencido = filteredParcelas
    .filter(p => p.status === "pendente" && calcularDiasAtraso(p.data_vencimento) > 0)
    .reduce((acc, p) => acc + Number(p.valor), 0);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Gestão de Parcelas</h1>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Pendente</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg md:text-2xl font-bold">
              R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredParcelas.filter(p => p.status !== "pago").length} parcelas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Recebido</CardTitle>
            <Check className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-lg md:text-2xl font-bold text-success">
              R$ {totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredParcelas.filter(p => p.status === "pago").length} parcelas pagas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Vencido</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-lg md:text-2xl font-bold text-destructive">
              R$ {totalVencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredParcelas.filter(p => p.status === "pendente" && calcularDiasAtraso(p.data_vencimento) > 0).length} parcelas em atraso
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 md:pt-6">
          <div className="flex flex-col md:flex-row gap-4">
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
              <SelectTrigger className="md:w-48">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Parcelas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">Parcelas ({filteredParcelas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Cliente</TableHead>
                  <TableHead className="hidden md:table-cell">Parcela</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead className="hidden md:table-cell">Vencimento</TableHead>
                  <TableHead className="hidden lg:table-cell">Pagamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParcelas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhuma parcela encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredParcelas.map((parcela) => (
                    <TableRow key={parcela.id}>
                      <TableCell className="font-medium">
                        {parcela.contratos?.clientes?.nome}
                        <div className="md:hidden text-xs text-muted-foreground mt-1">
                          Parcela {parcela.numero_parcela} • {new Date(parcela.data_vencimento).toLocaleDateString('pt-BR')}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{parcela.numero_parcela}</TableCell>
                      <TableCell>R$ {Number(parcela.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="hidden md:table-cell">{new Date(parcela.data_vencimento).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {parcela.data_pagamento 
                          ? new Date(parcela.data_pagamento).toLocaleDateString('pt-BR')
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
