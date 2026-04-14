import { useState, useMemo, useEffect, useRef } from "react";
import { format } from "date-fns";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, FileText, Eye, DollarSign, TrendingUp, Calculator } from "lucide-react";
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-2 pb-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

export function ContratoForm({
  clientes, isOpen, onOpenChange, onContratoCreated, canCreate, onAccessRestricted, initialData
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

  const prevInitialDataRef = useRef(initialData);
  useEffect(() => {
    if (initialData && prevInitialDataRef.current !== initialData) {
      setFormData({ ...defaultFormData, ...initialData });
    }
    prevInitialDataRef.current = initialData;
  }, [initialData]);

  const calcularContrato = () => {
    const valor = parseFloat(formData.valorEmprestado);
    const percent = parseFloat(formData.percentual);
    const parcelas = parseInt(formData.numeroParcelas);
    if (!valor || !percent || !parcelas) return null;
    const valorTotal = calcularValorTotal(valor, percent, parcelas, formData.tipoJuros);
    const valorParcela = valorTotal / parcelas;
    return { valorTotal, valorParcela, lucro: valorTotal - valor };
  };

  const gerarParcelas = (dataInicio: string, periodicidade: string, numeroParcelas: number): PreviewParcela[] => {
    const parcelas: PreviewParcela[] = [];
    const dataBase = new Date(dataInicio);
    for (let i = 1; i <= numeroParcelas; i++) {
      const dataParcela = new Date(dataBase);
      switch (periodicidade) {
        case "diario": dataParcela.setDate(dataBase.getDate() + i); break;
        case "semanal": dataParcela.setDate(dataBase.getDate() + (i * 7)); break;
        case "quinzenal": dataParcela.setDate(dataBase.getDate() + (i * 15)); break;
        case "mensal": dataParcela.setMonth(dataBase.getMonth() + i); break;
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
    setPreviewData({ cliente: cliente?.nome, ...formData, ...calculo, parcelas });
    setIsPreviewOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationResult = contratoSchema.safeParse(formData);
    if (!validationResult.success) {
      toast({ title: "Dados inválidos", description: validationResult.error.errors[0].message, variant: "destructive" });
      return;
    }
    const validatedData = validationResult.data;
    const calculo = calcularContrato();
    if (!calculo) {
      toast({ title: "Erro de cálculo", description: "Não foi possível calcular os valores.", variant: "destructive" });
      return;
    }
    try {
      const { criarContratoComParcelas } = await import("@/services/contratos");
      await criarContratoComParcelas({
        clienteId: validatedData.clienteId,
        valorEmprestado: parseFloat(validatedData.valorEmprestado),
        percentual: parseFloat(validatedData.percentual),
        periodicidade: validatedData.periodicidade,
        numeroParcelas: parseInt(validatedData.numeroParcelas),
        dataEmprestimo: validatedData.dataEmprestimo,
        tipoJuros: validatedData.tipoJuros,
        permiteSabado: validatedData.permiteCobrancaSabado,
        permiteDomingo: validatedData.permiteCobrancaDomingo,
      });
      setFormData({ ...defaultFormData });
      onOpenChange(false);
      toast({ title: "Contrato criado", description: "Contrato e parcelas gerados com sucesso." });
      onContratoCreated();
    } catch (error: any) {
      toast({ title: "Não foi possível criar o contrato", description: "Verifique os dados e sua conexão.", variant: "destructive" });
    }
  };

  const calculo = calcularContrato();
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
          <Button size="sm" onClick={(e) => {
            if (!canCreate) { e.preventDefault(); onAccessRestricted(); }
          }}>
            <Plus className="h-4 w-4 mr-1.5" />
            Criar contrato
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg">Novo contrato de empréstimo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Section: Client & Date */}
            <SectionLabel>Cliente e Data</SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cliente" className="text-xs">Cliente</Label>
                <Select value={formData.clienteId} onValueChange={(value) => setFormData({ ...formData, clienteId: value })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>
                    {clientes.map((cliente) => (
                      <SelectItem key={cliente.id} value={cliente.id}>{cliente.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="dataEmprestimo" className="text-xs">Data do empréstimo</Label>
                <Input id="dataEmprestimo" type="date" value={formData.dataEmprestimo} onChange={(e) => setFormData({ ...formData, dataEmprestimo: e.target.value })} required />
              </div>
            </div>

            {/* Section: Loan terms */}
            <SectionLabel>Condições do Empréstimo</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="valor" className="text-xs">Valor emprestado (R$)</Label>
                <Input id="valor" type="number" step="0.01" value={formData.valorEmprestado} onChange={(e) => setFormData({ ...formData, valorEmprestado: e.target.value })} required placeholder="0,00" />
              </div>
              <div>
                <Label htmlFor="percentual" className="text-xs">Percentual (%)</Label>
                <Input id="percentual" type="number" step="0.1" value={formData.percentual} onChange={(e) => setFormData({ ...formData, percentual: e.target.value })} required placeholder="0,0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="parcelas" className="text-xs">Nº de parcelas</Label>
                <Input id="parcelas" type="number" value={formData.numeroParcelas} onChange={(e) => setFormData({ ...formData, numeroParcelas: e.target.value })} required placeholder="1" />
              </div>
              <div>
                <Label htmlFor="periodicidade" className="text-xs">Periodicidade</Label>
                <Select value={formData.periodicidade} onValueChange={(value: any) => setFormData({ ...formData, periodicidade: value })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diario">Diário</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="quinzenal">Quinzenal</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Section: Interest */}
            <SectionLabel>Tipo de Juros</SectionLabel>
            <div>
              <Select value={formData.tipoJuros} onValueChange={(value: any) => setFormData({ ...formData, tipoJuros: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="simples">Juros Fixo</SelectItem>
                  <SelectItem value="parcela">Juros por Parcela</SelectItem>
                  <SelectItem value="composto">Juros Composto</SelectItem>
                </SelectContent>
              </Select>
              {formData.tipoJuros && (
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{explicacaoJuros}</p>
              )}
            </div>

            {/* Section: Collection rules */}
            <SectionLabel>Regras de Cobrança</SectionLabel>
            <div className="space-y-2.5">
              <div className="flex items-center space-x-2">
                <Checkbox id="sabado" checked={formData.permiteCobrancaSabado} onCheckedChange={(checked) => setFormData({ ...formData, permiteCobrancaSabado: checked as boolean })} />
                <label htmlFor="sabado" className="text-sm leading-none">Permitir cobrança aos sábados</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="domingo" checked={formData.permiteCobrancaDomingo} onCheckedChange={(checked) => setFormData({ ...formData, permiteCobrancaDomingo: checked as boolean })} />
                <label htmlFor="domingo" className="text-sm leading-none">Permitir cobrança aos domingos</label>
              </div>
              <p className="text-xs text-muted-foreground">
                Parcelas em dias não permitidos serão movidas para o próximo dia útil.
              </p>
            </div>

            {/* Live summary */}
            {calculo && (
              <>
                <SectionLabel>Resumo da Operação</SectionLabel>
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-3">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total</span>
                        </div>
                        <p className="text-sm md:text-base font-bold">R$ {calculo.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Calculator className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Parcela</span>
                        </div>
                        <p className="text-sm md:text-base font-bold">R$ {calculo.valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <TrendingUp className="h-3 w-3 text-success" />
                          <span className="text-[10px] uppercase tracking-wider text-success font-medium">Lucro</span>
                        </div>
                        <p className="text-sm md:text-base font-bold text-success">R$ {calculo.lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            <div className="flex flex-col md:flex-row gap-2 pt-3 border-t">
              <Button type="button" variant="outline" onClick={handlePreview} disabled={!calculo} className="flex-1">
                <Eye className="h-4 w-4 mr-1.5" />
                Visualizar parcelas
              </Button>
              <Button type="submit" className="flex-1">
                <FileText className="h-4 w-4 mr-1.5" />
                Criar contrato
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Prévia do contrato</DialogTitle>
          </DialogHeader>
          {previewData && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1.5">
                    <p><span className="text-muted-foreground">Cliente:</span> <strong>{previewData.cliente}</strong></p>
                    <p><span className="text-muted-foreground">Data:</span> {format(new Date(previewData.dataEmprestimo + 'T00:00:00'), 'dd/MM/yyyy')}</p>
                    <p><span className="text-muted-foreground">Periodicidade:</span> <span className="capitalize">{previewData.periodicidade}</span></p>
                  </div>
                  <div className="space-y-1.5">
                    <p><span className="text-muted-foreground">Emprestado:</span> <strong>R$ {parseFloat(previewData.valorEmprestado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
                    <p><span className="text-muted-foreground">Juros:</span> {previewData.percentual}%</p>
                    <p><span className="text-muted-foreground">Total:</span> <strong>R$ {previewData.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[60px]">Nº</TableHead>
                          <TableHead className="min-w-[100px]">Vencimento</TableHead>
                          <TableHead className="min-w-[80px]">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.parcelas.map((parcela: PreviewParcela) => (
                          <TableRow key={parcela.numero}>
                            <TableCell className="font-medium">{parcela.numero}</TableCell>
                            <TableCell className="text-sm">{format(new Date(parcela.data + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell>
                            <TableCell className="text-sm">R$ {parcela.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
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

      <AlertDialog open={isCloseConfirmOpen} onOpenChange={setIsCloseConfirmOpen}>
        <AlertDialogContent className="w-[95vw] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              Os dados preenchidos serão perdidos. Deseja continuar?
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
