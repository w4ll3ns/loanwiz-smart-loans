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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Check, X, CalendarIcon, AlertTriangle, Trash2, Undo2, FileText, Banknote, TrendingUp, Download, Calculator } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ptBR } from "date-fns/locale/pt-BR";
import { parse } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { AccessRestrictedModal } from "@/components/AccessRestrictedModal";
import { getLocalDateString } from "@/lib/utils";
import { calcularDiasAtraso, calcularJurosParcela, removerAcentos } from "@/lib/calculos";
import { exportarCsv } from "@/lib/exportCsv";
import { PagamentoModal, HistoricoModal, EditarDataModal } from "@/components/parcelas";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

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

  const {
    paginatedItems: parcelasPaginadas,
    currentPage,
    totalPages,
    showPagination,
    goToNextPage,
    goToPrevPage,
  } = usePagination(filteredParcelas);

  const abrirModalPagamento = (parcela: Parcela) => {
    setParcelaToPay(parcela);
    setIsPagamentoDialogOpen(true);
  };

  const handleMarcarPendente = async (parcelaId: string) => {
    try {
      const { estornarPagamento } = await import("@/services/parcelas");
      await estornarPagamento(parcelaId);
      toast({ title: "Pagamentos desfeitos", description: "A parcela foi resetada para pendente." });
      loadParcelas();
    } catch (error: any) {
      toast({ title: "Erro ao desfazer", description: "Não foi possível reverter o pagamento.", variant: "destructive" });
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
      toast({ title: "Parcela excluída", description: "O registro foi removido." });
      setIsDeleteDialogOpen(false);
      setParcelaToDelete(null);
      loadParcelas();
    } catch (error: any) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  };

  const getStatusBadge = (parcela: Parcela) => {
    if (parcela.status === "pago") return <Badge variant="default" className="bg-success text-[10px]">Pago</Badge>;
    if (parcela.status === "parcialmente_pago") {
      const diasAtraso = calcularDiasAtraso(parcela.data_vencimento);
      if (diasAtraso > 0) return <Badge className="bg-warning text-warning-foreground text-[10px]">Parcial ({diasAtraso}d)</Badge>;
      return <Badge className="bg-warning text-warning-foreground text-[10px]">Parcial</Badge>;
    }
    const diasAtraso = calcularDiasAtraso(parcela.data_vencimento);
    if (diasAtraso > 0) return <Badge variant="destructive" className="text-[10px]">Atrasado ({diasAtraso}d)</Badge>;
    return <Badge variant="secondary" className="text-[10px]">Pendente</Badge>;
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
  const parcelasEmAtraso = dashboardParcelas.filter(p => (p.status === "pendente" || p.status === "parcialmente_pago") && calcularDiasAtraso(p.data_vencimento) > 0).length;

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        title="Parcelas"
        description="Cobranças, recebimentos e controle diário"
      />

      {/* Filtro de Período */}
      <Card className="overflow-hidden">
        <CardContent className="py-3 px-3 md:px-4 overflow-x-hidden">
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end min-w-0">
            <div className="flex-1 min-w-0">
              <Label className="text-xs mb-1 block text-muted-foreground">Período inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full h-8 justify-start text-left font-normal text-base md:text-xs", !dataInicioDashboard && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-3.5 w-3.5 flex-shrink-0" />
                    {dataInicioDashboard ? format(parse(dataInicioDashboard, "yyyy-MM-dd", new Date()), "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" locale={ptBR} selected={dataInicioDashboard ? parse(dataInicioDashboard, "yyyy-MM-dd", new Date()) : undefined} onSelect={(date) => setDataInicioDashboard(date ? format(date, "yyyy-MM-dd") : "")} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex-1 min-w-0">
              <Label className="text-xs mb-1 block text-muted-foreground">Período final</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full h-8 justify-start text-left font-normal text-base md:text-xs", !dataFimDashboard && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-3.5 w-3.5 flex-shrink-0" />
                    {dataFimDashboard ? format(parse(dataFimDashboard, "yyyy-MM-dd", new Date()), "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" locale={ptBR} selected={dataFimDashboard ? parse(dataFimDashboard, "yyyy-MM-dd", new Date()) : undefined} onSelect={(date) => setDataFimDashboard(date ? format(date, "yyyy-MM-dd") : "")} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            {(dataInicioDashboard || dataFimDashboard) && (
              <Button variant="ghost" size="sm" onClick={() => { setDataInicioDashboard(""); setDataFimDashboard(""); }} className="h-8 text-xs px-3 text-muted-foreground">
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid gap-2 md:gap-3 grid-cols-2 md:grid-cols-5">
        <div
          className={`metric-card border-l-4 border-l-primary ${cardFilter === "recebido_hoje" ? "ring-2 ring-primary shadow-md" : ""}`}
          onClick={() => setCardFilter(cardFilter === "recebido_hoje" ? null : "recebido_hoje")}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="metric-card-label">Recebido Hoje</span>
            <Banknote className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          </div>
          <p className="metric-card-value text-primary">R$ {totalRecebidoHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="text-[10px] text-muted-foreground">{pagamentosHoje} pagamento{pagamentosHoje !== 1 ? 's' : ''}</p>
        </div>

        <div className="metric-card cursor-default">
          <div className="flex items-center justify-between mb-1">
            <span className="metric-card-label">A Receber</span>
            <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          </div>
          <p className="metric-card-value">R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="text-[10px] text-muted-foreground">{dashboardParcelas.filter(p => p.status !== "pago").length} pendentes</p>
        </div>

        <div className="metric-card cursor-default">
          <div className="flex items-center justify-between mb-1">
            <span className="metric-card-label">Total Recebido</span>
            <Check className="h-3.5 w-3.5 text-success flex-shrink-0" />
          </div>
          <p className="metric-card-value text-success">R$ {totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="text-[10px] text-muted-foreground">Parciais e quitações</p>
        </div>

        <div className="metric-card cursor-default border-l-4 border-l-success">
          <div className="flex items-center justify-between mb-1">
            <span className="metric-card-label">Juros Recebidos</span>
            <TrendingUp className="h-3.5 w-3.5 text-success flex-shrink-0" />
          </div>
          <p className="metric-card-value text-success">R$ {totalJurosRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="text-[10px] text-muted-foreground">Lucro sobre capital</p>
        </div>

        <div
          className={`metric-card col-span-2 md:col-span-1 ${cardFilter === "vencido" ? "ring-2 ring-destructive shadow-md" : ""}`}
          onClick={() => setCardFilter(cardFilter === "vencido" ? null : "vencido")}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="metric-card-label">Total Vencido</span>
            <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
          </div>
          <p className="metric-card-value text-destructive">R$ {totalVencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="text-[10px] text-muted-foreground">{parcelasEmAtraso} em atraso</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-3 px-3 md:px-4">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="flex-1 relative min-w-0">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar por cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 h-8 text-base md:text-xs" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-36 h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="parcialmente_pago">Parcial</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-sm md:text-base font-semibold">
              Parcelas
              <span className="ml-1.5 text-muted-foreground font-normal">({filteredParcelas.length})</span>
            </CardTitle>
            {!mostrarTodas && !cardFilter && (
              <Badge variant="outline" className="text-[10px]">Próximos 7 dias</Badge>
            )}
            {cardFilter && (
              <Badge variant="secondary" className="cursor-pointer text-[10px]" onClick={() => setCardFilter(null)}>
                {cardFilter === "recebido_hoje" ? "Recebido Hoje" : "Vencidas"} ✕
              </Badge>
            )}
          </div>
          <div className="flex gap-1.5 items-center">
            <Button variant="outline" size="sm" onClick={() => {
              exportarCsv("parcelas.csv",
                ["Cliente", "Nº Parcela", "Valor", "Vencimento", "Status", "Valor Pago", "Data Pagamento"],
                filteredParcelas.map(p => [
                  p.contratos?.clientes?.nome || "",
                  p.numero_parcela,
                  Number(p.valor_original || p.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
                  formatDate(p.data_vencimento),
                  p.status,
                  p.valor_pago ? Number(p.valor_pago).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "",
                  p.data_pagamento ? formatDate(p.data_pagamento) : "",
                ])
              );
            }} className="h-7 text-xs">
              <Download className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">CSV</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMostrarTodas(!mostrarTodas)} className="h-7 text-xs">
              {mostrarTodas ? "Próx. 7 dias" : "Ver todas"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 md:p-6 md:pt-0">
          {/* Mobile Cards */}
          <div className="md:hidden space-y-2 p-3">
            {parcelasPaginadas.length === 0 ? (
              <EmptyState icon={Calculator} title="Nenhuma parcela encontrada" description="Ajuste os filtros ou aguarde novos vencimentos." />
            ) : (
              parcelasPaginadas.map((parcela) => (
                <Card key={parcela.id} className="border-l-4 overflow-hidden" style={{
                  borderLeftColor: parcela.status === "pago" ? "hsl(var(--success))" : calcularDiasAtraso(parcela.data_vencimento) > 0 ? "hsl(var(--destructive))" : "hsl(var(--warning))"
                }}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{parcela.contratos?.clientes?.nome}</p>
                        <p className="text-xs text-muted-foreground">Parcela {parcela.numero_parcela}</p>
                      </div>
                      <div className="flex-shrink-0">{getStatusBadge(parcela)}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="overflow-hidden">
                        <p className="text-muted-foreground text-[10px] uppercase">Valor</p>
                        <p className="font-semibold text-sm tabular-nums">R$ {Number(parcela.valor_original || parcela.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        {parcela.valor_pago && parcela.valor_pago > 0 && (
                          <p className="text-[10px] text-success tabular-nums">Pago: R$ {Number(parcela.valor_pago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-muted-foreground text-[10px] uppercase">Vencimento</p>
                        <p className="font-semibold text-sm">{formatDate(parcela.data_vencimento)}</p>
                        {calcularDiasAtraso(parcela.data_vencimento) > 0 && (
                          <p className="text-[10px] text-destructive">{calcularDiasAtraso(parcela.data_vencimento)}d atraso</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 pt-1.5 border-t">
                      <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => { setParcelaToEditData(parcela); setIsEditarDataDialogOpen(true); }} className="flex-1 h-9 text-xs px-2">
                          <Calendar className="h-3.5 w-3.5 mr-1" />Data
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
                        <Button variant="outline" size="sm" onClick={() => { setParcelaToDelete(parcela.id); setIsDeleteDialogOpen(true); }} className="flex-shrink-0 text-destructive hover:bg-destructive hover:text-destructive-foreground h-9 w-9 p-0">
                          <Trash2 className="h-3.5 w-3.5" />
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
                  <TableHead className="min-w-[140px]">Cliente</TableHead>
                  <TableHead>Nº</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="hidden lg:table-cell">Pagamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parcelasPaginadas.length === 0 ? (
                  <TableRow><TableCell colSpan={7}><EmptyState icon={Calculator} title="Nenhuma parcela encontrada" description="Ajuste os filtros ou busca para ver resultados." /></TableCell></TableRow>
                ) : (
                  parcelasPaginadas.map((parcela) => (
                    <TableRow key={parcela.id}>
                      <TableCell className="font-medium">{parcela.contratos?.clientes?.nome}</TableCell>
                      <TableCell className="text-sm tabular-nums">{parcela.numero_parcela}</TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-col">
                          <span className="tabular-nums">R$ {Number(parcela.valor_original || parcela.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          {parcela.valor_pago && parcela.valor_pago > 0 && (
                            <span className="text-xs text-muted-foreground tabular-nums">Pago: R$ {Number(parcela.valor_pago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(parcela.data_vencimento)}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">{parcela.data_pagamento ? formatDate(parcela.data_pagamento) : "—"}</TableCell>
                      <TableCell>{getStatusBadge(parcela)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="outline" size="sm" onClick={() => { setParcelaToEditData(parcela); setIsEditarDataDialogOpen(true); }} title="Editar data" className="h-8 w-8 p-0">
                            <Calendar className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => loadHistorico(parcela)} title="Histórico" className="h-8 w-8 p-0">
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                          {parcela.status !== "pago" ? (
                            <Button variant="outline" size="sm" onClick={() => abrirModalPagamento(parcela)} className="h-8 w-8 p-0 text-success hover:bg-success hover:text-success-foreground" title="Baixar">
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => handleMarcarPendente(parcela.id)} className="h-8 w-8 p-0 text-warning hover:bg-warning hover:text-warning-foreground" title="Desfazer">
                              <Undo2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => { setParcelaToDelete(parcela.id); setIsDeleteDialogOpen(true); }} className="h-8 w-8 p-0 text-destructive hover:bg-destructive hover:text-destructive-foreground" title="Excluir">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {showPagination && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPrevPage={goToPrevPage}
              onNextPage={goToNextPage}
            />
          )}
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
            <AlertDialogTitle>Excluir parcela?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. A parcela será removida permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="w-full sm:w-auto bg-destructive hover:bg-destructive/90">Excluir parcela</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AccessRestrictedModal open={isAccessModalOpen} onOpenChange={setIsAccessModalOpen} userEmail={userEmail} />
    </div>
  );
}
