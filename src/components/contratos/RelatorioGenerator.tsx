import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useToast } from "@/hooks/use-toast";
import type { Contrato, Parcela } from "./ContratoDetails";

interface RelatorioGeneratorProps {
  contrato: Contrato;
  parcelas: Parcela[];
}

export function RelatorioGenerator({ contrato, parcelas }: RelatorioGeneratorProps) {
  const { toast } = useToast();

  const escapeHtml = (text: string): string => {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  const gerarImagemContrato = async () => {
    try {
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '800px';
      tempDiv.style.padding = '40px';
      tempDiv.style.backgroundColor = '#ffffff';
      tempDiv.style.fontFamily = 'Arial, sans-serif';
      document.body.appendChild(tempDiv);

      const clienteNome = escapeHtml(contrato.clientes?.nome || 'N/A');
      
      tempDiv.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1a1a1a; font-size: 28px; margin-bottom: 10px; font-weight: bold;">RELATÓRIO DE CONTRATO</h1>
        </div>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; font-size: 20px; margin-bottom: 15px; font-weight: bold;">Informações do Contrato</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 14px;">
            <div><strong>Cliente:</strong> ${clienteNome}</div>
            <div><strong>Data:</strong> ${format(new Date(contrato.data_emprestimo + 'T00:00:00'), 'dd/MM/yyyy')}</div>
            <div><strong>Valor Emprestado:</strong> R$ ${Number(contrato.valor_emprestado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <div><strong>Percentual:</strong> ${Number(contrato.percentual)}%</div>
            <div><strong>Valor Total:</strong> R$ ${Number(contrato.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <div><strong>Parcelas:</strong> ${contrato.numero_parcelas}</div>
            <div><strong>Periodicidade:</strong> ${contrato.periodicidade}</div>
            <div><strong>Status:</strong> ${contrato.status}</div>
          </div>
        </div>
        <div>
          <h2 style="color: #333; font-size: 20px; margin-bottom: 15px; font-weight: bold;">Parcelas</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #333; color: white;">
                <th style="padding: 10px; text-align: left;">Nº</th>
                <th style="padding: 10px; text-align: left;">Vencimento</th>
                <th style="padding: 10px; text-align: left;">Valor</th>
                <th style="padding: 10px; text-align: left;">Status</th>
                <th style="padding: 10px; text-align: left;">Pagamento</th>
                <th style="padding: 10px; text-align: left;">Valor Pago</th>
              </tr>
            </thead>
            <tbody>
              ${parcelas.map((p, i) => {
                const hoje = new Date(); hoje.setHours(0,0,0,0);
                const venc = new Date(p.data_vencimento + 'T00:00:00');
                const atrasada = p.status !== 'pago' && venc < hoje;
                const statusTexto = p.status === 'pago' ? 'Pago' : (atrasada ? 'Atrasado' : 'Pendente');
                const cor = p.status === 'pago' ? '#22c55e' : (atrasada ? '#ef4444' : '#94a3b8');
                return `<tr style="background: ${i % 2 === 0 ? '#f9f9f9' : '#ffffff'}; border-bottom: 1px solid #ddd;">
                  <td style="padding: 8px;">${p.numero_parcela}</td>
                  <td style="padding: 8px;">${format(venc, 'dd/MM/yyyy')}</td>
                  <td style="padding: 8px;">R$ ${Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td style="padding: 8px;"><span style="background: ${cor}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 11px;">${statusTexto}</span></td>
                  <td style="padding: 8px;">${p.data_pagamento ? format(new Date(p.data_pagamento + 'T00:00:00'), 'dd/MM/yyyy') : '-'}</td>
                  <td style="padding: 8px;">${p.valor_pago ? `R$ ${Number(p.valor_pago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      const canvas = await html2canvas(tempDiv, { scale: 2, backgroundColor: '#ffffff', logging: false });
      document.body.removeChild(tempDiv);

      const fileName = `contrato-${clienteNome.replace(/\s+/g, '-')}-${format(new Date(), 'dd-MM-yyyy')}.png`;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

      canvas.toBlob(async (blob) => {
        if (blob) {
          if (isIOS && navigator.share && navigator.canShare) {
            const file = new File([blob], fileName, { type: 'image/png' });
            if (navigator.canShare({ files: [file] })) {
              try {
                await navigator.share({ files: [file], title: 'Relatório de Contrato' });
                toast({ title: "Imagem pronta!", description: "Escolha 'Salvar Imagem' para adicionar à galeria." });
                return;
              } catch (err: any) {
                if (err.name === 'AbortError') return;
              }
            }
          }
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          link.click();
          URL.revokeObjectURL(url);
          toast({ title: "Imagem gerada!", description: "O arquivo foi baixado." });
        }
      }, 'image/png');
    } catch (error) {
      toast({ title: "Erro ao gerar imagem", variant: "destructive" });
    }
  };

  const gerarRelatorioPDF = async () => {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      let yPos = 20;

      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('RELATÓRIO DE CONTRATO', pageWidth / 2, yPos, { align: 'center' });
      yPos += 15;

      pdf.setFontSize(14);
      pdf.text('Informações do Contrato', margin, yPos);
      yPos += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      
      const clienteNome = contrato.clientes?.nome || 'N/A';
      const linhas = [
        `Cliente: ${clienteNome}`,
        `Data do Empréstimo: ${format(new Date(contrato.data_emprestimo + 'T00:00:00'), 'dd/MM/yyyy')}`,
        `Valor Emprestado: R$ ${Number(contrato.valor_emprestado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `Percentual: ${Number(contrato.percentual)}%`,
        `Valor Total: R$ ${Number(contrato.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `Número de Parcelas: ${contrato.numero_parcelas}`,
        `Periodicidade: ${contrato.periodicidade}`,
        `Status: ${contrato.status}`,
      ];

      linhas.forEach(l => { pdf.text(l, margin, yPos); yPos += 6; });
      yPos += 10;

      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Parcelas', margin, yPos);
      yPos += 8;

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      const colWidths = [20, 35, 35, 35, 35, 30];
      const headers = ['Nº', 'Vencimento', 'Valor', 'Status', 'Pagamento', 'Valor Pago'];
      
      let xPos = margin;
      headers.forEach((h, i) => { pdf.text(h, xPos, yPos); xPos += colWidths[i]; });
      yPos += 6;

      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPos - 2, pageWidth - margin, yPos - 2);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);

      parcelas.forEach(p => {
        if (yPos > 270) { pdf.addPage(); yPos = 20; }

        const hoje = new Date(); hoje.setHours(0,0,0,0);
        const venc = new Date(p.data_vencimento + 'T00:00:00');
        const statusTexto = p.status === 'pago' ? 'Pago' : (venc < hoje ? 'Atrasado' : 'Pendente');

        xPos = margin;
        const dados = [
          p.numero_parcela.toString(),
          format(venc, 'dd/MM/yy'),
          `R$ ${Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          statusTexto,
          p.data_pagamento ? format(new Date(p.data_pagamento + 'T00:00:00'), 'dd/MM/yy') : '-',
          p.valor_pago ? `R$ ${Number(p.valor_pago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-',
        ];
        dados.forEach((d, i) => { pdf.text(d, xPos, yPos); xPos += colWidths[i]; });
        yPos += 5;
      });

      pdf.save(`contrato-${clienteNome.replace(/\s+/g, '-')}-${format(new Date(), 'dd-MM-yyyy')}.pdf`);
      toast({ title: "PDF gerado!", description: "O relatório foi baixado." });
    } catch (error) {
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={gerarImagemContrato} className="w-full sm:w-auto">
        <Download className="h-4 w-4 mr-2" />
        Baixar Imagem
      </Button>
      <Button variant="outline" size="sm" onClick={gerarRelatorioPDF} className="w-full sm:w-auto">
        <Download className="h-4 w-4 mr-2" />
        Baixar PDF
      </Button>
    </>
  );
}
