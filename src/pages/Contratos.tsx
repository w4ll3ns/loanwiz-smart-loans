import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Upload, Search, Download, FileText, DollarSign, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getLocalDateString } from "@/lib/utils";
import { removerAcentos, calcularDiasAtraso } from "@/lib/calculos";
import { exportarCsv } from "@/lib/exportCsv";
import { useUserRole } from "@/hooks/useUserRole";
import { AccessRestrictedModal } from "@/components/AccessRestrictedModal";
import { ContratoForm, ContratoDetails, ImportComprovante } from "@/components/contratos";
import { TableSkeleton, CardListSkeleton } from "@/components/LoadingSkeletons";
import { PaginationControls } from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import type { Contrato, Parcela } from "@/components/contratos";
import type { ContratoFormData } from "@/components/contratos";

interface Cliente {
  id: string;
  nome: string;
}

export default function Contratos() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isContratoDetailsOpen, setIsContratoDetailsOpen] = useState(false);
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedContrato, setSelectedContrato] = useState<Contrato | null>(null);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ativos" | "quitados" | "todos">("ativos");
  const [searchTerm, setSearchTerm] = useState("");
  const [initialFormData, setInitialFormData] = useState<Partial<ContratoFormData> | undefined>(undefined);
  const { toast } = useToast();
  const { canCreate, userEmail } = useUserRole();

  const contratosFiltrados = contratos.filter((c) => {
    const matchesStatus = statusFilter === "todos" || (statusFilter === "ativos" ? c.status === "ativo" : c.status === "quitado");
    const matchesSearch = searchTerm
      ? removerAcentos((c.clientes?.nome || "").toLowerCase()).includes(removerAcentos(searchTerm.toLowerCase()))
      : true;
    return matchesStatus && matchesSearch;
  });

  const summaryStats = useMemo(() => {
    const ativos = contratos.filter(c => c.status === "ativo");
    const quitados = contratos.filter(c => c.status === "quitado");
    const valorEmAberto = ativos.reduce((acc, c) => acc + Number(c.valor_total), 0);
    const totalEmprestado = ativos.reduce((acc, c) => acc + Number(c.valor_emprestado), 0);
    return {
      ativos: ativos.length,
      quitados: quitados.length,
      total: contratos.length,
      valorEmAberto,
      totalEmprestado,
    };
  }, [contratos]);

  const {
    paginatedItems: contratosPaginados,
    currentPage,
    totalPages,
    showPagination,
    goToNextPage,
    goToPrevPage,
  } = usePagination(contratosFiltrados);

  useEffect(() => {
    loadContratos();
    loadClientes();
  }, []);

  const loadContratos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("contratos")
        .select(`*, clientes(nome)`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContratos((data || []) as Contrato[]);
    } catch (error: any) {
      toast({
        title: "Não foi possível carregar os contratos",
        description: "Verifique sua conexão e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadClientes = async () => {
    try {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome")
        .order("nome");

      if (error) throw error;
      setClientes(data || []);
    } catch (error: any) {
      toast({
        title: "Não foi possível carregar os clientes",
        description: "Verifique sua conexão e tente novamente.",
        variant: "destructive",
      });
    }
  };

  const loadParcelas = async (contratoId: string) => {
    try {
      const { data, error } = await supabase
        .from("parcelas")
        .select("*")
        .eq("contrato_id", contratoId)
        .order("numero_parcela");

      if (error) throw error;
      setParcelas(data || []);
    } catch (error: any) {
      toast({
        title: "Não foi possível carregar as parcelas",
        variant: "destructive",
      });
    }
  };

  const handleContratoClick = async (contrato: Contrato) => {
    setSelectedContrato(contrato);
    await loadParcelas(contrato.id);
    const { data: contratoAtualizado } = await supabase
      .from("contratos")
      .select(`*, clientes(nome)`)
      .eq("id", contrato.id)
      .single();
    
    if (contratoAtualizado) {
      setSelectedContrato(contratoAtualizado as Contrato);
    }
    setIsContratoDetailsOpen(true);
  };

  const handleRenovarContrato = (contrato: Contrato) => {
    setInitialFormData({
      clienteId: contrato.cliente_id,
      valorEmprestado: contrato.valor_emprestado.toString(),
      percentual: contrato.percentual.toString(),
      periodicidade: contrato.periodicidade,
      numeroParcelas: contrato.numero_parcelas.toString(),
      dataEmprestimo: getLocalDateString(),
      tipoJuros: contrato.tipo_juros || "simples",
      permiteCobrancaSabado: contrato.permite_cobranca_sabado ?? true,
      permiteCobrancaDomingo: contrato.permite_cobranca_domingo ?? false
    });
    setIsContratoDetailsOpen(false);
    setIsDialogOpen(true);
    toast({
      title: "Renovação de contrato",
      description: `Formulário preenchido com dados do contrato de ${contrato.clientes?.nome}. Revise e confirme.`,
    });
  };

  const handleImportComplete = (formData: Partial<ContratoFormData>) => {
    setInitialFormData(formData);
    setIsDialogOpen(true);
  };

  const handleContratoUpdated = async () => {
    await loadContratos();
    if (selectedContrato) {
      const { data } = await supabase
        .from("contratos")
        .select(`*, clientes(nome)`)
        .eq("id", selectedContrato.id)
        .single();
      if (data) setSelectedContrato(data as Contrato);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ativo": return "hsl(var(--primary))";
      case "quitado": return "hsl(var(--success))";
      default: return "hsl(var(--muted-foreground))";
    }
  };

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        title="Contratos"
        description="Gerencie todos os empréstimos em um só lugar"
      >
        <Button size="sm" variant="outline" onClick={() => {
          if (!canCreate) {
            setIsAccessModalOpen(true);
            return;
          }
          setIsImportDialogOpen(true);
        }}>
          <Upload className="h-4 w-4 mr-1.5" />
          Importar
        </Button>

        <ContratoForm
          clientes={clientes}
          isOpen={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setInitialFormData(undefined);
          }}
          onContratoCreated={loadContratos}
          canCreate={canCreate}
          onAccessRestricted={() => setIsAccessModalOpen(true)}
          initialData={initialFormData}
        />
      </PageHeader>

      {/* Summary metrics */}
      {!loading && contratos.length > 0 && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {/* Ativos */}
          <button
            onClick={() => setStatusFilter("ativos")}
            className={`relative rounded-xl border bg-card p-3 md:p-4 text-left transition-all hover:shadow-md ${statusFilter === "ativos" ? "ring-2 ring-primary border-primary/30 shadow-md" : "hover:border-primary/20"}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Ativos</span>
            </div>
            <p className="text-2xl md:text-3xl font-bold tabular-nums text-primary">{summaryStats.ativos}</p>
          </button>

          {/* Quitados */}
          <button
            onClick={() => setStatusFilter("quitados")}
            className={`relative rounded-xl border bg-card p-3 md:p-4 text-left transition-all hover:shadow-md ${statusFilter === "quitados" ? "ring-2 ring-success border-success/30 shadow-md" : "hover:border-success/20"}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/10">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Quitados</span>
            </div>
            <p className="text-2xl md:text-3xl font-bold tabular-nums text-success">{summaryStats.quitados}</p>
          </button>

          {/* Capital Emprestado */}
          <button
            onClick={() => setStatusFilter("todos")}
            className={`relative rounded-xl border bg-card p-3 md:p-4 text-left transition-all hover:shadow-md ${statusFilter === "todos" ? "ring-2 ring-ring shadow-md" : ""}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
                <DollarSign className="h-3.5 w-3.5 text-foreground" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Capital Emprestado</span>
            </div>
            <p className="text-lg md:text-xl font-bold tabular-nums">
              R$ {summaryStats.totalEmprestado.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">em contratos ativos</p>
          </button>

          {/* Total a Receber */}
          <div className="relative rounded-xl border bg-card p-3 md:p-4 text-left border-l-4 border-l-warning">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning/10">
                <Clock className="h-3.5 w-3.5 text-warning" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Total a Receber</span>
            </div>
            <p className="text-lg md:text-xl font-bold tabular-nums text-warning">
              R$ {summaryStats.valorEmAberto.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">valor total dos ativos</p>
          </div>
        </div>
      )}

      {/* Search + Filters + List */}
      <Card>
        <CardHeader className="pb-3 space-y-3">
          <div className="flex flex-col gap-3">
            {/* Search bar — full width, prominent */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome do cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 text-base md:text-sm bg-muted/40 border-transparent focus:bg-background focus:border-input transition-colors"
              />
            </div>
            {/* Title + filters */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  {statusFilter === "ativos" ? "Contratos Ativos" : statusFilter === "quitados" ? "Contratos Quitados" : "Todos os Contratos"}
                  <span className="ml-1.5 text-muted-foreground font-normal text-xs">({contratosFiltrados.length})</span>
                </h3>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground flex-shrink-0" onClick={() => {
                  exportarCsv("contratos.csv",
                    ["Cliente", "Valor Emprestado", "Valor Total", "Parcelas", "Status", "Data Empréstimo"],
                    contratosFiltrados.map(c => [
                      c.clientes?.nome || "",
                      Number(c.valor_emprestado).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
                      Number(c.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
                      c.numero_parcelas,
                      c.status,
                      c.data_emprestimo,
                    ])
                  );
                }}>
                  <Download className="h-3 w-3 mr-1" />
                  CSV
                </Button>
              </div>
              <div className="overflow-x-auto -mx-1 px-1">
                <div className="filter-toggle-group w-full">
                  {(["ativos", "quitados", "todos"] as const).map(f => (
                    <Button
                      key={f}
                      size="sm"
                      variant="ghost"
                      onClick={() => setStatusFilter(f)}
                      className={`filter-toggle-item flex-1 ${statusFilter === f ? "filter-toggle-item-active" : ""}`}
                    >
                      {f === "ativos" ? "Ativos" : f === "quitados" ? "Quitados" : "Todos"}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 md:p-6 md:pt-0">
          {loading ? (
            <>
              <div className="md:hidden"><CardListSkeleton count={4} /></div>
              <div className="hidden md:block"><TableSkeleton rows={5} /></div>
            </>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="md:hidden space-y-2 p-3">
                {contratosPaginados.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title={searchTerm ? "Nenhum contrato encontrado" : "Nenhum contrato ainda"}
                    description={searchTerm ? "Tente buscar com outro nome." : "Crie seu primeiro contrato para começar a gerenciar empréstimos."}
                  />
                ) : (
                  contratosPaginados.map((contrato) => (
                    <Card
                      key={contrato.id}
                      className="cursor-pointer hover:bg-muted/30 transition-all border-l-4 active:scale-[0.99]"
                      style={{ borderLeftColor: getStatusColor(contrato.status) }}
                      onClick={() => handleContratoClick(contrato)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{contrato.clientes?.nome}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {contrato.periodicidade} · {Number(contrato.percentual)}% · {contrato.numero_parcelas}x
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-semibold tabular-nums">
                              R$ {Number(contrato.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                            <Badge
                              variant={contrato.status === "ativo" ? "default" : "outline"}
                              className="text-[10px] mt-0.5"
                            >
                              {contrato.status === "ativo" ? "Ativo" : "Quitado"}
                            </Badge>
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
                      <TableHead className="min-w-[140px] pl-3">Cliente</TableHead>
                      <TableHead>Emprestado</TableHead>
                      <TableHead className="hidden lg:table-cell">Juros</TableHead>
                      <TableHead>Periodicidade</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contratosPaginados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <EmptyState
                            icon={FileText}
                            title={searchTerm ? "Nenhum contrato encontrado" : "Nenhum contrato ainda"}
                            description={searchTerm ? "Tente buscar com outro nome." : "Crie seu primeiro contrato para começar a gerenciar empréstimos."}
                          />
                        </TableCell>
                      </TableRow>
                    ) : (
                      contratosPaginados.map((contrato) => (
                        <TableRow 
                          key={contrato.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleContratoClick(contrato)}
                        >
                          <TableCell className="font-medium pl-3">{contrato.clientes?.nome}</TableCell>
                          <TableCell className="text-sm tabular-nums">R$ {Number(contrato.valor_emprestado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="hidden lg:table-cell text-sm">{Number(contrato.percentual)}%</TableCell>
                          <TableCell className="text-sm capitalize">{contrato.periodicidade}</TableCell>
                          <TableCell className="text-sm font-medium tabular-nums">R$ {Number(contrato.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell>
                            <Badge variant={contrato.status === "ativo" ? "default" : "outline"} className="text-xs">
                              {contrato.status === "ativo" ? "Ativo" : "Quitado"}
                            </Badge>
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
            </>
          )}
        </CardContent>
      </Card>

      <ContratoDetails
        isOpen={isContratoDetailsOpen}
        onOpenChange={setIsContratoDetailsOpen}
        contrato={selectedContrato}
        parcelas={parcelas}
        onContratoUpdated={handleContratoUpdated}
        onParcelasUpdated={loadParcelas}
        onRenovar={handleRenovarContrato}
      />

      <ImportComprovante
        isOpen={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        clientes={clientes}
        onImportComplete={handleImportComplete}
        onClientesUpdated={loadClientes}
      />

      <AccessRestrictedModal open={isAccessModalOpen} onOpenChange={setIsAccessModalOpen} userEmail={userEmail} />
    </div>
  );
}
