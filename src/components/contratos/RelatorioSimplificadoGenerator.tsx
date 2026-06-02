import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useToast } from "@/hooks/use-toast";
import type { Contrato, Parcela } from "./ContratoDetails";

interface RelatorioSimplificadoGeneratorProps {
  contrato: Contrato;
  parcelas: Parcela[];
}

const periodicidadeLabel: Record<string, string> = {
  diario: "Diário",
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
};

export function RelatorioSimplificadoGenerator({ contrato, parcelas }: RelatorioSimplificadoGeneratorProps) {
  const { toast } = useToast();

  const escapeHtml = (text: string): string => {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  };

  // Badge colors for the simplified design
  const getStatusInfo = (p: Parcela) => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const venc = new Date(p.data_vencimento + "T00:00:00");
    if (p.status === "pago") return { texto: "Pago", bg: "#e7f1ec", fg: "#0f6b4f" };
    if (p.status === "parcialmente_pago") return { texto: "Parcial", bg: "#fbf0db", fg: "#b87514" };
    if (venc < hoje) return { texto: "Atrasado", bg: "#f7e4e2", fg: "#b3261e" };
    return { texto: "Pendente", bg: "#fbf0db", fg: "#b87514" };
  };

  const fmtMoney = (v: number) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  const montarHtml = (): HTMLDivElement => {
    const tempDiv = document.createElement("div");
    tempDiv.style.position = "absolute";
    tempDiv.style.left = "-9999px";
    tempDiv.style.top = "0";
    tempDiv.style.width = "800px";
    tempDiv.style.backgroundColor = "#ffffff";
    document.body.appendChild(tempDiv);

    const clienteNome = escapeHtml(contrato.clientes?.nome || "N/A");
    const totalPago = parcelas.reduce((s, p) => s + (Number(p.valor_pago) || 0), 0);
    const valorTotal = Number(contrato.valor_total);
    const pctQuitado = valorTotal > 0 ? Math.min(100, (totalPago / valorTotal) * 100) : 0;
    const pctLabel = pctQuitado.toFixed(0);
    const contratoIdCurto = (contrato.id || "").slice(0, 8).toUpperCase();

    const linhasParcelas = parcelas
      .map((p, i) => {
        const { texto, bg, fg } = getStatusInfo(p);
        const venc = new Date(p.data_vencimento + "T00:00:00");
        const pagamento = p.data_pagamento ? format(new Date(p.data_pagamento + "T00:00:00"), "dd/MM/yyyy") : "—";
        const valorPago = p.valor_pago ? `R$ ${fmtMoney(p.valor_pago)}` : "—";
        return `
          <tr style="background:${i % 2 === 0 ? "#fbfaf8" : "#ffffff"};">
            <td style="padding:11px 14px;color:#3a342e;border-bottom:1px solid #efe9e1;">${p.numero_parcela}</td>
            <td style="padding:11px 14px;color:#3a342e;border-bottom:1px solid #efe9e1;">${format(venc, "dd/MM/yyyy")}</td>
            <td style="padding:11px 14px;color:#3a342e;border-bottom:1px solid #efe9e1;">R$ ${fmtMoney(p.valor)}</td>
            <td style="padding:11px 14px;border-bottom:1px solid #efe9e1;">
              <span style="display:inline-block;background:${bg};color:${fg};padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600;">${texto}</span>
            </td>
            <td style="padding:11px 14px;color:#6b6359;border-bottom:1px solid #efe9e1;">${pagamento}</td>
            <td style="padding:11px 14px;color:#3a342e;border-bottom:1px solid #efe9e1;">${valorPago}</td>
          </tr>`;
      })
      .join("");

    tempDiv.innerHTML = `
      <div style="width:800px;box-sizing:border-box;padding:48px;background:#ffffff;font-family:'Hanken Grotesk',Arial,sans-serif;color:#3a342e;">
        <!-- Header -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <span style="width:9px;height:9px;border-radius:50%;background:#b87514;display:inline-block;"></span>
          <span style="font-size:13px;font-weight:600;letter-spacing:0.04em;color:#6b6359;text-transform:uppercase;">WS Empréstimos</span>
        </div>
        <h1 style="font-family:'Fraunces',Georgia,serif;font-size:34px;font-weight:600;margin:0 0 4px;color:#26211c;">Relatório de Contrato</h1>
        <p style="font-size:13px;color:#9a9088;margin:0 0 28px;">Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>

        <!-- Cliente -->
        <div style="margin-bottom:24px;">
          <p style="font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#9a9088;margin:0 0 4px;">Cliente</p>
          <p style="font-family:'Fraunces',Georgia,serif;font-size:24px;font-weight:600;margin:0;color:#26211c;">${clienteNome}</p>
        </div>

        <!-- Valor total + quitação -->
        <div style="display:flex;gap:16px;margin-bottom:24px;">
          <div style="flex:1;background:#26211c;border-radius:16px;padding:24px;">
            <p style="font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#c9bfb2;margin:0 0 6px;">Valor total devido</p>
            <p style="font-family:'Fraunces',Georgia,serif;font-size:34px;font-weight:600;margin:0;color:#ffffff;">R$ ${fmtMoney(valorTotal)}</p>
          </div>
          <div style="flex:1;background:#f6f1ea;border-radius:16px;padding:24px;">
            <p style="font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#9a9088;margin:0 0 10px;">Quitação <span style="color:#b87514;font-weight:700;">${pctLabel}%</span></p>
            <div style="width:100%;height:12px;background:#e6ddd0;border-radius:999px;overflow:hidden;">
              <div style="width:${pctQuitado}%;height:12px;background:#0f6b4f;border-radius:999px;"></div>
            </div>
          </div>
        </div>

        <!-- Grid de info -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:32px;">
          <div style="background:#fbfaf8;border:1px solid #efe9e1;border-radius:12px;padding:16px;">
            <p style="font-size:11px;letter-spacing:0.05em;text-transform:uppercase;color:#9a9088;margin:0 0 6px;">Data do empréstimo</p>
            <p style="font-size:16px;font-weight:600;margin:0;color:#26211c;">${format(new Date(contrato.data_emprestimo + "T00:00:00"), "dd/MM/yyyy")}</p>
          </div>
          <div style="background:#fbfaf8;border:1px solid #efe9e1;border-radius:12px;padding:16px;">
            <p style="font-size:11px;letter-spacing:0.05em;text-transform:uppercase;color:#9a9088;margin:0 0 6px;">Parcelas</p>
            <p style="font-size:16px;font-weight:600;margin:0;color:#26211c;">${contrato.numero_parcelas}</p>
          </div>
          <div style="background:#fbfaf8;border:1px solid #efe9e1;border-radius:12px;padding:16px;">
            <p style="font-size:11px;letter-spacing:0.05em;text-transform:uppercase;color:#9a9088;margin:0 0 6px;">Periodicidade</p>
            <p style="font-size:16px;font-weight:600;margin:0;color:#26211c;">${periodicidadeLabel[contrato.periodicidade] || contrato.periodicidade}</p>
          </div>
          <div style="background:#fbfaf8;border:1px solid #efe9e1;border-radius:12px;padding:16px;">
            <p style="font-size:11px;letter-spacing:0.05em;text-transform:uppercase;color:#9a9088;margin:0 0 6px;">Status</p>
            <p style="font-size:16px;font-weight:600;margin:0;color:#26211c;text-transform:capitalize;">${escapeHtml(contrato.status)}</p>
          </div>
        </div>

        <!-- Tabela -->
        <h2 style="font-family:'Fraunces',Georgia,serif;font-size:20px;font-weight:600;margin:0 0 14px;color:#26211c;">Detalhamento das Parcelas</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #efe9e1;border-radius:12px;overflow:hidden;">
          <thead>
            <tr style="background:#f6f1ea;">
              <th style="padding:12px 14px;text-align:left;font-size:11px;letter-spacing:0.05em;text-transform:uppercase;color:#6b6359;font-weight:600;">Nº</th>
              <th style="padding:12px 14px;text-align:left;font-size:11px;letter-spacing:0.05em;text-transform:uppercase;color:#6b6359;font-weight:600;">Vencimento</th>
              <th style="padding:12px 14px;text-align:left;font-size:11px;letter-spacing:0.05em;text-transform:uppercase;color:#6b6359;font-weight:600;">Valor</th>
              <th style="padding:12px 14px;text-align:left;font-size:11px;letter-spacing:0.05em;text-transform:uppercase;color:#6b6359;font-weight:600;">Status</th>
              <th style="padding:12px 14px;text-align:left;font-size:11px;letter-spacing:0.05em;text-transform:uppercase;color:#6b6359;font-weight:600;">Pagamento</th>
              <th style="padding:12px 14px;text-align:left;font-size:11px;letter-spacing:0.05em;text-transform:uppercase;color:#6b6359;font-weight:600;">Valor Pago</th>
            </tr>
          </thead>
          <tbody>
            ${linhasParcelas}
          </tbody>
        </table>

        <!-- Footer -->
        <div style="margin-top:28px;padding-top:16px;border-top:1px solid #efe9e1;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;color:#9a9088;">WS Empréstimos · Documento gerado automaticamente</span>
          <span style="font-size:11px;color:#9a9088;">Contrato #${contratoIdCurto}</span>
        </div>
      </div>`;

    return tempDiv;
  };

  const gerarCanvas = async (): Promise<HTMLCanvasElement> => {
    const tempDiv = montarHtml();
    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      const canvas = await html2canvas(tempDiv, { scale: 2, backgroundColor: "#ffffff", logging: false });
      return canvas;
    } finally {
      document.body.removeChild(tempDiv);
    }
  };

  const baseFileName = () => {
    const nome = (contrato.clientes?.nome || "cliente").replace(/\s+/g, "-");
    return `relatorio-simplificado-${nome}-${format(new Date(), "dd-MM-yyyy")}`;
  };

  const gerarImagem = async () => {
    try {
      const canvas = await gerarCanvas();
      const fileName = `${baseFileName()}.png`;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        if (isIOS && navigator.share && navigator.canShare) {
          const file = new File([blob], fileName, { type: "image/png" });
          if (navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({ files: [file], title: "Relatório Simplificado" });
              toast({ title: "Imagem pronta!", description: "Escolha 'Salvar Imagem' para adicionar à galeria." });
              return;
            } catch (err: any) {
              if (err.name === "AbortError") return;
            }
          }
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        toast({ title: "Imagem gerada!", description: "O arquivo foi baixado." });
      }, "image/png");
    } catch (error) {
      toast({ title: "Erro ao gerar imagem", variant: "destructive" });
    }
  };

  const gerarPDF = async () => {
    try {
      const canvas = await gerarCanvas();
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const imgW = pw;
      const imgH = (canvas.height * imgW) / canvas.width;
      let heightLeft = imgH;
      let pos = 0;
      pdf.addImage(imgData, "PNG", 0, pos, imgW, imgH);
      heightLeft -= ph;
      while (heightLeft > 0) {
        pos -= ph;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, pos, imgW, imgH);
        heightLeft -= ph;
      }
      pdf.save(`${baseFileName()}.pdf`);
      toast({ title: "PDF gerado!", description: "O relatório foi baixado." });
    } catch (error) {
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    }
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