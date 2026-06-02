import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Contrato, Parcela } from "./ContratoDetails";
import { buildRelatorioHtml } from "./relatorioTemplate";
import { exportarPng, exportarPdf } from "./relatorioExport";

interface RelatorioSimplificadoGeneratorProps {
  contrato: Contrato;
  parcelas: Parcela[];
}

export function RelatorioSimplificadoGenerator({ contrato, parcelas }: RelatorioSimplificadoGeneratorProps) {
  const { toast } = useToast();

  const baseFileName = () => {
    const nome = (contrato.clientes?.nome || "cliente").replace(/\s+/g, "-");
    return `relatorio-simplificado-${nome}-${format(new Date(), "dd-MM-yyyy")}`;
  };

  const gerarImagem = async () => {
    const { html, width } = buildRelatorioHtml(contrato, parcelas, { simplificado: true });
    await exportarPng(html, width, `${baseFileName()}.png`, "Relatório Simplificado", toast);
  };

  const gerarPDF = async () => {
    const { html, width } = buildRelatorioHtml(contrato, parcelas, { simplificado: true });
    await exportarPdf(html, width, `${baseFileName()}.pdf`, toast);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={gerarImagem} className="w-full sm:w-auto">
        <Download className="h-4 w-4 mr-2" />
        Imagem (simplificado)
      </Button>
      <Button variant="outline" size="sm" onClick={gerarPDF} className="w-full sm:w-auto">
        <Download className="h-4 w-4 mr-2" />
        PDF (simplificado)
      </Button>
    </>
  );
}
