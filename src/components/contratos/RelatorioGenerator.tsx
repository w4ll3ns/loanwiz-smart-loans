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

  const getStatusInfo = (p: Parcela) => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const venc = new Date(p.data_vencimento + 'T00:00:00');
    if (p.status === 'pago') return { texto: 'Pago', cor: '#22c55e' };
    if (p.status === 'parcialmente_pago') return { texto: 'Parcial', cor: '#f59e0b' };
    if (venc < hoje) return { texto: 'Atrasado', cor: '#ef4444' };
    return { texto: 'Pendente', cor: '#94a3b8' };
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
      const totalPago = parcelas.reduce((s, p) => s + (Number(p.valor_pago) || 0), 0);
      const saldoRestante = Number(contrato.valor_total) - totalPago;
      const percentQuitado = Number(contrato.valor_total) > 0 ? (totalPago / Number(contrato.valor_total)) * 100 : 0;
      
      tempDiv.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px; border-bottom: 3px solid #333; padding-bottom: 15px;">
          <h1 style="color: #1a1a1a; font-size: 26px; margin: 0 0 5px; font-weight: bold;">RELATÓRIO DE CONTRATO</h1>
          <p style="color: #666; font-size: 12px; margin: 0;">Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
        </div>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
          <h2 style="color: #333; font-size: 18px; margin: 0 0 12px; font-weight: bold;">Informações do Contrato</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px;">
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
        <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-bottom: 15px; display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; text-align: center;">
          <div><div style="font-size: 11px; color: #666;">Emprestado</div><div style="font-size: 16px; font-weight: bold; color: #333;">R$ ${Number(contrato.valor_emprestado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div></div>
          <div><div style="font-size: 11px; color: #666;">Total Pago</div><div style="font-size: 16px; font-weight: bold; color: #22c55e;">R$ ${totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div></div>
          <div><div style="font-size: 11px; color: #666;">Saldo Restante</div><div style="font-size: 16px; font-weight: bold; color: #ef4444;">R$ ${saldoRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div></div>
          <div><div style="font-size: 11px; color: #666;">Quitado</div><div style="font-size: 16px; font-weight: bold; color: #333;">${percentQuitado.toFixed(1)}%</div></div>
        </div>
        <div>
          <h2 style="color: #333; font-size: 18px; margin-bottom: 10px; font-weight: bold;">Parcelas</h2>
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
                const { texto: statusTexto, cor } = getStatusInfo(p);
                const venc = new Date(p.data_vencimento + 'T00:00:00');
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
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPos = 20;
      let pageNum = 1;

      const clienteNome = contrato.clientes?.nome || 'N/A';
      const totalPago = parcelas.reduce((s, p) => s + (Number(p.valor_pago) || 0), 0);
      const saldoRestante = Number(contrato.valor_total) - totalPago;
      const percentQuitado = Number(contrato.valor_total) > 0 ? (totalPago / Number(contrato.valor_total)) * 100 : 0;

      const addFooter = () => {
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, margin, pageHeight - 10);
        pdf.text(`Página ${pageNum}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
        pdf.setTextColor(0, 0, 0);
      };

      // Cabeçalho
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('RELATÓRIO DE CONTRATO', pageWidth / 2, yPos, { align: 'center' });
      yPos += 8;
      pdf.setDrawColor(50, 50, 50);
      pdf.setLineWidth(0.8);
      pdf.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 12;

      // Info do contrato
      pdf.setFontSize(13);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Informações do Contrato', margin, yPos);
      yPos += 7;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const linhas = [
        `Cliente: ${clienteNome}`,
        `Data do Empréstimo: ${format(new Date(contrato.data_emprestimo + 'T00:00:00'), 'dd/MM/yyyy')}`,
        `Valor Emprestado: R$ ${Number(contrato.valor_emprestado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `Percentual: ${Number(contrato.percentual)}%  |  Tipo: ${contrato.tipo_juros}`,
        `Valor Total: R$ ${Number(contrato.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `Parcelas: ${contrato.numero_parcelas}  |  Periodicidade: ${contrato.periodicidade}`,
        `Status: ${contrato.status}`,
      ];
      linhas.forEach(l => { pdf.text(l, margin, yPos); yPos += 5.5; });
      yPos += 6;

      // Resumo financeiro
      pdf.setFillColor(240, 249, 240);
      pdf.roundedRect(margin, yPos - 4, pageWidth - 2 * margin, 22, 3, 3, 'F');
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      const colW = (pageWidth - 2 * margin) / 4;
      const labels = ['Emprestado', 'Total Pago', 'Saldo Restante', 'Quitado'];
      const values = [
        `R$ ${Number(contrato.valor_emprestado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${saldoRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `${percentQuitado.toFixed(1)}%`,
      ];
      const colors: [number, number, number][] = [[50, 50, 50], [34, 197, 94], [239, 68, 68], [50, 50, 50]];

      labels.forEach((label, i) => {
        const x = margin + colW * i + colW / 2;
        pdf.setTextColor(120, 120, 120);
        pdf.setFontSize(8);
        pdf.text(label, x, yPos + 4, { align: 'center' });
        pdf.setTextColor(...colors[i]);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.text(values[i], x, yPos + 12, { align: 'center' });
      });
      pdf.setTextColor(0, 0, 0);
      yPos += 28;

      // Tabela de parcelas
      pdf.setFontSize(13);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Parcelas', margin, yPos);
      yPos += 7;

      // Header da tabela
      const colWidths = [15, 30, 32, 28, 30, 32];
      const headers = ['Nº', 'Vencimento', 'Valor', 'Status', 'Pagamento', 'Valor Pago'];

      const drawTableHeader = () => {
        pdf.setFillColor(50, 50, 50);
        pdf.rect(margin, yPos - 4, pageWidth - 2 * margin, 7, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        let xP = margin + 2;
        headers.forEach((h, i) => { pdf.text(h, xP, yPos); xP += colWidths[i]; });
        pdf.setTextColor(0, 0, 0);
        yPos += 6;
      };

      drawTableHeader();

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);

      parcelas.forEach((p, idx) => {
        if (yPos > pageHeight - 20) {
          addFooter();
          pdf.addPage();
          pageNum++;
          yPos = 20;
          drawTableHeader();
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
        }

        // Linha alternada
        if (idx % 2 === 0) {
          pdf.setFillColor(248, 248, 248);
          pdf.rect(margin, yPos - 3.5, pageWidth - 2 * margin, 5.5, 'F');
        }

        const { texto: statusTexto, cor } = getStatusInfo(p);
        const venc = new Date(p.data_vencimento + 'T00:00:00');

        let xP = margin + 2;
        const dados = [
          p.numero_parcela.toString(),
          format(venc, 'dd/MM/yy'),
          `R$ ${Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          statusTexto,
          p.data_pagamento ? format(new Date(p.data_pagamento + 'T00:00:00'), 'dd/MM/yy') : '-',
          p.valor_pago ? `R$ ${Number(p.valor_pago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-',
        ];

        dados.forEach((d, i) => {
          if (i === 3) {
            // Status com cor
            const hex = cor;
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            pdf.setTextColor(r, g, b);
            pdf.setFont('helvetica', 'bold');
            pdf.text(d, xP, yPos);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(0, 0, 0);
          } else {
            pdf.text(d, xP, yPos);
          }
          xP += colWidths[i];
        });
        yPos += 5.5;
      });

      addFooter();
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
