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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, Users } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { AccessRestrictedModal } from "@/components/AccessRestrictedModal";

// Input validation schema
const clienteSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório').max(100, 'Nome deve ter no máximo 100 caracteres'),
  telefone: z.string().max(20, 'Telefone deve ter no máximo 20 caracteres').optional().or(z.literal('')),
  endereco: z.string().max(200, 'Endereço deve ter no máximo 200 caracteres').optional().or(z.literal('')),
  observacoes: z.string().max(500, 'Observações devem ter no máximo 500 caracteres').optional().or(z.literal(''))
});

type ValidatedCliente = z.infer<typeof clienteSchema>;

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
    nome: "",
    telefone: "",
    endereco: "",
    observacoes: ""
  });

  // Função para remover acentos (busca normalizada)
  const removerAcentos = (texto: string): string => {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  useEffect(() => {
    loadClientes();
  }, []);

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
        description: "Verifique sua conexão com a internet e tente novamente.",
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
    currentPage,
    totalPages,
    showPagination,
    goToNextPage,
    goToPrevPage,
  } = usePagination(filteredClientes);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate input
    const validationResult = clienteSchema.safeParse(formData);
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      toast({
        title: "Dados inválidos",
        description: firstError.message,
        variant: "destructive",
      });
      return;
    }

    const validatedData = validationResult.data;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar autenticado para realizar esta ação.",
          variant: "destructive",
        });
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

        toast({
          title: "Cliente atualizado",
          description: "Cliente atualizado com sucesso.",
        });
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

        toast({
          title: "Cliente adicionado",
          description: "Novo cliente cadastrado com sucesso.",
        });
      }

      setFormData({ nome: "", telefone: "", endereco: "", observacoes: "" });
      setEditingCliente(null);
      setIsDialogOpen(false);
      loadClientes();
    } catch (error: any) {
      toast({
        title: "Não foi possível salvar o cliente",
        description: "Verifique se todos os campos foram preenchidos corretamente e tente novamente.",
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
      const { error } = await supabase
        .from("clientes")
        .delete()
        .eq("id", clienteToDelete);

      if (error) throw error;

      toast({
        title: "Cliente excluído",
        description: "Cliente removido com sucesso.",
      });
      
      setIsDeleteDialogOpen(false);
      setClienteToDelete(null);
      loadClientes();
    } catch (error: any) {
      toast({
        title: "Não foi possível excluir o cliente",
        description: "Este cliente pode ter contratos associados. Exclua os contratos primeiro ou verifique sua conexão.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Gestão de Clientes</h1>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingCliente(null);
            setFormData({ nome: "", telefone: "", endereco: "", observacoes: "" });
          }
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full md:w-auto" onClick={(e) => {
              if (!canCreate && !editingCliente) {
                e.preventDefault();
                setIsAccessModalOpen(true);
              }
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCliente ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="endereco">Endereço</Label>
                <Input
                  id="endereco"
                  value={formData.endereco}
                  onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto">
                  Cancelar
                </Button>
                <Button type="submit" className="w-full sm:w-auto">
                  {editingCliente ? "Salvar" : "Cadastrar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Busca */}
      <Card>
        <CardContent className="pt-4 md:pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-base md:text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista de Clientes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">Clientes Cadastrados ({filteredClientes.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px] pl-4 md:pl-3">Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Telefone</TableHead>
                  <TableHead className="text-right pr-4 md:pr-3">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="p-0">
                      <TableSkeleton rows={5} />
                    </TableCell>
                  </TableRow>
                ) : filteredClientes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      {searchTerm ? "Nenhum cliente encontrado para esta busca" : "Nenhum cliente cadastrado ainda"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClientes.map((cliente) => (
                    <TableRow key={cliente.id}>
                      <TableCell className="font-medium pl-4 md:pl-3">
                        {cliente.nome}
                        <div className="md:hidden text-xs text-muted-foreground mt-1">
                          {cliente.telefone || "Sem telefone"}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{cliente.telefone || "-"}</TableCell>
                      <TableCell className="text-right pr-4 md:pr-3">
                        <div className="flex gap-1 md:gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(cliente)}
                          >
                            <Pencil className="h-3 w-3 md:h-4 md:w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setClienteToDelete(cliente.id);
                              setIsDeleteDialogOpen(true);
                            }}
                            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          >
                            <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
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

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="w-[95vw] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Acesso Restrito */}
      <AccessRestrictedModal
        open={isAccessModalOpen}
        onOpenChange={setIsAccessModalOpen}
        userEmail={userEmail}
      />
    </div>
  );
}