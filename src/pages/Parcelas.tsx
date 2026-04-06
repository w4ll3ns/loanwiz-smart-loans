import { useState, useEffect } from "react";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Check, X, Calendar, AlertTriangle, Trash2, Undo2, FileText, Banknote, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { AccessRestrictedModal } from "@/components/AccessRestrictedModal";
import { getLocalDateString } from "@/lib/utils";
import { calcularDiasAtraso, calcularJurosParcela, removerAcentos } from "@/lib/calculos";
import { PagamentoModal, HistoricoModal, EditarDataModal } from "@/components/parcelas";

interface Parcela {
  id: string;
  contrato_id: string;
  numero_parcela: number;
  valor: number;
  valor_original: number;
  data_vencimento: string;
  data_vencimento_original?: string;
  data_pagamento?: string;
  valor_pago?: number;
  status: string;
  contratos?: {
    clientes?: { nome: string };
    percentual?: number;
    tipo_juros?: string;
    valor_emprestado?: number;
    numero_parcelas?: number;
  };
}

interface HistoricoParcela {
  id: string;
  data_pagamento: string;
  valor_pago: number | null;
  tipo_pagamento: string | null;
  observacao: string | null;
  created_at: string;
  tipo_evento: string;
  data_vencimento_anterior: string | null;
  data_vencimento_nova: string | null;
}

export default function Parcelas() {
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pendente");
  const [mostrarTodas, setMostrarTodas] = useState(false);
  const [dataInicioDashboard, setDataInicioDashboard] = useState<string>("");
  const [dataFimDashboard, setDataFimDashboard] = useState<string>("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [parcelaToDelete, setParcelaToDelete] = useState<string | null>(null);
  const [isPagamentoDialogOpen, setIsPagamentoDialogOpen] = useState(false);
  const [isHistoricoDialogOpen, setIsHistoricoDialogOpen] = useState(false);
  const [isEditarDataDialogOpen, setIsEditarDataDialogOpen] = useState(false);
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [parcelaToPay, setParcelaToPay] = useState<Parcela | null>(null);
  const [parcelaHistorico, setParcelaHistorico] = useState<Parcela | null>(null);
  const [parcelaToEditData, setParcelaToEditData] = useState<Parcela | null>(null);
  const [historico, setHistorico] = useState<HistoricoParcela[]>([]);
  const [totalRecebidoHoje, setTotalRecebidoHoje] = useState<number>(0);
  const [pagamentosHoje, setPagamentosHoje] = useState<number>(0);
  const [parcelasRecebidoHojeIds, setParcelasRecebidoHojeIds] = useState<string[]>([]);
  const [cardFilter, setCardFilter] = useState<"recebido_hoje" | "vencido" | null>(null);
  const { toast } = useToast();
  const { canCreate, userEmail } = useUserRole();

  const formatDate = (dateString: string) => {
    return format(new Date(dateString + 'T00:00:00'), 'dd/MM/yyyy');
  };

  useEffect(() => {
    loadParcelas();
    loadRecebidoHoje();
  }, []);

  const loadRecebidoHoje = async () => {
    try {
      const hoje = new Date();
      const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0, 0);
      const fimHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59, 999);

      const { data, error } = await supabase
        .from("parcelas_historico")
        .select("valor_pago, parcela_id")
        .eq("tipo_evento", "pagamento")
        .gte("data_pagamento", inicioHoje.toISOString())
        .lt("data_pagamento", fimHoje.toISOString());

      if (error) throw error;

      const total = data?.reduce((acc, p) => acc + (Number(p.valor_pago) || 0), 0) || 0;
      setTotalRecebidoHoje(total);
      setPagamentosHoje(data?.length || 0);
      setParcelasRecebidoHojeIds([...new Set(data?.map(p => p.parcela_id) || [])]);
    } catch (error) {
      console.error("Erro ao carregar recebidos hoje:", error);
    }
  };

  const loadParcelas = async () => {
    try {
      const { data, error } = await supabase
        .from("parcelas")
        .select(`
          *,
          contratos!inner(
            clientes!inner(nome),
            percentual,
            tipo_juros,
            valor_emprestado,
            numero_parcelas
          )
        `)
        .order("data_vencimento", { ascending: true });

      if (error) throw error;
      setParcelas(data || []);
    } catch (error: any) {
      toast({ title: "Não foi possível carregar as parcelas", variant: "destructive" });
    }
  };

  const dashboardParcelas = parcelas.filter(parcela => {
    if (!dataInicioDashboard && !dataFimDashboard) return true;
    const dataVencimento = new Date(parcela.data_vencimento + 'T00:00:00');
    if (dataInicioDashboard && dataFimDashboard) {
      return dataVencimento >= new Date(dataInicioDashboard + 'T00:00:00') && dataVencimento <= new Date(dataFimDashboard + 'T23:59:59');
    } else if (dataInicioDashboard) {
      return dataVencimento >= new Date(dataInicioDashboard + 'T00:00:00');
    } else if (dataFimDashboard) {
      return dataVencimento <= new Date(dataFimDashboard + 'T23:59:59');
    }
    return true;
  });

  const filteredParcelas = parcelas.filter(parcela => {
    if (cardFilter === "recebido_hoje") return parcelasRecebidoHojeIds.includes(parcela.id);
    if (cardFilter === "vencido") return (parcela.status === "pendente" || parcela.status === "parcialmente_pago") && calcularDiasAtraso(parcela.data_vencimento) > 0;

    const clienteNome = parcela.contratos?.clientes?.nome || "";
    const matchesSearch = removerAcentos(clienteNome.toLowerCase()).includes(removerAcentos(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "todos" || parcela.status === statusFilter;
    
    if (!mostrarTodas) {
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
      const dataLimite = new Date(); dataLimite.setDate(hoje.getDate() + 7); dataLimite.setHours(23, 59, 59, 999);
      const dataVencimento = new Date(parcela.data_vencimento + 'T00:00:00');
      const estaVencida = parcela.status === "pendente" && dataVencimento < hoje;
      const dentroDosPróximos7Dias = dataVencimento >= hoje && dataVencimento <= dataLimite;
      return matchesSearch && matchesStatus && (estaVencida || dentroDosPróximos7Dias);
    }
    
    return matchesSearch && matchesStatus;
  });

  const abrirModalPagamento = (parcela: Parcela) => {
    setParcelaToPay(parcela);
    setIsPagamentoDialogOpen(true);
  };

  const handleMarcarPendente = async (parcelaId: string) => {
    try {
      await supabase.from("parcelas_historico").delete().eq("parcela_id", parcelaId).eq("tipo_evento", "pagamento");
      await supabase.from("parcelas").update({ status: "pendente", data_pagamento: null, valor_pago: 0 }).eq("id", parcelaId);
      toast({ title: "Pagamentos desfeitos", description: "A parcela foi resetada." });
      loadParcelas();
    } catch (error: any) {
      toast({ title: "Erro", description: "Não foi possível desfazer.", variant: "destructive" });
    }
  };

  const loadHistorico = async (parcela: Parcela) => {
    try {
      const { data, error } = await supabase
        .from("parcelas_historico")
        .select("*")
        .eq("parcela_id", parcela.id)
        .order("data_pagamento", { ascending: false });

      if (error) throw error;
      setHistorico(data || []);
      setParcelaHistorico(parcela);
      setIsHistoricoDialogOpen(true);
    } catch (error: any) {
      toast({ title: "Erro ao carregar histórico", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!parcelaToDelete) return;
    try {
      await supabase.from("parcelas").delete().eq("id", parcelaToDelete);
      toast({ title: "Parcela excluída" });
      setIsDeleteDialogOpen(false);
      setParcelaToDelete(null);
      loadParcelas();
    } catch (error: any) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  };

  const getStatusBadge = (parcela: Parcela) => {
    if (parcela.status === "pago") return <Badge variant="default" className="bg-success">Pago Total</Badge>;
    if (parcela.status === "parcialmente_pago") {
      const diasAtraso = calcularDiasAtraso(parcela.data_vencimento);
      if (diasAtraso > 0) return <Badge className="bg-amber-500 text-white">Parcial - Atrasado ({diasAtraso}d)</Badge>;
      return <Badge className="bg-amber-500 text-white">Pago Parcial</Badge>;
    }
    const diasAtraso = calcularDiasAtraso(parcela.data_vencimento);
    if (diasAtraso > 0) return <Badge variant="destructive">Atrasado ({diasAtraso}d)</Badge>;
    return <Badge variant="secondary">Pendente</Badge>;
  };

  const totalPendente = dashboardParcelas.filter(p => p.status !== "pago").reduce((acc, p) => acc + Number(p.valor_original || p.valor), 0);
  const totalPago = dashboardParcelas.reduce((acc, p) => acc + (Number(p.valor_pago) || 0), 0);
  const totalJurosRecebido = dashboardParcelas
    .filter(p => p.status === "pago" || p.status === "parcialmente_pago")
    .reduce((acc, p) => {
      const valorEmprestado = Number(p.contratos?.valor_emprestado || 0);
      const numeroParcelas = p.contratos?.numero_parcelas || 1;
      const principalParcela = valorEmprestado / numeroParcelas;
      const pago = Number(p.valor_pago) || 0;
      return acc + Math.max(pago - principalParcela, 0);
    }, 0);
  const totalVencido = dashboardParcelas
    .filter(p => (p.status === "pendente" || p.status === "parcialmente_pago") && calcularDiasAtraso(p.data_vencimento) > 0)
    .reduce((acc, p) => acc + Number(p.valor_original || p.valor), 0);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-xl md:text-3xl font-bold truncate">Gestão de Parcelas</h1>
      </div>

      {/* Filtro de Período */}
      <Card className="w-full">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-medium">Filtrar Período</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pb-4">
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
            <div className="flex-1 min-w-0">
              <Label htmlFor="data-inicio" className="text-xs mb-1 block">Data Inicial</Label>
              <Input id="data-inicio" type="date" value={dataInicioDashboard} onChange={(e) => setDataInicioDashboard(e.target.value)} className="w-full sm:w-[140px] h-8 text-base md:text-xs" />
            </div>
            <div className="flex-1 min-w-0">
              <Label htmlFor="data-fim" className="text-xs mb-1 block">Data Final</Label>
              <Input id="data-fim" type="date" value={dataFimDashboard} onChange={(e) => setDataFimDashboard(e.target.value)} className="w-full sm:w-[140px] h-8 text-base md:text-xs" />
            </div>
            <Button variant="outline" size="sm" onClick={() => { setDataInicioDashboard(""); setDataFimDashboard(""); }} className="h-8 text-xs px-3">Limpar</Button>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo */}
      <div className="grid gap-1.5 md:gap-4 grid-cols-2 md:grid-cols-5 w-full min-w-0">
        <Card className={`min-w-0 overflow-hidden border-l-4 border-l-primary cursor-pointer transition-shadow hover:shadow-md ${cardFilter === "recebido_hoje" ? "ring-2 ring-primary" : ""}`} onClick={() => setCardFilter(cardFilter === "recebido_hoje" ? null : "recebido_hoje")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-2 md:px-3 pt-2 md:pt-3">
            <CardTitle className="text-xs md:text-sm font-medium truncate">Recebido Hoje</CardTitle>
            <Banknote className="h-3 w-3 md:h-4 md:w-4 text-primary flex-shrink-0 ml-1" />
          </CardHeader>
          <CardContent className="px-2 md:px-3 pb-2 md:pb-3">
            <div className="text-sm md:text-2xl font-bold text-primary truncate">R$ {totalRecebidoHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground truncate">{pagamentosHoje} pagamento{pagamentosHoje !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-2 md:px-3 pt-2 md:pt-3">
            <CardTitle className="text-xs md:text-sm font-medium truncate">A Receber (Pendente)</CardTitle>
            <Calendar className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0 ml-1" />
          </CardHeader>
          <CardContent className="px-2 md:px-3 pb-2 md:pb-3">
            <div className="text-sm md:text-2xl font-bold truncate">R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground truncate">{dashboardParcelas.filter(p => p.status !== "pago").length} parcelas a quitar</p>
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-2 md:px-3 pt-2 md:pt-3">
            <CardTitle className="text-xs md:text-sm font-medium truncate">Total Recebido</CardTitle>
            <Check className="h-3 w-3 md:h-4 md:w-4 text-success flex-shrink-0 ml-1" />
          </CardHeader>
          <CardContent className="px-2 md:px-3 pb-2 md:pb-3">
            <div className="text-sm md:text-2xl font-bold text-success truncate">R$ {totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground truncate">Inclui parciais e quitações</p>
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-2 md:px-3 pt-2 md:pt-3">
            <CardTitle className="text-xs md:text-sm font-medium truncate">Juros Recebidos</CardTitle>
            <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-emerald-500 flex-shrink-0 ml-1" />
          </CardHeader>
          <CardContent className="px-2 md:px-3 pb-2 md:pb-3">
            <div className="text-sm md:text-2xl font-bold text-emerald-600 truncate">R$ {totalJurosRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground truncate">Lucro sobre capital</p>
          </CardContent>
        </Card>

        <Card className={`min-w-0 overflow-hidden cursor-pointer transition-shadow hover:shadow-md ${cardFilter === "vencido" ? "ring-2 ring-destructive" : ""}`} onClick={() => setCardFilter(cardFilter === "vencido" ? null : "vencido")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-2 md:px-3 pt-2 md:pt-3">
            <CardTitle className="text-xs md:text-sm font-medium truncate">Total Vencido</CardTitle>
            <AlertTriangle className="h-3 w-3 md:h-4 md:w-4 text-destructive flex-shrink-0 ml-1" />
          </CardHeader>
          <CardContent className="px-2 md:px-3 pb-2 md:pb-3">
            <div className="text-sm md:text-2xl font-bold text-destructive truncate">R$ {totalVencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground truncate">{dashboardParcelas.filter(p => (p.status === "pendente" || p.status === "parcialmente_pago") && calcularDiasAtraso(p.data_vencimento) > 0).length} parcelas em atraso</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="w-full overflow-hidden">
        <CardContent className="pt-3 pb-3 px-3 md:px-6">
          <div className="flex flex-col md:flex-row gap-2 w-full">
            <div className="flex-1 relative w-full min-w-0">
              <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
              <Input placeholder="Buscar cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-7 w-full h-8 text-base md:text-xs" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40 h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Parcelas */}
      <Card className="w-full overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-base md:text-lg">
              Parcelas ({filteredParcelas.length})
              {!mostrarTodas && !cardFilter && <span className="text-sm font-normal text-muted-foreground ml-2 hidden sm:inline">(Próximos 7 dias)</span>}
            </CardTitle>
            {cardFilter && (
              <Badge variant="secondary" className="cursor-pointer text-xs" onClick={() => setCardFilter(null)}>
                {cardFilter === "recebido_hoje" ? "Recebido Hoje" : "Vencidas"} ✕
              </Badge>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setMostrarTodas(!mostrarTodas)} className="text-xs sm:text-sm w-full sm:w-auto">
            {mostrarTodas ? "Próximos 7 Dias" : "Ver Todas"}
          </Button>
        </CardHeader>
        <CardContent className="p-0 md:p-6">
          {/* Mobile Cards */}
          <div className="md:hidden space-y-3 p-2 w-full min-w-0 max-w-full">
            {filteredParcelas.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">Nenhuma parcela encontrada</div>
            ) : (
              filteredParcelas.map((parcela) => (
                <Card key={parcela.id} className="border-l-4 min-w-0 overflow-hidden" style={{
                  borderLeftColor: parcela.status === "pago" ? "hsl(var(--success))" : calcularDiasAtraso(parcela.data_vencimento) > 0 ? "hsl(var(--destructive))" : "hsl(var(--warning))"
                }}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="font-semibold text-sm truncate">{parcela.contratos?.clientes?.nome}</p>
                        <p className="text-xs text-muted-foreground">Parcela {parcela.numero_parcela}</p>
                      </div>
                      <div className="flex-shrink-0">{getStatusBadge(parcela)}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="overflow-hidden">
                        <p className="text-muted-foreground text-xs">Valor</p>
                        <p className="font-semibold text-sm break-all">R$ {Number(parcela.valor_original || parcela.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        {parcela.valor_pago && parcela.valor_pago > 0 && (
                          <p className="text-xs text-success break-all">Pago: R$ {Number(parcela.valor_pago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-muted-foreground text-xs">Vencimento</p>
                        <p className="font-semibold text-sm">{formatDate(parcela.data_vencimento)}</p>
                        {calcularDiasAtraso(parcela.data_vencimento) > 0 && (
                          <p className="text-xs text-destructive">{calcularDiasAtraso(parcela.data_vencimento)}d atraso</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 pt-1.5 border-t w-full">
                      <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => { setParcelaToEditData(parcela); setIsEditarDataDialogOpen(true); }} className="flex-1 h-9 text-xs px-2">
                          <Calendar className="h-3.5 w-3.5 mr-1" />Editar Data
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => loadHistorico(parcela)} className="flex-1 h-9 text-xs px-2">
                          <FileText className="h-3.5 w-3.5 mr-1" />Histórico
                        </Button>
                      </div>
                      <div className="flex gap-1.5">
                        {parcela.status !== "pago" ? (
                          <Button size="sm" onClick={() => abrirModalPagamento(parcela)} className="flex-1 bg-success hover:bg-success/90 h-9 text-xs px-2">
                            <Check className="h-3.5 w-3.5 mr-1" />Baixar
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => handleMarcarPendente(parcela.id)} className="flex-1 text-warning hover:bg-warning hover:text-warning-foreground h-9 text-xs px-2">
                            <Undo2 className="h-3.5 w-3.5 mr-1" />Desfazer
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => { setParcelaToDelete(parcela.id); setIsDeleteDialogOpen(true); }} className="flex-1 text-destructive hover:bg-destructive hover:text-destructive-foreground h-9 text-xs px-2">
                          <Trash2 className="h-3.5 w-3.5 mr-1" />Excluir
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Cliente</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="hidden lg:table-cell">Pagamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParcelas.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma parcela encontrada</TableCell></TableRow>
                ) : (
                  filteredParcelas.map((parcela) => (
                    <TableRow key={parcela.id}>
                      <TableCell className="font-medium">{parcela.contratos?.clientes?.nome}</TableCell>
                      <TableCell className="text-sm">{parcela.numero_parcela}</TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-col">
                          <span>R$ {Number(parcela.valor_original || parcela.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          {parcela.valor_pago && parcela.valor_pago > 0 && (
                            <span className="text-xs text-muted-foreground">Pago: R$ {Number(parcela.valor_pago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(parcela.data_vencimento)}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">{parcela.data_pagamento ? formatDate(parcela.data_pagamento) : "-"}</TableCell>
                      <TableCell>{getStatusBadge(parcela)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="outline" size="sm" onClick={() => { setParcelaToEditData(parcela); setIsEditarDataDialogOpen(true); }} title="Editar data">
                            <Calendar className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => loadHistorico(parcela)} title="Histórico">
                            <FileText className="h-4 w-4" />
                          </Button>
                          {parcela.status !== "pago" ? (
                            <Button variant="outline" size="sm" onClick={() => abrirModalPagamento(parcela)} className="text-success hover:bg-success hover:text-success-foreground" title="Baixar">
                              <Check className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => handleMarcarPendente(parcela.id)} className="text-warning hover:bg-warning hover:text-warning-foreground" title="Desfazer">
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => { setParcelaToDelete(parcela.id); setIsDeleteDialogOpen(true); }} className="text-destructive hover:bg-destructive hover:text-destructive-foreground" title="Excluir">
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      {/* Modals */}
      <PagamentoModal
        isOpen={isPagamentoDialogOpen}
        onOpenChange={setIsPagamentoDialogOpen}
        parcela={parcelaToPay}
        onPagamentoConfirmado={() => { loadParcelas(); loadRecebidoHoje(); }}
      />

      <HistoricoModal
        isOpen={isHistoricoDialogOpen}
        onOpenChange={setIsHistoricoDialogOpen}
        parcela={parcelaHistorico}
        historico={historico}
        onHistoricoUpdated={(p) => loadHistorico(p)}
        onParcelasUpdated={loadParcelas}
      />

      <EditarDataModal
        isOpen={isEditarDataDialogOpen}
        onOpenChange={setIsEditarDataDialogOpen}
        parcela={parcelaToEditData}
        onDataAlterada={loadParcelas}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="w-[95vw] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir esta parcela? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="w-full sm:w-auto bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AccessRestrictedModal open={isAccessModalOpen} onOpenChange={setIsAccessModalOpen} userEmail={userEmail} />
    </div>
  );
}
