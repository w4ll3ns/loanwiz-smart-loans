import { useState, useEffect } from "react";
import { z } from "zod";
import { TableSkeleton } from "@/components/LoadingSkeletons";
import { PaginationControls } from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogBody, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, Users, Download, Phone } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { AccessRestrictedModal } from "@/components/AccessRestrictedModal";
import { exportarCsv } from "@/lib/exportCsv";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

const clienteSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório').max(100, 'Nome deve ter no máximo 100 caracteres'),
  telefone: z.string().max(20, 'Telefone deve ter no máximo 20 caracteres').optional().or(z.literal('')),
  endereco: z.string().max(200, 'Endereço deve ter no máximo 200 caracteres').optional().or(z.literal('')),
  observacoes: z.string().max(500, 'Observações devem ter no máximo 500 caracteres').optional().or(z.literal(''))
});

interface Cliente {
  id: string;
  nome: string;
  telefone?: string;
  endereco?: string;
  observacoes?: string;
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState<string | null>(null);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const { toast } = useToast();
  const { canCreate, userEmail } = useUserRole();

  const [formData, setFormData] = useState({
    nome: "", telefone: "", endereco: "", observacoes: ""
  });

  const removerAcentos = (texto: string): string => {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  useEffect(() => { loadClientes(); }, []);

  const loadClientes = async () => {
    try {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setClientes(data || []);
    } catch (error: any) {
      toast({
        title: "Não foi possível carregar os clientes",
        description: "Verifique sua conexão e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredClientes = clientes.filter(cliente => {
    const searchNormalized = removerAcentos(searchTerm.toLowerCase());
    const nomeNormalized = removerAcentos(cliente.nome.toLowerCase());
    const telefoneNormalized = removerAcentos((cliente.telefone || '').toLowerCase());
    return nomeNormalized.includes(searchNormalized) || telefoneNormalized.includes(searchNormalized);
  });

  const {
    paginatedItems: clientesPaginados,
    currentPage, totalPages, showPagination, goToNextPage, goToPrevPage,
  } = usePagination(filteredClientes);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationResult = clienteSchema.safeParse(formData);
    if (!validationResult.success) {
      toast({
        title: "Dados inválidos",
        description: validationResult.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    const validatedData = validationResult.data;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Erro de autenticação", description: "Você precisa estar autenticado.", variant: "destructive" });
        return;
      }

      if (editingCliente) {
        const { error } = await supabase
          .from("clientes")
          .update({
            nome: validatedData.nome,
            telefone: validatedData.telefone || null,
            endereco: validatedData.endereco || null,
            observacoes: validatedData.observacoes || null
          })
          .eq("id", editingCliente.id);
        if (error) throw error;
        toast({ title: "Cliente atualizado", description: "Dados salvos com sucesso." });
      } else {
        const { error } = await supabase
          .from("clientes")
          .insert([{ 
            nome: validatedData.nome, 
            telefone: validatedData.telefone || null,
            endereco: validatedData.endereco || null,
            observacoes: validatedData.observacoes || null,
            user_id: user.id 
          }]);
        if (error) throw error;
        toast({ title: "Cliente cadastrado", description: `${validatedData.nome} foi adicionado com sucesso.` });
      }

      setFormData({ nome: "", telefone: "", endereco: "", observacoes: "" });
      setEditingCliente(null);
      setIsDialogOpen(false);
      loadClientes();
    } catch (error: any) {
      toast({
        title: "Não foi possível salvar o cliente",
        description: "Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormData({
      nome: cliente.nome,
      telefone: cliente.telefone || "",
      endereco: cliente.endereco || "",
      observacoes: cliente.observacoes || ""
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!clienteToDelete) return;
    try {
      const { error } = await supabase.from("clientes").delete().eq("id", clienteToDelete);
      if (error) throw error;
      toast({ title: "Cliente excluído", description: "Registro removido com sucesso." });
      setIsDeleteDialogOpen(false);
      setClienteToDelete(null);
      loadClientes();
    } catch (error: any) {
      toast({
        title: "Não foi possível excluir",
        description: "Este cliente pode ter contratos associados. Exclua os contratos primeiro.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        title="Clientes"
        description="Gerencie sua carteira e acompanhe cadastros"
      >
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingCliente(null);
            setFormData({ nome: "", telefone: "", endereco: "", observacoes: "" });
          }
        }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={(e) => {
              if (!canCreate && !editingCliente) {
                e.preventDefault();
                setIsAccessModalOpen(true);
              }
            }}>
              <Plus className="h-4 w-4 mr-1.5" />
              Novo cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] sm:max-w-lg flex flex-col">
            <DialogHeader>
              <DialogTitle>{editingCliente ? "Editar cliente" : "Cadastrar cliente"}</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <form id="cliente-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="nome" className="text-xs">Nome *</Label>
                  <Input id="nome" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} required placeholder="Nome completo" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="telefone" className="text-xs">Telefone</Label>
                  <Input id="telefone" value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} placeholder="(00) 00000-0000" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="endereco" className="text-xs">Endereço</Label>
                  <Input id="endereco" value={formData.endereco} onChange={(e) => setFormData({ ...formData, endereco: e.target.value })} placeholder="Endereço completo" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="observacoes" className="text-xs">Observações</Label>
                  <Textarea id="observacoes" value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows={2} placeholder="Anotações sobre o cliente" />
                </div>
              </form>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
              <Button type="submit" form="cliente-form" className="w-full sm:w-auto">{editingCliente ? "Salvar alterações" : "Cadastrar cliente"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou telefone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 h-9 text-base md:text-sm"
        />
      </div>

      {/* Client list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm md:text-base font-semibold">
            {filteredClientes.length} cliente{filteredClientes.length !== 1 ? 's' : ''}
            {searchTerm && <span className="font-normal text-muted-foreground ml-1">para "{searchTerm}"</span>}
          </CardTitle>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
            exportarCsv("clientes.csv",
              ["Nome", "Telefone", "Endereço", "Observações"],
              filteredClientes.map(c => [c.nome, c.telefone || "", c.endereco || "", c.observacoes || ""])
            );
          }}>
            <Download className="h-3 w-3 mr-1" />
            CSV
          </Button>
        </CardHeader>
        <CardContent className="p-0 md:p-6 md:pt-0">
          {loading ? (
            <TableSkeleton rows={5} />
          ) : filteredClientes.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Users}
                title={searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
                description={searchTerm ? `Nenhum resultado para "${searchTerm}". Tente outro termo.` : "Cadastre seu primeiro cliente para começar a criar contratos."}
                actionLabel={!searchTerm ? "Cadastrar cliente" : undefined}
                onAction={!searchTerm ? () => setIsDialogOpen(true) : undefined}
              />
            </div>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="md:hidden space-y-2 p-3">
                {clientesPaginados.map((cliente) => (
                  <Card key={cliente.id} className="hover:bg-muted/30 transition-all">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{cliente.nome}</p>
                          {cliente.telefone && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Phone className="h-3 w-3" />
                              {cliente.telefone}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(cliente)} className="h-8 w-8 p-0">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline" size="sm"
                            onClick={() => { setClienteToDelete(cliente.id); setIsDeleteDialogOpen(true); }}
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px] pl-4 md:pl-3">Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="text-right pr-4 md:pr-3">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientesPaginados.map((cliente) => (
                      <TableRow key={cliente.id}>
                        <TableCell className="font-medium pl-4 md:pl-3">{cliente.nome}</TableCell>
                        <TableCell className="text-sm">{cliente.telefone || "—"}</TableCell>
                        <TableCell className="text-right pr-4 md:pr-3">
                          <div className="flex gap-1 justify-end">
                            <Button variant="outline" size="sm" onClick={() => handleEdit(cliente)} className="h-8 w-8 p-0">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline" size="sm"
                              onClick={() => { setClienteToDelete(cliente.id); setIsDeleteDialogOpen(true); }}
                              className="h-8 w-8 p-0 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {showPagination && (
                <PaginationControls currentPage={currentPage} totalPages={totalPages} onPrevPage={goToPrevPage} onNextPage={goToNextPage} />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="w-[95vw] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Se houver contratos associados, a exclusão será bloqueada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir cliente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AccessRestrictedModal open={isAccessModalOpen} onOpenChange={setIsAccessModalOpen} userEmail={userEmail} />
    </div>
  );
}
