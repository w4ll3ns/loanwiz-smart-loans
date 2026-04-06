import { useState, useMemo } from "react";
import { format } from "date-fns";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, FileText, Eye } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getLocalDateString } from "@/lib/utils";
import { calcularValorTotal, getExplicacaoJuros, TipoJuros } from "@/lib/calculos";

const contratoSchema = z.object({
  clienteId: z.string().uuid('Selecione um cliente válido'),
  valorEmprestado: z.string().refine(val => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0 && num <= 100000000;
  }, 'Valor emprestado deve ser positivo e menor que 100 milhões'),
  percentual: z.string().refine(val => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0 && num <= 1000;
  }, 'Percentual deve ser entre 0.01% e 1000%'),
  periodicidade: z.enum(['diario', 'semanal', 'quinzenal', 'mensal'], {
    errorMap: () => ({ message: 'Selecione uma periodicidade válida' })
  }),
  numeroParcelas: z.string().refine(val => {
    const num = parseInt(val);
    return !isNaN(num) && num >= 1 && num <= 365;
  }, 'Número de parcelas deve ser entre 1 e 365'),
  dataEmprestimo: z.string().refine(val => {
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, 'Data do empréstimo é obrigatória'),
  tipoJuros: z.enum(['simples', 'parcela', 'composto']),
  permiteCobrancaSabado: z.boolean(),
  permiteCobrancaDomingo: z.boolean()
});

interface Cliente {
  id: string;
  nome: string;
}

interface PreviewParcela {
  numero: number;
  data: string;
  valor: number;
}

export interface ContratoFormData {
  clienteId: string;
  valorEmprestado: string;
  percentual: string;
  periodicidade: "diario" | "semanal" | "quinzenal" | "mensal" | "";
  numeroParcelas: string;
  dataEmprestimo: string;
  tipoJuros: TipoJuros;
  permiteCobrancaSabado: boolean;
  permiteCobrancaDomingo: boolean;
}

const defaultFormData: ContratoFormData = {
  clienteId: "",
  valorEmprestado: "",
  percentual: "",
  periodicidade: "",
  numeroParcelas: "",
  dataEmprestimo: "",
  tipoJuros: "simples",
  permiteCobrancaSabado: true,
  permiteCobrancaDomingo: false
};

interface ContratoFormProps {
  clientes: Cliente[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onContratoCreated: () => void;
  canCreate: boolean;
  onAccessRestricted: () => void;
  initialData?: Partial<ContratoFormData>;
}

export function ContratoForm({
  clientes,
  isOpen,
  onOpenChange,
  onContratoCreated,
  canCreate,
  onAccessRestricted,
  initialData
}: ContratoFormProps) {
  const [formData, setFormData] = useState<ContratoFormData>({ ...defaultFormData, ...initialData });
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const { toast } = useToast();

  const isFormDirty = useMemo(() => {
    const base = { ...defaultFormData, ...initialData };
    return Object.keys(defaultFormData).some(
      (key) => formData[key as keyof ContratoFormData] !== base[key as keyof ContratoFormData]
    );
  }, [formData, initialData]);

  const handleOpenChange = (open: boolean) => {
    if (!open && isFormDirty) {
      setIsCloseConfirmOpen(true);
      return;
    }
    if (!open) {
      setFormData({ ...defaultFormData });
    }
    onOpenChange(open);
  };

  const handleConfirmClose = () => {
    setIsCloseConfirmOpen(false);
    setFormData({ ...defaultFormData });
    onOpenChange(false);
  };

  // Reset form when initialData changes
  if (initialData && formData.clienteId !== initialData.clienteId) {
    setFormData({ ...defaultFormData, ...initialData });
  }

  const calcularContrato = () => {
    const valor = parseFloat(formData.valorEmprestado);
    const percent = parseFloat(formData.percentual);
    const parcelas = parseInt(formData.numeroParcelas);
    
    if (!valor || !percent || !parcelas) return null;

    const valorTotal = calcularValorTotal(valor, percent, parcelas, formData.tipoJuros);
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
        data: getLocalDateString(dataParcela),
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationResult = contratoSchema.safeParse(formData);
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      toast({
        title: "Dados inválidos",
        description: firstError.message,
        variant: "destructive"
      });
      return;
    }

    const validatedData = validationResult.data;
    
    const calculo = calcularContrato();
    if (!calculo) {
      toast({
        title: "Erro de cálculo",
        description: "Não foi possível calcular os valores do contrato.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: contrato, error: contratoError } = await supabase
        .from("contratos")
        .insert([{
          cliente_id: validatedData.clienteId,
          valor_emprestado: parseFloat(validatedData.valorEmprestado),
          percentual: parseFloat(validatedData.percentual),
          periodicidade: validatedData.periodicidade,
          numero_parcelas: parseInt(validatedData.numeroParcelas),
          data_emprestimo: validatedData.dataEmprestimo,
          valor_total: calculo.valorTotal,
          status: "ativo",
          tipo_juros: validatedData.tipoJuros,
          permite_cobranca_sabado: validatedData.permiteCobrancaSabado,
          permite_cobranca_domingo: validatedData.permiteCobrancaDomingo
        }])
        .select()
        .single();

      if (contratoError) throw contratoError;

      const { error: parcelasError } = await supabase.rpc("gerar_parcelas", {
        p_contrato_id: contrato.id,
        p_numero_parcelas: parseInt(validatedData.numeroParcelas),
        p_valor_parcela: calculo.valorParcela,
        p_data_inicio: validatedData.dataEmprestimo,
        p_periodicidade: validatedData.periodicidade,
        p_permite_sabado: validatedData.permiteCobrancaSabado,
        p_permite_domingo: validatedData.permiteCobrancaDomingo
      });

      if (parcelasError) throw parcelasError;

      setFormData({ ...defaultFormData });
      onOpenChange(false);
      
      toast({
        title: "Contrato criado",
        description: "Novo contrato e parcelas geradas com sucesso.",
      });

      onContratoCreated();
    } catch (error: any) {
      toast({
        title: "Não foi possível criar o contrato",
        description: "Verifique todos os dados preenchidos e sua conexão com a internet.",
        variant: "destructive",
      });
    }
  };

  const explicacaoJuros = getExplicacaoJuros(
    formData.tipoJuros,
    parseFloat(formData.valorEmprestado) || 10000,
    parseFloat(formData.percentual) || 10,
    parseInt(formData.numeroParcelas) || 3
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button size="sm" className="w-full md:w-auto" onClick={(e) => {
            if (!canCreate) {
              e.preventDefault();
              onAccessRestricted();
            }
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Contrato
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Novo Contrato de Empréstimo</DialogTitle>
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

              <div className="space-y-2">
                <Label htmlFor="tipoJuros">Tipo de Juros</Label>
                <Select value={formData.tipoJuros} onValueChange={(value: any) => setFormData({ ...formData, tipoJuros: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simples">Juros Fixo</SelectItem>
                    <SelectItem value="parcela">Juros por Parcela</SelectItem>
                    <SelectItem value="composto">Juros Composto</SelectItem>
                  </SelectContent>
                </Select>
                {formData.tipoJuros && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {explicacaoJuros}
                  </p>
                )}
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

            <div className="col-span-1 md:col-span-2 space-y-3">
              <Label className="text-sm font-medium">Dias permitidos para cobrança</Label>
              <div className="flex flex-col gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="sabado"
                    checked={formData.permiteCobrancaSabado}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, permiteCobrancaSabado: checked as boolean })
                    }
                  />
                  <label htmlFor="sabado" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Permitir cobrança aos sábados
                  </label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="domingo"
                    checked={formData.permiteCobrancaDomingo}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, permiteCobrancaDomingo: checked as boolean })
                    }
                  />
                  <label htmlFor="domingo" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Permitir cobrança aos domingos
                  </label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Se um dia não for permitido, a parcela será automaticamente movida para o próximo dia útil permitido.
              </p>
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
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Preview do Contrato</DialogTitle>
          </DialogHeader>
          {previewData && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm sm:text-base">
                  <div className="space-y-2">
                    <p><strong>Cliente:</strong> {previewData.cliente}</p>
                    <p><strong>Data:</strong> {format(new Date(previewData.dataEmprestimo + 'T00:00:00'), 'dd/MM/yyyy')}</p>
                    <p><strong>Periodicidade:</strong> {previewData.periodicidade}</p>
                  </div>
                  <div className="space-y-2">
                    <p><strong>Valor Emprestado:</strong> R$ {parseFloat(previewData.valorEmprestado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p><strong>Percentual:</strong> {previewData.percentual}%</p>
                    <p><strong>Valor Total:</strong> R$ {previewData.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[60px]">Parcela</TableHead>
                          <TableHead className="min-w-[100px]">Data de Vencimento</TableHead>
                          <TableHead className="min-w-[80px]">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.parcelas.map((parcela: PreviewParcela) => (
                          <TableRow key={parcela.numero}>
                            <TableCell className="font-medium">{parcela.numero}</TableCell>
                            <TableCell className="text-xs sm:text-sm">{format(new Date(parcela.data + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell>
                            <TableCell className="text-xs sm:text-sm">R$ {parcela.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
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

      {/* Confirmação ao fechar com dados preenchidos */}
      <AlertDialog open={isCloseConfirmOpen} onOpenChange={setIsCloseConfirmOpen}>
        <AlertDialogContent className="w-[95vw] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja fechar? Os dados preenchidos serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClose} className="w-full sm:w-auto bg-destructive hover:bg-destructive/90">
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
