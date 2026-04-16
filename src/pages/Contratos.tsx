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
    return {
      ativos: ativos.length,
      quitados: quitados.length,
      total: contratos.length,
      valorEmAberto,
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
        description="Gerencie empréstimos e acompanhe pagamentos"
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
        <div className="grid gap-2 md:gap-3 grid-cols-3">
          <div
            className={`metric-card ${statusFilter === "ativos" ? "ring-2 ring-primary shadow-md" : ""}`}
            onClick={() => setStatusFilter("ativos")}
          >
            <div className="flex items-center gap-2.5">
              <div className="metric-card-icon bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="metric-card-value">{summaryStats.ativos}</p>
                <p className="metric-card-label">Ativos</p>
              </div>
            </div>
          </div>
          <div
            className={`metric-card ${statusFilter === "quitados" ? "ring-2 ring-success shadow-md" : ""}`}
            onClick={() => setStatusFilter("quitados")}
          >
            <div className="flex items-center gap-2.5">
              <div className="metric-card-icon bg-success/10">
                <CheckCircle2 className="h-4 w-4 text-success" />
              </div>
              <div className="min-w-0">
                <p className="metric-card-value">{summaryStats.quitados}</p>
                <p className="metric-card-label">Quitados</p>
              </div>
            </div>
          </div>
          <div
            className={`metric-card ${statusFilter === "todos" ? "ring-2 ring-ring shadow-md" : ""}`}
            onClick={() => setStatusFilter("todos")}
          >
            <div className="flex items-center gap-2.5">
              <div className="metric-card-icon bg-warning/10">
                <DollarSign className="h-4 w-4 text-warning" />
              </div>
              <div className="min-w-0">
                <p className="metric-card-value text-base md:text-lg">
                  R$ {summaryStats.valorEmAberto.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
                <p className="metric-card-label">Em aberto</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search + Filters + List */}
      <Card>
        <CardHeader className="pb-3 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="text-sm md:text-base font-semibold">
              {statusFilter === "ativos" ? "Contratos Ativos" : statusFilter === "quitados" ? "Contratos Quitados" : "Todos os Contratos"}
              <span className="ml-1.5 text-muted-foreground font-normal">({contratosFiltrados.length})</span>
            </CardTitle>
            <div className="flex gap-1.5 items-center">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
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
              <div className="filter-toggle-group">
                {(["ativos", "quitados", "todos"] as const).map(f => (
                  <Button
                    key={f}
                    size="sm"
                    variant="ghost"
                    onClick={() => setStatusFilter(f)}
                    className={`filter-toggle-item ${statusFilter === f ? "filter-toggle-item-active" : ""}`}
                  >
                    {f === "ativos" ? "Ativos" : f === "quitados" ? "Quitados" : "Todos"}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-base md:text-sm"
            />
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
        onRenovar={handleRenovarContrato}
      />

      <ImportComprovante
        isOpen={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onImportComplete={handleImportComplete}
      />

      <AccessRestrictedModal open={isAccessModalOpen} onOpenChange={setIsAccessModalOpen} userEmail={userEmail} />
    </div>
  );
}
