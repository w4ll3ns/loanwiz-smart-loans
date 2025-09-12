import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Calculator, FileText, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Contrato {
  id: string;
  clienteId: string;
  clienteNome: string;
  valorEmprestado: number;
  percentual: number;
  periodicidade: "diario" | "semanal" | "quinzenal" | "mensal";
  numeroParcelas: number;
  dataEmprestimo: string;
  valorTotal: number;
  valorParcela: number;
  status: "ativo" | "quitado" | "vencido";
}

const mockContratos: Contrato[] = [
  {
    id: "1",
    clienteId: "1",
    clienteNome: "João Silva",
    valorEmprestado: 5000,
    percentual: 20,
    periodicidade: "mensal",
    numeroParcelas: 12,
    dataEmprestimo: "2024-01-01",
    valorTotal: 6000,
    valorParcela: 500,
    status: "ativo"
  },
  {
    id: "2",
    clienteId: "2", 
    clienteNome: "Maria Santos",
    valorEmprestado: 3000,
    percentual: 15,
    periodicidade: "quinzenal",
    numeroParcelas: 8,
    dataEmprestimo: "2024-01-15",
    valorTotal: 3450,
    valorParcela: 431.25,
    status: "ativo"
  }
];

const mockClientes = [
  { id: "1", nome: "João Silva" },
  { id: "2", nome: "Maria Santos" },
  { id: "3", nome: "Pedro Costa" }
];

export default function Contratos() {
  const [contratos, setContratos] = useState<Contrato[]>(mockContratos);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    clienteId: "",
    valorEmprestado: "",
    percentual: "",
    periodicidade: "" as "diario" | "semanal" | "quinzenal" | "mensal" | "",
    numeroParcelas: "",
    dataEmprestimo: ""
  });

  const calcularContrato = () => {
    const valor = parseFloat(formData.valorEmprestado);
    const percent = parseFloat(formData.percentual);
    const parcelas = parseInt(formData.numeroParcelas);
    
    if (!valor || !percent || !parcelas) return null;

    const valorTotal = valor + (valor * percent / 100);
    const valorParcela = valorTotal / parcelas;

    return {
      valorTotal,
      valorParcela,
      lucro: valorTotal - valor
    };
  };

  const gerarParcelas = (dataInicio: string, periodicidade: string, numeroParcelas: number) => {
    const parcelas = [];
    const dataBase = new Date(dataInicio);
    
    for (let i = 1; i <= numeroParcelas; i++) {
      const dataParcela = new Date(dataBase);
      
      switch (periodicidade) {
        case "diario":
          dataParcela.setDate(dataBase.getDate() + i);
          break;
        case "semanal":
          dataParcela.setDate(dataBase.getDate() + (i * 7));
          break;
        case "quinzenal":
          dataParcela.setDate(dataBase.getDate() + (i * 15));
          break;
        case "mensal":
          dataParcela.setMonth(dataBase.getMonth() + i);
          break;
      }
      
      parcelas.push({
        numero: i,
        data: dataParcela.toISOString().split('T')[0],
        valor: calcularContrato()?.valorParcela || 0
      });
    }
    
    return parcelas;
  };

  const handlePreview = () => {
    const calculo = calcularContrato();
    if (!calculo) return;

    const cliente = mockClientes.find(c => c.id === formData.clienteId);
    const parcelas = gerarParcelas(formData.dataEmprestimo, formData.periodicidade, parseInt(formData.numeroParcelas));

    setPreviewData({
      cliente: cliente?.nome,
      ...formData,
      ...calculo,
      parcelas
    });
    setIsPreviewOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const calculo = calcularContrato();
    if (!calculo) {
      toast({
        title: "Erro",
        description: "Verifique os dados do contrato.",
        variant: "destructive"
      });
      return;
    }

    const cliente = mockClientes.find(c => c.id === formData.clienteId);
    
    const novoContrato: Contrato = {
      id: Date.now().toString(),
      clienteId: formData.clienteId,
      clienteNome: cliente?.nome || "",
      valorEmprestado: parseFloat(formData.valorEmprestado),
      percentual: parseFloat(formData.percentual),
      periodicidade: formData.periodicidade as any,
      numeroParcelas: parseInt(formData.numeroParcelas),
      dataEmprestimo: formData.dataEmprestimo,
      valorTotal: calculo.valorTotal,
      valorParcela: calculo.valorParcela,
      status: "ativo"
    };

    setContratos([...contratos, novoContrato]);
    
    setFormData({
      clienteId: "",
      valorEmprestado: "",
      percentual: "",
      periodicidade: "",
      numeroParcelas: "",
      dataEmprestimo: ""
    });
    
    setIsDialogOpen(false);
    
    toast({
      title: "Contrato criado",
      description: "Novo contrato adicionado com sucesso.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Gestão de Contratos</h1>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Contrato
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Novo Contrato de Empréstimo</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cliente">Cliente</Label>
                  <Select value={formData.clienteId} onValueChange={(value) => setFormData({ ...formData, clienteId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockClientes.map((cliente) => (
                        <SelectItem key={cliente.id} value={cliente.id}>
                          {cliente.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="dataEmprestimo">Data do Empréstimo</Label>
                  <Input
                    id="dataEmprestimo"
                    type="date"
                    value={formData.dataEmprestimo}
                    onChange={(e) => setFormData({ ...formData, dataEmprestimo: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="valor">Valor Emprestado (R$)</Label>
                  <Input
                    id="valor"
                    type="number"
                    step="0.01"
                    value={formData.valorEmprestado}
                    onChange={(e) => setFormData({ ...formData, valorEmprestado: e.target.value })}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="percentual">Percentual (%)</Label>
                  <Input
                    id="percentual"
                    type="number"
                    step="0.1"
                    value={formData.percentual}
                    onChange={(e) => setFormData({ ...formData, percentual: e.target.value })}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="parcelas">Número de Parcelas</Label>
                  <Input
                    id="parcelas"
                    type="number"
                    value={formData.numeroParcelas}
                    onChange={(e) => setFormData({ ...formData, numeroParcelas: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="periodicidade">Periodicidade</Label>
                <Select value={formData.periodicidade} onValueChange={(value: any) => setFormData({ ...formData, periodicidade: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a periodicidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diario">Diário</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="quinzenal">Quinzenal</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {calcularContrato() && (
                <Card className="bg-muted">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Valor Total</p>
                        <p className="font-semibold">R$ {calcularContrato()?.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Valor da Parcela</p>
                        <p className="font-semibold">R$ {calcularContrato()?.valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Lucro</p>
                        <p className="font-semibold text-success">R$ {calcularContrato()?.lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handlePreview} disabled={!calcularContrato()}>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                <Button type="submit" className="flex-1">
                  <FileText className="h-4 w-4 mr-2" />
                  Criar Contrato
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview do Contrato</DialogTitle>
          </DialogHeader>
          {previewData && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Dados do Contrato</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <p><strong>Cliente:</strong> {previewData.cliente}</p>
                    <p><strong>Data:</strong> {new Date(previewData.dataEmprestimo).toLocaleDateString('pt-BR')}</p>
                    <p><strong>Periodicidade:</strong> {previewData.periodicidade}</p>
                  </div>
                  <div>
                    <p><strong>Valor Emprestado:</strong> R$ {parseFloat(previewData.valorEmprestado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p><strong>Percentual:</strong> {previewData.percentual}%</p>
                    <p><strong>Valor Total:</strong> R$ {previewData.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cronograma de Parcelas</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Parcela</TableHead>
                        <TableHead>Data de Vencimento</TableHead>
                        <TableHead>Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.parcelas.map((parcela: any) => (
                        <TableRow key={parcela.numero}>
                          <TableCell>{parcela.numero}</TableCell>
                          <TableCell>{new Date(parcela.data).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell>R$ {parcela.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Lista de Contratos */}
      <Card>
        <CardHeader>
          <CardTitle>Contratos Ativos ({contratos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Valor Emprestado</TableHead>
                <TableHead>Percentual</TableHead>
                <TableHead>Periodicidade</TableHead>
                <TableHead>Valor Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contratos.map((contrato) => (
                <TableRow key={contrato.id}>
                  <TableCell className="font-medium">{contrato.clienteNome}</TableCell>
                  <TableCell>R$ {contrato.valorEmprestado.toLocaleString('pt-BR')}</TableCell>
                  <TableCell>{contrato.percentual}%</TableCell>
                  <TableCell className="capitalize">{contrato.periodicidade}</TableCell>
                  <TableCell>R$ {contrato.valorTotal.toLocaleString('pt-BR')}</TableCell>
                  <TableCell>
                    <Badge variant={contrato.status === "ativo" ? "default" : "secondary"}>
                      {contrato.status === "ativo" ? "Ativo" : contrato.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(contrato.dataEmprestimo).toLocaleDateString('pt-BR')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}