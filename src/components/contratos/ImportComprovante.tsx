import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, Loader2, FileText, ArrowRightLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getLocalDateString } from "@/lib/utils";
import type { ContratoFormData } from "./ContratoForm";

interface DadosComprovante {
  nome_cliente: string;
  valor: number;
  data: string;
  chave_pix?: string;
  tipo_chave?: string;
}

interface Cliente {
  id: string;
  nome: string;
}

interface ImportComprovanteProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  clientes: Cliente[];
  onImportComplete: (formData: Partial<ContratoFormData>) => void;
  onClientesUpdated: () => void;
}

export function ImportComprovante({
  isOpen,
  onOpenChange,
  clientes,
  onImportComplete,
  onClientesUpdated
}: ImportComprovanteProps) {
  const [isImportLoading, setIsImportLoading] = useState(false);
  const [dadosComprovante, setDadosComprovante] = useState<DadosComprovante | null>(null);
  const [importStep, setImportStep] = useState<"upload" | "review">("upload");
  const [showClienteOverride, setShowClienteOverride] = useState(false);
  const [clienteOverrideType, setClienteOverrideType] = useState<"existing" | "new">("existing");
  const [selectedOverrideClienteId, setSelectedOverrideClienteId] = useState("");
  const [novoClienteNome, setNovoClienteNome] = useState("");
  const { toast } = useToast();

  const handleClose = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      setDadosComprovante(null);
      setImportStep("upload");
      setShowClienteOverride(false);
      setSelectedOverrideClienteId("");
      setNovoClienteNome("");
    }
  };

  const convertPdfToImage = async (file: File): Promise<string> => {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    
    const scale = 2;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    
    await page.render({ canvasContext: ctx, viewport }).promise;
    
    const dataUrl = canvas.toDataURL("image/png");
    return dataUrl.split(",")[1];
  };

  const handleImportComprovante = async (file: File) => {
    setIsImportLoading(true);
    try {
      let base64: string;
      let mimeType: string;

      if (file.type === "application/pdf") {
        base64 = await convertPdfToImage(file);
        mimeType = "image/png";
      } else {
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        mimeType = file.type;
      }

      const { data, error } = await supabase.functions.invoke("parse-comprovante", {
        body: { image_base64: base64, mime_type: mimeType },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setDadosComprovante(data);
      setImportStep("review");
    } catch (error: any) {
      console.error("Erro ao importar comprovante:", error);
      toast({
        title: "Erro ao processar comprovante",
        description: error.message || "Não foi possível extrair os dados do comprovante.",
        variant: "destructive",
      });
    } finally {
      setIsImportLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!dadosComprovante) return;

    try {
      let clienteId: string;

      if (showClienteOverride && clienteOverrideType === "existing" && selectedOverrideClienteId) {
        clienteId = selectedOverrideClienteId;
      } else if (showClienteOverride && clienteOverrideType === "new" && novoClienteNome.trim()) {
        const observacoes = dadosComprovante.chave_pix
          ? `Chave PIX (${dadosComprovante.tipo_chave || "desconhecido"}): ${dadosComprovante.chave_pix}`
          : undefined;

        const { data: { user } } = await supabase.auth.getUser();
        const { data: novoCliente, error: clienteError } = await supabase
          .from("clientes")
          .insert([{ nome: novoClienteNome.trim(), observacoes, user_id: user?.id }])
          .select()
          .single();

        if (clienteError) throw clienteError;
        clienteId = novoCliente.id;
        onClientesUpdated();
      } else {
        const { data: clientesMatch } = await supabase
          .from("clientes")
          .select("id, nome")
          .ilike("nome", `%${dadosComprovante.nome_cliente}%`);

        if (clientesMatch && clientesMatch.length > 0) {
          clienteId = clientesMatch[0].id;
        } else {
          const observacoes = dadosComprovante.chave_pix
            ? `Chave PIX (${dadosComprovante.tipo_chave || "desconhecido"}): ${dadosComprovante.chave_pix}`
            : undefined;

          const { data: { user } } = await supabase.auth.getUser();
          const { data: novoCliente, error: clienteError } = await supabase
            .from("clientes")
            .insert([{ nome: dadosComprovante.nome_cliente, observacoes, user_id: user?.id }])
            .select()
            .single();

          if (clienteError) throw clienteError;
          clienteId = novoCliente.id;
          onClientesUpdated();
        }
      }

      onImportComplete({
        clienteId,
        valorEmprestado: dadosComprovante.valor.toString(),
        dataEmprestimo: dadosComprovante.data || getLocalDateString(),
      });

      handleClose(false);
    } catch (error: any) {
      toast({
        title: "Erro ao confirmar importação",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md w-[95vw] sm:w-full p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg">Importar Comprovante PIX</DialogTitle>
          <DialogDescription>
            {importStep === "upload"
              ? "Faça upload de uma imagem ou PDF do comprovante PIX para extrair os dados automaticamente."
              : "Confira os dados extraídos do comprovante antes de confirmar."}
          </DialogDescription>
        </DialogHeader>

        {importStep === "upload" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-3">
                Selecione uma imagem (PNG, JPG) ou PDF
              </p>
              <Input
                type="file"
                accept="image/png,image/jpeg,image/jpg,application/pdf"
                className="max-w-xs mx-auto"
                disabled={isImportLoading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportComprovante(file);
                }}
              />
            </div>
            {isImportLoading && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando comprovante...
              </div>
            )}
          </div>
        )}

        {importStep === "review" && dadosComprovante && (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="col-span-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-muted-foreground text-xs">Cliente</p>
                        {!showClienteOverride ? (
                          <p className="font-medium">{dadosComprovante.nome_cliente}</p>
                        ) : (
                          <p className="font-medium text-muted-foreground text-xs italic">Original: {dadosComprovante.nome_cliente}</p>
                        )}
                      </div>
                      {!showClienteOverride && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowClienteOverride(true);
                            setClienteOverrideType("existing");
                            setSelectedOverrideClienteId("");
                            setNovoClienteNome(dadosComprovante.nome_cliente);
                          }}
                          className="h-8 px-2 text-xs"
                        >
                          <ArrowRightLeft className="h-3 w-3 mr-1" />
                          Trocar
                        </Button>
                      )}
                    </div>

                    {showClienteOverride && (
                      <div className="mt-3 space-y-3 border rounded-md p-3 bg-muted/30">
                        <RadioGroup value={clienteOverrideType} onValueChange={(v) => setClienteOverrideType(v as "existing" | "new")}>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="existing" id="override-existing" />
                            <Label htmlFor="override-existing" className="cursor-pointer text-xs">Cliente existente</Label>
                          </div>
                          {clienteOverrideType === "existing" && (
                            <Select value={selectedOverrideClienteId} onValueChange={setSelectedOverrideClienteId}>
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder="Selecione um cliente" />
                              </SelectTrigger>
                              <SelectContent>
                                {clientes.map((c) => (
                                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="new" id="override-new" />
                            <Label htmlFor="override-new" className="cursor-pointer text-xs">Novo cliente</Label>
                          </div>
                          {clienteOverrideType === "new" && (
                            <Input
                              value={novoClienteNome}
                              onChange={(e) => setNovoClienteNome(e.target.value)}
                              placeholder="Nome do novo cliente"
                              className="h-9 text-xs"
                            />
                          )}
                        </RadioGroup>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowClienteOverride(false);
                            setSelectedOverrideClienteId("");
                            setNovoClienteNome("");
                          }}
                          className="h-7 text-xs"
                        >
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Valor</p>
                    <p className="font-medium">R$ {dadosComprovante.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Data</p>
                    <p className="font-medium">{dadosComprovante.data ? format(new Date(dadosComprovante.data + "T00:00:00"), "dd/MM/yyyy") : "N/A"}</p>
                  </div>
                  {dadosComprovante.chave_pix && (
                    <div>
                      <p className="text-muted-foreground text-xs">Chave PIX ({dadosComprovante.tipo_chave})</p>
                      <p className="font-medium text-xs break-all">{dadosComprovante.chave_pix}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => {
                setImportStep("upload");
                setDadosComprovante(null);
                setShowClienteOverride(false);
              }} className="w-full sm:w-auto">
                Tentar novamente
              </Button>
              <Button onClick={handleConfirmImport} className="w-full sm:w-auto" disabled={showClienteOverride && clienteOverrideType === "existing" && !selectedOverrideClienteId || showClienteOverride && clienteOverrideType === "new" && !novoClienteNome.trim()}>
                <FileText className="h-4 w-4 mr-2" />
                Confirmar e Criar Contrato
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
