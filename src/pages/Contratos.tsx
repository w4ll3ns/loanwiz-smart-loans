import { useState, useEffect } from "react";
import { format } from "date-fns";
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
import { Plus, FileText, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Contrato {
  id: string;
  cliente_id: string;
  clientes?: { nome: string };
  valor_emprestado: number;
  percentual: number;
  periodicidade: "diario" | "semanal" | "quinzenal" | "mensal";
  numero_parcelas: number;
  data_emprestimo: string;
  valor_total: number;
  status: string;
}

interface Cliente {
  id: string;
  nome: string;
}

interface PreviewParcela {
  numero: number;
  data: string;
  valor: number;
}

interface Parcela {
  id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  status: string;
  data_pagamento: string | null;
  valor_pago: number | null;
}

export default function Contratos() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isContratoDetailsOpen, setIsContratoDetailsOpen] = useState(false);
  const [selectedContrato, setSelectedContrato] = useState<Contrato | null>(null);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [previewData, setPreviewData] = useState<any>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    clienteId: "",
    valorEmprestado: "",
    percentual: "",
    periodicidade: "" as "diario" | "semanal" | "quinzenal" | "mensal" | "",
    numeroParcelas: "",
    dataEmprestimo: "",
    tipoJuros: "simples" as "simples" | "composto"
  });

  useEffect(() => {
    loadContratos();
    loadClientes();
  }, []);

  const loadContratos = async () => {
    try {
      const { data, error } = await supabase
        .from("contratos")
        .select(`
          *,
          clientes(nome)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContratos((data || []) as Contrato[]);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar contratos",
        description: error.message,
        variant: "destructive",
      });
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
        title: "Erro ao carregar clientes",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const calcularContrato = () => {
    const valor = parseFloat(formData.valorEmprestado);
    const percent = parseFloat(formData.percentual);
    const parcelas = parseInt(formData.numeroParcelas);
    
    if (!valor || !percent || !parcelas) return null;

    let valorTotal: number;
    
    if (formData.tipoJuros === "composto") {
      // Juros compostos: M = C * (1 + i)^n
      valorTotal = valor * Math.pow(1 + (percent / 100), parcelas);
    } else {
      // Juros simples: M = C + (C * i * n) / 100
      valorTotal = valor + (valor * percent / 100);
    }
    
    const valorParcela = valorTotal / parcelas;

    return {
      valorTotal,
      valorParcela,
      lucro: valorTotal - valor
    };
  };

  const gerarParcelas = (dataInicio: string, periodicidade: string, numeroParcelas: number): PreviewParcela[] => {
    const parcelas: PreviewParcela[] = [];
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

    const cliente = clientes.find(c => c.id === formData.clienteId);
    const parcelas = gerarParcelas(formData.dataEmprestimo, formData.periodicidade, parseInt(formData.numeroParcelas));

    setPreviewData({
      cliente: cliente?.nome,
      ...formData,
      ...calculo,
      parcelas
    });
    setIsPreviewOpen(true);
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
        title: "Erro ao carregar parcelas",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleContratoClick = async (contrato: Contrato) => {
    setSelectedContrato(contrato);
    await loadParcelas(contrato.id);
    setIsContratoDetailsOpen(true);
  };

  const handleBaixarParcela = async (parcelaId: string, valor: number) => {
    try {
      const { error } = await supabase
        .from("parcelas")
        .update({
          status: "pago",
          data_pagamento: new Date().toISOString().split('T')[0],
          valor_pago: valor
        })
        .eq("id", parcelaId);

      if (error) throw error;

      toast({
        title: "Parcela baixada",
        description: "Pagamento registrado com sucesso.",
      });

      if (selectedContrato) {
        await loadParcelas(selectedContrato.id);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao baixar parcela",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

    try {
      const { data: contrato, error: contratoError } = await supabase
        .from("contratos")
        .insert([{
          cliente_id: formData.clienteId,
          valor_emprestado: parseFloat(formData.valorEmprestado),
          percentual: parseFloat(formData.percentual),
          periodicidade: formData.periodicidade,
          numero_parcelas: parseInt(formData.numeroParcelas),
          data_emprestimo: formData.dataEmprestimo,
          valor_total: calculo.valorTotal,
          status: "ativo",
          tipo_juros: formData.tipoJuros
        }])
        .select()
        .single();

      if (contratoError) throw contratoError;

      // Gerar parcelas usando a função do banco de dados
      const { error: parcelasError } = await supabase.rpc("gerar_parcelas", {
        p_contrato_id: contrato.id,
        p_numero_parcelas: parseInt(formData.numeroParcelas),
        p_valor_parcela: calculo.valorParcela,
        p_data_inicio: formData.dataEmprestimo,
        p_periodicidade: formData.periodicidade
      });

      if (parcelasError) throw parcelasError;

      setFormData({
        clienteId: "",
        valorEmprestado: "",
        percentual: "",
        periodicidade: "",
        numeroParcelas: "",
        dataEmprestimo: "",
        tipoJuros: "simples"
      });
      
      setIsDialogOpen(false);
      
      toast({
        title: "Contrato criado",
        description: "Novo contrato e parcelas geradas com sucesso.",
      });

      loadContratos();
    } catch (error: any) {
      toast({
        title: "Erro ao criar contrato",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Gestão de Contratos</h1>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full md:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Novo Contrato
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Contrato de Empréstimo</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cliente">Cliente</Label>
                  <Select value={formData.clienteId} onValueChange={(value) => setFormData({ ...formData, clienteId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((cliente) => (
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div>
                  <Label htmlFor="tipoJuros">Tipo de Juros</Label>
                  <Select value={formData.tipoJuros} onValueChange={(value: any) => setFormData({ ...formData, tipoJuros: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simples">Juros Simples</SelectItem>
                      <SelectItem value="composto">Juros Compostos</SelectItem>
                    </SelectContent>
                  </Select>
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
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

              <div className="flex flex-col md:flex-row gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handlePreview} disabled={!calcularContrato()} className="flex-1">
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
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p><strong>Cliente:</strong> {previewData.cliente}</p>
                    <p><strong>Data:</strong> {format(new Date(previewData.dataEmprestimo + 'T00:00:00'), 'dd/MM/yyyy')}</p>
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
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Parcela</TableHead>
                          <TableHead>Data de Vencimento</TableHead>
                          <TableHead>Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.parcelas.map((parcela: PreviewParcela) => (
                          <TableRow key={parcela.numero}>
                            <TableCell>{parcela.numero}</TableCell>
                            <TableCell>{format(new Date(parcela.data + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell>
                            <TableCell>R$ {parcela.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detalhes do Contrato e Parcelas */}
      <Dialog open={isContratoDetailsOpen} onOpenChange={setIsContratoDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Contrato</DialogTitle>
          </DialogHeader>
          {selectedContrato && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Informações do Contrato</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p><strong>Cliente:</strong> {selectedContrato.clientes?.nome}</p>
                    <p><strong>Data:</strong> {format(new Date(selectedContrato.data_emprestimo + 'T00:00:00'), 'dd/MM/yyyy')}</p>
                    <p><strong>Periodicidade:</strong> {selectedContrato.periodicidade}</p>
                    <p><strong>Número de Parcelas:</strong> {selectedContrato.numero_parcelas}</p>
                  </div>
                  <div>
                    <p><strong>Valor Emprestado:</strong> R$ {Number(selectedContrato.valor_emprestado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p><strong>Percentual:</strong> {Number(selectedContrato.percentual)}%</p>
                    <p><strong>Valor Total:</strong> R$ {Number(selectedContrato.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p><strong>Status:</strong> <Badge variant={selectedContrato.status === 'ativo' ? 'default' : 'secondary'}>{selectedContrato.status}</Badge></p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Parcelas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Parcela</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Pagamento</TableHead>
                          <TableHead>Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parcelas.map((parcela) => (
                          <TableRow key={parcela.id}>
                            <TableCell>{parcela.numero_parcela}</TableCell>
                            <TableCell>{format(new Date(parcela.data_vencimento + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell>
                            <TableCell>R$ {Number(parcela.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell>
                              <Badge variant={parcela.status === 'pago' ? 'default' : 'secondary'}>
                                {parcela.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {parcela.data_pagamento ? (
                                <div className="text-sm">
                                  <div>{format(new Date(parcela.data_pagamento + 'T00:00:00'), 'dd/MM/yyyy')}</div>
                                  <div className="text-muted-foreground">R$ {Number(parcela.valor_pago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {parcela.status !== 'pago' && (
                                <Button 
                                  size="sm" 
                                  onClick={() => handleBaixarParcela(parcela.id, Number(parcela.valor))}
                                >
                                  Baixar
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Lista de Contratos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">Contratos Ativos ({contratos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Cliente</TableHead>
                  <TableHead className="hidden md:table-cell">Valor Emprestado</TableHead>
                  <TableHead className="hidden lg:table-cell">Percentual</TableHead>
                  <TableHead className="hidden md:table-cell">Periodicidade</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum contrato encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  contratos.map((contrato) => (
                    <TableRow 
                      key={contrato.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleContratoClick(contrato)}
                    >
                      <TableCell className="font-medium">
                        {contrato.clientes?.nome}
                        <div className="md:hidden text-xs text-muted-foreground mt-1">
                          {contrato.periodicidade} • {contrato.percentual}%
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">R$ {Number(contrato.valor_emprestado).toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="hidden lg:table-cell">{Number(contrato.percentual)}%</TableCell>
                      <TableCell className="hidden md:table-cell capitalize">{contrato.periodicidade}</TableCell>
                      <TableCell>R$ {Number(contrato.valor_total).toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant={contrato.status === "ativo" ? "default" : "secondary"}>
                          {contrato.status === "ativo" ? "Ativo" : contrato.status}
                        </Badge>
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
