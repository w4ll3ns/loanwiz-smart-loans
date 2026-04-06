import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getLocalDateString } from "@/lib/utils";
import { removerAcentos } from "@/lib/calculos";
import { useUserRole } from "@/hooks/useUserRole";
import { AccessRestrictedModal } from "@/components/AccessRestrictedModal";
import { ContratoForm, ContratoDetails, ImportComprovante } from "@/components/contratos";
import { TableSkeleton, CardListSkeleton } from "@/components/LoadingSkeletons";
import { PaginationControls } from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";
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
        description: "Verifique sua conexão com a internet e tente novamente.",
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
        description: "Verifique sua conexão com a internet e tente novamente.",
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

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Gestão de Contratos</h1>
        
        <div className="flex gap-2 flex-col sm:flex-row">
          <Button size="sm" variant="outline" className="w-full md:w-auto" onClick={() => {
            if (!canCreate) {
              setIsAccessModalOpen(true);
              return;
            }
            setIsImportDialogOpen(true);
          }}>
            <Upload className="h-4 w-4 mr-2" />
            Importar Comprovante
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
        </div>
      </div>

      {/* Lista de Contratos */}
      <Card>
        <CardHeader className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base md:text-lg">
              {statusFilter === "ativos" ? "Contratos Ativos" : statusFilter === "quitados" ? "Contratos Quitados" : "Todos os Contratos"} ({contratosFiltrados.length})
            </CardTitle>
            <div className="flex gap-1">
              <Button size="sm" variant={statusFilter === "ativos" ? "default" : "outline"} onClick={() => setStatusFilter("ativos")} className="text-xs">Ativos</Button>
              <Button size="sm" variant={statusFilter === "quitados" ? "default" : "outline"} onClick={() => setStatusFilter("quitados")} className="text-xs">Quitados</Button>
              <Button size="sm" variant={statusFilter === "todos" ? "default" : "outline"} onClick={() => setStatusFilter("todos")} className="text-xs">Todos</Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-base md:text-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 md:p-6">
          {loading ? (
            <>
              <div className="md:hidden">
                <CardListSkeleton count={4} />
              </div>
              <div className="hidden md:block">
                <TableSkeleton rows={5} />
              </div>
            </>
          ) : (
            <>
              {/* Mobile - Cards */}
              <div className="md:hidden space-y-2 p-3">
                {contratosPaginados.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {searchTerm ? "Nenhum contrato encontrado para esta busca" : "Nenhum contrato encontrado"}
                  </p>
                ) : (
                  contratosPaginados.map((contrato) => (
                    <Card
                      key={contrato.id}
                      className="cursor-pointer hover:bg-muted/50 p-3"
                      onClick={() => handleContratoClick(contrato)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{contrato.clientes?.nome}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {contrato.periodicidade} • {Number(contrato.percentual)}% • {contrato.numero_parcelas}x
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold">R$ {Number(contrato.valor_total).toLocaleString('pt-BR')}</p>
                          <Badge variant={contrato.status === "ativo" ? "default" : contrato.status === "quitado" ? "outline" : "secondary"} className="text-[10px] mt-0.5">
                            {contrato.status === "ativo" ? "Ativo" : contrato.status === "quitado" ? "Quitado" : contrato.status}
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>

              {/* Desktop - Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px] pl-3">Cliente</TableHead>
                      <TableHead>Valor Emprestado</TableHead>
                      <TableHead className="hidden lg:table-cell">Percentual</TableHead>
                      <TableHead>Periodicidade</TableHead>
                      <TableHead>Valor Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contratosPaginados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          {searchTerm ? "Nenhum contrato encontrado para esta busca" : "Nenhum contrato encontrado"}
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
                          <TableCell className="text-sm">R$ {Number(contrato.valor_emprestado).toLocaleString('pt-BR')}</TableCell>
                          <TableCell className="hidden lg:table-cell text-sm">{Number(contrato.percentual)}%</TableCell>
                          <TableCell className="text-sm capitalize">{contrato.periodicidade}</TableCell>
                          <TableCell className="text-sm">R$ {Number(contrato.valor_total).toLocaleString('pt-BR')}</TableCell>
                          <TableCell>
                            <Badge variant={contrato.status === "ativo" ? "default" : contrato.status === "quitado" ? "outline" : "secondary"} className="text-xs">
                              {contrato.status === "ativo" ? "Ativo" : contrato.status === "quitado" ? "Quitado" : contrato.status}
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

      <AccessRestrictedModal
        open={isAccessModalOpen}
        onOpenChange={setIsAccessModalOpen}
        userEmail={userEmail}
      />
    </div>
  );
}
